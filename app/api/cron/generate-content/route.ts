// app/api/cron/generate-content/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/utils/cron";
import { query } from "@/lib/db";
import {
  createOpenAIClient,
  generateEventContent,
  generateArtistContent,
  generateVenueContent,
} from "@/lib/content/generators";
import type { EventPromptData, ArtistPromptData, VenuePromptData } from "@/lib/content/prompts";

const JOBS_PER_RUN = parseInt(process.env.CONTENT_JOBS_PER_RUN ?? "10", 10) || 10;

export async function POST(req: NextRequest) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  try {
    const client = createOpenAIClient();
    const stats = { processed: 0, done: 0, failed: 0 };

    // ── Events ──────────────────────────────────────────────────────────────────
    const eventRows = await query<{
      job_id: string; entity_id: string;
      title: string; date: string;
      artist_name: string | null; artist_genres: string[] | null;
      venue_name: string | null; venue_address: string | null; venue_capacity: number | null;
      city_name: string | null; min_price: number | null; currency: string;
    }>(`
      SELECT cj.id AS job_id, cj.entity_id,
             e.title, e.date::text,
             a.name AS artist_name, a.genres AS artist_genres,
             v.name AS venue_name, v.address AS venue_address, v.capacity AS venue_capacity,
             c.name AS city_name,
             (SELECT MIN(ps.min_price) FROM event_sources es
              JOIN price_snapshots ps ON ps.event_source_id = es.id
              WHERE es.event_id = e.id AND NOT ps.is_sold_out) AS min_price,
             COALESCE(
               (SELECT ps.currency FROM event_sources es
                JOIN price_snapshots ps ON ps.event_source_id = es.id
                WHERE es.event_id = e.id ORDER BY ps.snapped_at DESC LIMIT 1),
               'MXN'
             ) AS currency
      FROM content_jobs cj
      JOIN events e ON e.id = cj.entity_id
      LEFT JOIN artists a ON a.id = e.artist_id
      LEFT JOIN venues  v ON v.id = e.venue_id
      LEFT JOIN cities  c ON c.id = e.city_id
      WHERE cj.entity_type = 'event' AND cj.job_type = 'event_context' AND cj.status = 'queued'
      LIMIT $1
    `, [JOBS_PER_RUN]);

    for (const row of eventRows) {
      stats.processed++;
      await query(`UPDATE content_jobs SET status='processing', attempts=attempts+1, updated_at=NOW() WHERE id=$1`, [row.job_id]);
      try {
        const data: EventPromptData = {
          title: row.title, date: row.date,
          artistName: row.artist_name, artistGenres: row.artist_genres,
          venueName: row.venue_name, venueAddress: row.venue_address,
          venueCapacity: row.venue_capacity, cityName: row.city_name,
          minPrice: row.min_price, currency: row.currency,
        };
        const content = await generateEventContent(data, client);
        await query(
          `UPDATE events SET seo_title=$2, seo_description=$3, h1_title=$4, context_text=$5, faq_json=$6, content_status='published', updated_at=NOW() WHERE id=$1`,
          [row.entity_id, content.seo_title, content.seo_description, content.h1_title, content.context_text, JSON.stringify(content.faq)],
        );
        await query(`UPDATE content_jobs SET status='done', updated_at=NOW() WHERE id=$1`, [row.job_id]);
        stats.done++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await query(`UPDATE content_jobs SET status='failed', last_error=$2, updated_at=NOW() WHERE id=$1`, [row.job_id, msg]);
        await query(`UPDATE events SET content_status='failed', updated_at=NOW() WHERE id=$1`, [row.entity_id]);
        stats.failed++;
        console.error(`[generate-content] event job ${row.job_id} failed:`, msg);
      }
    }

    // ── Artists ─────────────────────────────────────────────────────────────────
    const artistRows = await query<{
      job_id: string; entity_id: string; name: string; genres: string[] | null; popularity: number | null;
    }>(`
      SELECT cj.id AS job_id, cj.entity_id, a.name, a.genres, a.popularity
      FROM content_jobs cj JOIN artists a ON a.id = cj.entity_id
      WHERE cj.entity_type='artist' AND cj.job_type='artist_bio' AND cj.status='queued'
      LIMIT $1
    `, [JOBS_PER_RUN]);

    for (const row of artistRows) {
      stats.processed++;
      await query(`UPDATE content_jobs SET status='processing', attempts=attempts+1, updated_at=NOW() WHERE id=$1`, [row.job_id]);
      try {
        const data: ArtistPromptData = { name: row.name, genres: row.genres, popularity: row.popularity };
        const content = await generateArtistContent(data, client);
        await query(
          `UPDATE artists SET bio_es=$2, content_status='published', updated_at=NOW() WHERE id=$1`,
          [row.entity_id, content.bio_es],
        );
        await query(`UPDATE content_jobs SET status='done', updated_at=NOW() WHERE id=$1`, [row.job_id]);
        stats.done++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await query(`UPDATE content_jobs SET status='failed', last_error=$2, updated_at=NOW() WHERE id=$1`, [row.job_id, msg]);
        await query(`UPDATE artists SET content_status='failed', updated_at=NOW() WHERE id=$1`, [row.entity_id]);
        stats.failed++;
        console.error(`[generate-content] artist job ${row.job_id} failed:`, msg);
      }
    }

    // ── Venues ──────────────────────────────────────────────────────────────────
    const venueRows = await query<{
      job_id: string; entity_id: string; name: string; city_name: string | null; address: string | null; capacity: number | null;
    }>(`
      SELECT cj.id AS job_id, cj.entity_id, v.name, c.name AS city_name, v.address, v.capacity
      FROM content_jobs cj JOIN venues v ON v.id = cj.entity_id LEFT JOIN cities c ON c.id = v.city_id
      WHERE cj.entity_type='venue' AND cj.job_type='venue_description' AND cj.status='queued'
      LIMIT $1
    `, [JOBS_PER_RUN]);

    for (const row of venueRows) {
      stats.processed++;
      await query(`UPDATE content_jobs SET status='processing', attempts=attempts+1, updated_at=NOW() WHERE id=$1`, [row.job_id]);
      try {
        const data: VenuePromptData = { name: row.name, cityName: row.city_name, address: row.address, capacity: row.capacity };
        const content = await generateVenueContent(data, client);
        await query(
          `UPDATE venues SET description_es=$2, content_status='published', updated_at=NOW() WHERE id=$1`,
          [row.entity_id, content.description_es],
        );
        await query(`UPDATE content_jobs SET status='done', updated_at=NOW() WHERE id=$1`, [row.job_id]);
        stats.done++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await query(`UPDATE content_jobs SET status='failed', last_error=$2, updated_at=NOW() WHERE id=$1`, [row.job_id, msg]);
        await query(`UPDATE venues SET content_status='failed', updated_at=NOW() WHERE id=$1`, [row.entity_id]);
        stats.failed++;
        console.error(`[generate-content] venue job ${row.job_id} failed:`, msg);
      }
    }

    return NextResponse.json({ ok: true, jobsPerRun: JOBS_PER_RUN, stats });
  } catch (err) {
    console.error("[generate-content] unhandled error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
