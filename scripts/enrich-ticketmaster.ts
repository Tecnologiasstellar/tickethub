import { TicketmasterClient } from "../lib/api/ticketmaster/client";
import { tmEventToNormalized } from "../lib/api/ticketmaster/enricher";
import { ingestNormalizedEvent } from "../lib/dedupe/ingest";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    console.error("[ticketmaster] TICKETMASTER_API_KEY not set — skipping");
    process.exit(0);
  }

  if (DRY_RUN) console.log("[ticketmaster] DRY RUN — no DB writes");

  const client = new TicketmasterClient(apiKey);

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

  for await (const ev of client.mexicoMusicEvents(500)) {
    stats.fetched++;
    const normalized = tmEventToNormalized(ev);
    if (!normalized) { stats.skipped++; continue; }

    if (DRY_RUN) {
      console.log(
        `[ticketmaster] would ingest: "${normalized.title}" (${normalized.cityName}, ${normalized.date.toISOString().slice(0, 10)})`
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
        `[ticketmaster] error for ${ev.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.log(
    `[ticketmaster] done. fetched=${stats.fetched} skipped=${stats.skipped} ` +
    `created=${stats.created} merged=${stats.merged} ambiguous=${stats.ambiguous} ` +
    `tribute_rejected=${stats.tribute_rejected} unknown_city=${stats.unknown_city} errors=${stats.errors}`
  );
}

main().catch((err) => {
  console.error("[ticketmaster] fatal:", err);
  process.exit(1);
});
