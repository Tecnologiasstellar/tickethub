import { EventbriteClient } from "../lib/api/eventbrite/client";
import { normalizeEventbriteEvent } from "../lib/api/eventbrite/normalizer";
import { ingestNormalizedEvent } from "../lib/dedupe/ingest";
import { loadCheckpoint, markDone, clearCheckpoint } from "../lib/utils/checkpoint";

const DRY_RUN = process.argv.includes("--dry-run");
const RESET = process.argv.includes("--reset");
const CHECKPOINT_FILE = ".checkpoints/ingest-eventbrite.json";

async function main() {
  if (DRY_RUN) console.log("[eventbrite] DRY RUN — no DB writes");

  if (RESET) {
    await clearCheckpoint(CHECKPOINT_FILE);
    console.log("[eventbrite] checkpoint reset");
  }
  const done = await loadCheckpoint(CHECKPOINT_FILE);
  if (done.size) console.log(`[eventbrite] ${done.size} already completed, will skip`);

  const client = new EventbriteClient();

  const stats = {
    fetched: 0,
    skipped_normalize: 0,
    created: 0,
    merged: 0,
    ambiguous: 0,
    tribute_rejected: 0,
    unknown_city: 0,
    errors: 0,
  };

  for await (const ev of client.allMexicoEvents()) {
    stats.fetched++;

    if (done.has(ev.id)) {
      console.log(`[eventbrite] skip ${ev.id} (already completed)`);
      continue;
    }

    const normalized = normalizeEventbriteEvent(ev);
    if (!normalized) {
      stats.skipped_normalize++;
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `[eventbrite] would ingest: "${normalized.title}" (${normalized.cityName}, ${normalized.date.toISOString().slice(0, 10)})`
      );
      await markDone(CHECKPOINT_FILE, ev.id);
      continue;
    }

    try {
      const result = await ingestNormalizedEvent(normalized);
      console.log(result.log);
      switch (result.action) {
        case "created":          stats.created++; break;
        case "merged":           stats.merged++; break;
        case "ambiguous_skipped": stats.ambiguous++; break;
        case "rejected_tribute": stats.tribute_rejected++; break;
        case "rejected_unknown_city": stats.unknown_city++; break;
      }
      await markDone(CHECKPOINT_FILE, ev.id);
    } catch (err) {
      stats.errors++;
      console.error(
        `[eventbrite] error ingesting ${ev.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.log(
    `[eventbrite] done. fetched=${stats.fetched} skipped=${stats.skipped_normalize} ` +
    `created=${stats.created} merged=${stats.merged} ambiguous=${stats.ambiguous} ` +
    `tribute_rejected=${stats.tribute_rejected} unknown_city=${stats.unknown_city} errors=${stats.errors}`
  );
}

main().catch((err) => {
  console.error("[eventbrite] fatal:", err);
  process.exit(1);
});
