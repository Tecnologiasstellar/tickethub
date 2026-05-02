import { scrapeBoletia } from "../lib/scrapers/boletia/scraper";
import { normalizeBoletiaEvent } from "../lib/scrapers/boletia/normalizer";
import { ingestNormalizedEvent } from "../lib/dedupe/ingest";

const DRY_RUN = process.argv.includes("--dry-run");
const MAX_EVENTS = parseInt(
  process.argv.find((a) => a.startsWith("--max="))?.split("=")[1] ?? "100",
  10
);

async function main() {
  if (DRY_RUN) console.log("[boletia] DRY RUN — no DB writes");

  console.log(`[boletia] starting scrape (max=${MAX_EVENTS})`);
  const raw = await scrapeBoletia(MAX_EVENTS);
  console.log(`[boletia] scraped ${raw.length} raw events`);

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
    const normalized = normalizeBoletiaEvent(ev);
    if (!normalized) {
      stats.skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `[boletia] would ingest: "${normalized.title}" (${normalized.cityName}, ${normalized.date.toISOString().slice(0, 10)})`
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
        `[boletia] error ingesting "${ev.title}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.log(
    `[boletia] done. scraped=${stats.scraped} skipped=${stats.skipped} ` +
    `created=${stats.created} merged=${stats.merged} ambiguous=${stats.ambiguous} ` +
    `tribute_rejected=${stats.tribute_rejected} unknown_city=${stats.unknown_city} errors=${stats.errors}`
  );
}

main().catch((err) => {
  console.error("[boletia] fatal:", err);
  process.exit(1);
});
