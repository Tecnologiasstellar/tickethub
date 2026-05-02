import { scrapeSuperboletos } from "../lib/scrapers/superboletos/scraper";
import { normalizeSuperboletosEvent } from "../lib/scrapers/superboletos/normalizer";
import { ingestNormalizedEvent } from "../lib/dedupe/ingest";

const DRY_RUN = process.argv.includes("--dry-run");
const MAX_EVENTS = parseInt(
  process.argv.find((a) => a.startsWith("--max="))?.split("=")[1] ?? "100",
  10
);

async function main() {
  if (DRY_RUN) console.log("[superboletos] DRY RUN — no DB writes");

  console.log(`[superboletos] starting scrape (max=${MAX_EVENTS})`);
  const raw = await scrapeSuperboletos(MAX_EVENTS);
  console.log(`[superboletos] scraped ${raw.length} raw events`);

  const stats = {
    scraped: raw.length,
    skipped: 0,
    created: 0,
    merged: 0,
    ambiguous: 0,
    tribute_rejected: 0,
    unknown_city: 0,
    errors: 0,
  };

  for (const ev of raw) {
    const normalized = normalizeSuperboletosEvent(ev);
    if (!normalized) {
      stats.skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `[superboletos] would ingest: "${normalized.title}" (${normalized.cityName}, ${normalized.date.toISOString().slice(0, 10)})`
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
        `[superboletos] error ingesting "${ev.title}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.log(
    `[superboletos] done. scraped=${stats.scraped} skipped=${stats.skipped} ` +
    `created=${stats.created} merged=${stats.merged} ambiguous=${stats.ambiguous} ` +
    `tribute_rejected=${stats.tribute_rejected} unknown_city=${stats.unknown_city} errors=${stats.errors}`
  );
}

main().catch((err) => {
  console.error("[superboletos] fatal:", err);
  process.exit(1);
});
