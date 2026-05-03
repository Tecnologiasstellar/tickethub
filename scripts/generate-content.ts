import OpenAI from "openai";
import { query } from "@/lib/db";
import {
  createOpenAIClient,
  generateEventContent,
  generateArtistContent,
  generateVenueContent,
} from "@/lib/content/generators";
import type { EventPromptData, ArtistPromptData, VenuePromptData } from "@/lib/content/prompts";

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const entityTypeArg = args.find((a) => a.startsWith("--entity-type="))?.split("=")[1];
const limitArg = parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "10", 10);
const dryRun = args.includes("--dry-run");

const ENTITY_TYPES = ["event", "artist", "venue"] as const;
type EntityType = (typeof ENTITY_TYPES)[number];

const targetTypes: EntityType[] =
  entityTypeArg && ENTITY_TYPES.includes(entityTypeArg as EntityType)
    ? [entityTypeArg as EntityType]
    : [...ENTITY_TYPES];

// ─── Job helpers ──────────────────────────────────────────────────────────────

async function enqueueJobs(entityType: EntityType, entityIds: string[]) {
  const jobType =
    entityType === "event"
      ? "event_context"
      : entityType === "artist"
        ? "artist_bio"
        : "venue_description";

  for (const entityId of entityIds) {
    await query(
      `INSERT INTO content_jobs (entity_type, entity_id, job_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (entity_type, entity_id, job_type) DO NOTHING`,
      [entityType, entityId, jobType],
    );
  }
}

async function claimJob(jobId: string) {
  await query(
    `UPDATE content_jobs
     SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
     WHERE id = $1`,
    [jobId],
  );
}

async function markJobDone(jobId: string) {
  await query(
    `UPDATE content_jobs SET status = 'done', updated_at = NOW() WHERE id = $1`,
    [jobId],
  );
}

async function markJobFailed(jobId: string, error: string) {
  await query(
    `UPDATE content_jobs
     SET status = 'failed', last_error = $2, updated_at = NOW()
     WHERE id = $1`,
    [jobId, error],
  );
}

// ─── Event processing ─────────────────────────────────────────────────────────

interface EventJobRow {
  job_id: string;
  entity_id: string;
  title: string;
  date: string;
  artist_name: string | null;
  artist_genres: string[] | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_capacity: number | null;
  city_name: string | null;
  min_price: number | null;
  currency: string;
}

async function processEventJobs(client: OpenAI, limit: number) {
  const rows = await query<EventJobRow>(`
    SELECT
      cj.id AS job_id, cj.entity_id,
      e.title, e.date::text,
      a.name AS artist_name, a.genres AS artist_genres,
      v.name AS venue_name, v.address AS venue_address, v.capacity AS venue_capacity,
      c.name AS city_name,
      (SELECT MIN(ps.min_price)
       FROM event_sources es
       JOIN price_snapshots ps ON ps.event_source_id = es.id
       WHERE es.event_id = e.id AND NOT ps.is_sold_out
      ) AS min_price,
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
    WHERE cj.entity_type = 'event'
      AND cj.job_type = 'event_context'
      AND cj.status = 'queued'
    LIMIT $1
  `, [limit]);

  console.log(`[events] ${rows.length} jobs to process`);

  for (const row of rows) {
    console.log(`  → ${row.title} (${row.entity_id})`);
    if (dryRun) {
      const data: EventPromptData = {
        title: row.title, date: row.date,
        artistName: row.artist_name, artistGenres: row.artist_genres,
        venueName: row.venue_name, venueAddress: row.venue_address,
        venueCapacity: row.venue_capacity, cityName: row.city_name,
        minPrice: row.min_price, currency: row.currency,
      };
      console.log("    [dry-run] data:", JSON.stringify(data, null, 2));
      continue;
    }

    await claimJob(row.job_id);
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
        `UPDATE events
         SET seo_title = $2, seo_description = $3, h1_title = $4,
             context_text = $5, faq_json = $6, content_status = 'published',
             updated_at = NOW()
         WHERE id = $1`,
        [
          row.entity_id,
          content.seo_title, content.seo_description,
          content.h1_title, content.context_text,
          JSON.stringify(content.faq),
        ],
      );
      await markJobDone(row.job_id);
      console.log("    ✓ published");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await markJobFailed(row.job_id, msg);
      await query(
        `UPDATE events SET content_status = 'failed', updated_at = NOW() WHERE id = $1`,
        [row.entity_id],
      );
      console.error(`    ✗ failed: ${msg}`);
    }
  }
}

// ─── Artist processing ────────────────────────────────────────────────────────

interface ArtistJobRow {
  job_id: string;
  entity_id: string;
  name: string;
  genres: string[] | null;
  popularity: number | null;
}

