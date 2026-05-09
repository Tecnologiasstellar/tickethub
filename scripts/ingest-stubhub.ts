import { StubHubClient } from "../lib/api/stubhub/client";
import { normalizeStubHubEvent } from "../lib/api/stubhub/normalizer";
import { ingestNormalizedEvent } from "../lib/dedupe/ingest";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const clientId = process.env.STUBHUB_CLIENT_ID;
  const clientSecret = process.env.STUBHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("[stubhub] STUBHUB_CLIENT_ID / STUBHUB_CLIENT_SECRET not set — skipping");
    process.exit(0);
  }

  if (DRY_RUN) console.log("[stubhub] DRY RUN — no DB writes");

  const client = new StubHubClient(clientId, clientSecret);

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

  for await (const ev of client.mexicoConcerts(200)) {
    stats.fetched++;
    const normalized = normalizeStubHubEvent(ev);
    if (!normalized) { stats.skipped++; continue; }

    if (DRY_RUN) {
      console.log(
        `[stubhub] would ingest: "${normalized.title}" (${normalized.cityName}, ${normalized.date.toISOString().slice(0, 10)})`
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
        `[stubhub] error for event ${ev.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.log(
    `[stubhub] done. fetched=${stats.fetched} skipped=${stats.skipped} ` +
    `created=${stats.created} merged=${stats.merged} ambiguous=${stats.ambiguous} ` +
    `tribute_rejected=${stats.tribute_rejected} unknown_city=${stats.unknown_city} errors=${stats.errors}`
  );
}

main().catch((err) => {
  console.error("[stubhub] fatal:", err);
  process.exit(1);
});
