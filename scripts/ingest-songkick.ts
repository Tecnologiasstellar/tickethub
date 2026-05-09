import { SongkickClient } from "../lib/api/songkick/client";
import { normalizeSongkickEvent } from "../lib/api/songkick/normalizer";
import { ingestNormalizedEvent } from "../lib/dedupe/ingest";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const apiKey = process.env.SONGKICK_API_KEY;
  if (!apiKey) {
    console.error("[songkick] SONGKICK_API_KEY not set — skipping");
    process.exit(0);
  }

  if (DRY_RUN) console.log("[songkick] DRY RUN — no DB writes");

  const client = new SongkickClient(apiKey);

  const stats = {
    fetched: 0,
    skipped: 0,
    created: 0,
    merged: 0,
    ambiguous: 0,
    tribute_rejected: 0,
    unknown_city: 0,
    errors: 0,
  };

  for await (const ev of client.allMexicoEvents()) {
    stats.fetched++;

    const normalized = normalizeSongkickEvent(ev);
    if (!normalized) {
      stats.skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `[songkick] would ingest: "${normalized.title}" (${normalized.cityName}, ${normalized.date.toISOString().slice(0, 10)})`
      );
      continue;
    }

    try {
      const result = await ingestNormalizedEvent(normalized);
      console.log(result.log);
      switch (result.action) {
        case "created":           stats.created++; break;
        case "merged":            stats.merged++; break;
        case "ambiguous_skipped": stats.ambiguous++; break;
        case "rejected_tribute":  stats.tribute_rejected++; break;
        case "rejected_unknown_city": stats.unknown_city++; break;
      }
    } catch (err) {
      stats.errors++;
      console.error(
        `[songkick] error ingesting ${ev.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.log(
    `[songkick] done. fetched=${stats.fetched} skipped=${stats.skipped} ` +
    `created=${stats.created} merged=${stats.merged} ambiguous=${stats.ambiguous} ` +
    `tribute_rejected=${stats.tribute_rejected} unknown_city=${stats.unknown_city} errors=${stats.errors}`
  );
}

main().catch((err) => {
  console.error("[songkick] fatal:", err);
  process.exit(1);
});
