import { query, queryOne } from "../lib/db";
import { SetlistFmClient } from "../lib/api/setlistfm/client";
import { normalizeSetlist } from "../lib/api/setlistfm/normalizer";
import { delay } from "../lib/utils/http";

const DRY_RUN = process.argv.includes("--dry-run");
const DELAY_BETWEEN_ARTISTS_MS = 600;

async function saveSetlist(ins: ReturnType<typeof normalizeSetlist>): Promise<boolean> {
  if (!ins) return false;
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM setlists WHERE setlistfm_id = $1`,
    [ins.setlistfmId]
  );
  if (existing) return false;

  await queryOne(
    `INSERT INTO setlists
       (artist_id, setlistfm_id, event_date, venue_name, city_name, country, songs, source_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (setlistfm_id) DO NOTHING`,
    [
      ins.artistId,
      ins.setlistfmId,
      ins.eventDate,
      ins.venueName,
      ins.cityName,
      ins.country,
      JSON.stringify(ins.songs),
      ins.sourceUrl,
    ]
  );
  return true;
}

async function main() {
  const apiKey = process.env.SETLISTFM_API_KEY;
  if (!apiKey) {
    console.error("[setlistfm] SETLISTFM_API_KEY not set — skipping");
    process.exit(0);
  }

  if (DRY_RUN) console.log("[setlistfm] DRY RUN — no DB writes");

  const client = new SetlistFmClient(apiKey);

  // Process artists that have a spotify_id (popularity signal) or are in popular events
  const artists = await query<{ id: string; name: string; mbid: string | null }>(
    `SELECT id, name, mbid FROM artists
     WHERE (spotify_id IS NOT NULL OR popularity >= 60)
     ORDER BY popularity DESC NULLS LAST
     LIMIT 200`
  );

  console.log(`[setlistfm] processing ${artists.length} artists`);

  const stats = { artists: 0, setlists_saved: 0, not_found: 0, errors: 0 };

  for (const artist of artists) {
    stats.artists++;
    let mbid = artist.mbid;

    try {
      if (!mbid) {
        const found = await client.findArtist(artist.name);
        if (!found) {
          stats.not_found++;
          console.log(`[setlistfm] artist not found: "${artist.name}"`);
          await delay(DELAY_BETWEEN_ARTISTS_MS);
          continue;
        }
        mbid = found.mbid;

        if (!DRY_RUN) {
          await queryOne(
            `UPDATE artists SET mbid = $2 WHERE id = $1`,
            [artist.id, mbid]
          );
        }
        console.log(`[setlistfm] resolved mbid for "${artist.name}" → ${mbid}`);
        await delay(500);
      }

      let setlistCount = 0;
      for await (const sl of client.setlists(mbid, 3)) {
        const normalized = normalizeSetlist(sl, artist.id);
        if (!normalized) continue;

        if (DRY_RUN) {
          console.log(
            `[setlistfm] would save setlist ${sl.id} for "${artist.name}" on ${normalized.eventDate} (${normalized.songs.length} songs)`
          );
          setlistCount++;
          continue;
        }

        const saved = await saveSetlist(normalized);
        if (saved) {
          setlistCount++;
          stats.setlists_saved++;
        }
      }

      if (setlistCount > 0) {
        console.log(`[setlistfm] "${artist.name}" → ${setlistCount} setlists saved`);
      }
    } catch (err) {
      stats.errors++;
      console.error(
        `[setlistfm] error for "${artist.name}": ${err instanceof Error ? err.message : String(err)}`
      );
    }

    await delay(DELAY_BETWEEN_ARTISTS_MS);
  }

  console.log(
    `[setlistfm] done. artists=${stats.artists} setlists_saved=${stats.setlists_saved} not_found=${stats.not_found} errors=${stats.errors}`
  );
}

main().catch((err) => {
  console.error("[setlistfm] fatal:", err);
  process.exit(1);
});