async function processArtistJobs(client: OpenAI, limit: number) {
  const rows = await query<ArtistJobRow>(`
    SELECT cj.id AS job_id, cj.entity_id,
           a.name, a.genres, a.popularity
    FROM content_jobs cj
    JOIN artists a ON a.id = cj.entity_id
    WHERE cj.entity_type = 'artist'
      AND cj.job_type = 'artist_bio'
      AND cj.status = 'queued'
    LIMIT $1
  `, [limit]);

  console.log(`[artists] ${rows.length} jobs to process`);

  for (const row of rows) {
    console.log(`  → ${row.name} (${row.entity_id})`);
    if (dryRun) {
      console.log("    [dry-run] data:", JSON.stringify({ name: row.name, genres: row.genres, popularity: row.popularity }));
      continue;
    }

    await claimJob(row.job_id);
    try {
      const data: ArtistPromptData = {
        name: row.name, genres: row.genres, popularity: row.popularity,
      };
      const content = await generateArtistContent(data, client);
      await query(
        `UPDATE artists
         SET bio_es = $2, content_status = 'published', updated_at = NOW()
         WHERE id = $1`,
        [row.entity_id, content.bio_es],
      );
      await markJobDone(row.job_id);
      console.log("    ✓ published");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await markJobFailed(row.job_id, msg);
      await query(
        `UPDATE artists SET content_status = 'failed', updated_at = NOW() WHERE id = $1`,
        [row.entity_id],
      );
      console.error(`    ✗ failed: ${msg}`);
    }
  }
}

// ─── Venue processing ─────────────────────────────────────────────────────────

interface VenueJobRow {
  job_id: string;
  entity_id: string;
  name: string;
  city_name: string | null;
  address: string | null;
  capacity: number | null;
}

async function processVenueJobs(client: OpenAI, limit: number) {
  const rows = await query<VenueJobRow>(`
    SELECT cj.id AS job_id, cj.entity_id,
           v.name, c.name AS city_name, v.address, v.capacity
    FROM content_jobs cj
    JOIN venues v ON v.id = cj.entity_id
    LEFT JOIN cities c ON c.id = v.city_id
    WHERE cj.entity_type = 'venue'
      AND cj.job_type = 'venue_description'
      AND cj.status = 'queued'
    LIMIT $1
  `, [limit]);

  console.log(`[venues] ${rows.length} jobs to process`);

  for (const row of rows) {
    console.log(`  → ${row.name} (${row.entity_id})`);
    if (dryRun) {
      console.log("    [dry-run] data:", JSON.stringify({ name: row.name, cityName: row.city_name, address: row.address, capacity: row.capacity }));
      continue;
    }

    await claimJob(row.job_id);
    try {
      const data: VenuePromptData = {
        name: row.name, cityName: row.city_name,
        address: row.address, capacity: row.capacity,
      };
      const content = await generateVenueContent(data, client);
      await query(
        `UPDATE venues
         SET description_es = $2, content_status = 'published', updated_at = NOW()
         WHERE id = $1`,
        [row.entity_id, content.description_es],
      );
      await markJobDone(row.job_id);
      console.log("    ✓ published");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await markJobFailed(row.job_id, msg);
      await query(
        `UPDATE venues SET content_status = 'failed', updated_at = NOW() WHERE id = $1`,
        [row.entity_id],
      );
      console.error(`    ✗ failed: ${msg}`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(
    `[generate-content] entity-types=${targetTypes.join(",")} limit=${limitArg} dry-run=${dryRun}`,
  );

  const client = dryRun ? (null as unknown as OpenAI) : createOpenAIClient();

  // Enqueue: find all queued entities and create content_job rows
  if (targetTypes.includes("event")) {
    const eventIds = await query<{ id: string }>(
      `SELECT id FROM events WHERE content_status = 'queued' LIMIT $1`,
      [limitArg],
    );
    await enqueueJobs("event", eventIds.map((r) => r.id));
  }
  if (targetTypes.includes("artist")) {
    const artistIds = await query<{ id: string }>(
      `SELECT id FROM artists WHERE content_status = 'queued' LIMIT $1`,
      [limitArg],
    );
    await enqueueJobs("artist", artistIds.map((r) => r.id));
  }
  if (targetTypes.includes("venue")) {
    const venueIds = await query<{ id: string }>(
      `SELECT id FROM venues WHERE content_status = 'queued' LIMIT $1`,
      [limitArg],
    );
    await enqueueJobs("venue", venueIds.map((r) => r.id));
  }

  // Process
  if (targetTypes.includes("event")) await processEventJobs(client, limitArg);
  if (targetTypes.includes("artist")) await processArtistJobs(client, limitArg);
  if (targetTypes.includes("venue")) await processVenueJobs(client, limitArg);

  console.log("[generate-content] done.");
}

main().catch((err) => {
  console.error("[generate-content] fatal:", err);
  process.exit(1);
});
