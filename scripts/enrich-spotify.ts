import { query } from "../lib/db";
import { SpotifyClient } from "../lib/api/spotify/client";
import { enrichArtistFromSpotify } from "../lib/api/spotify/enricher";

const DRY_RUN = process.argv.includes("--dry-run");
const DELAY_MS = 150;

async function main() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("[spotify] SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET not set — skipping");
    process.exit(0);
  }

  if (DRY_RUN) console.log("[spotify] DRY RUN — no DB writes");

  const spotify = new SpotifyClient(clientId, clientSecret);

  // Fetch artists that are missing spotify enrichment
  const artists = await query<{ id: string; name: string }>(
    `SELECT id, name FROM artists
     WHERE spotify_id IS NULL OR image_url IS NULL OR genres IS NULL
     ORDER BY popularity DESC NULLS LAST, name
     LIMIT 500`
  );

  console.log(`[spotify] enriching ${artists.length} artists`);

  const stats = { enriched: 0, not_found: 0, errors: 0 };

  for (const artist of artists) {
    try {
      const sp = await spotify.searchArtist(artist.name);
      if (!sp) {
        stats.not_found++;
        console.log(`[spotify] not found: "${artist.name}"`);
        await spotify.wait(DELAY_MS);
        continue;
      }

      if (DRY_RUN) {
        console.log(
          `[spotify] would enrich "${artist.name}" → ${sp.id} genres=${sp.genres.slice(0, 2).join(",")} pop=${sp.popularity}`
        );
        await spotify.wait(DELAY_MS);
        continue;
      }

      await enrichArtistFromSpotify(artist.id, sp);
      stats.enriched++;
      console.log(
        `[spotify] enriched "${artist.name}" → ${sp.id} pop=${sp.popularity}`
      );
    } catch (err) {
      stats.errors++;
      console.error(
        `[spotify] error for "${artist.name}": ${err instanceof Error ? err.message : String(err)}`
      );
    }

    await spotify.wait(DELAY_MS);
  }

  console.log(
    `[spotify] done. enriched=${stats.enriched} not_found=${stats.not_found} errors=${stats.errors}`
  );
}

main().catch((err) => {
  console.error("[spotify] fatal:", err);
  process.exit(1);
});
