import { EventbriteClient } from "../lib/api/eventbrite/client";
import { normalizeEventbriteEvent } from "../lib/api/eventbrite/normalizer";
import { SongkickClient } from "../lib/api/songkick/client";
import { normalizeSongkickEvent } from "../lib/api/songkick/normalizer";
import { StubHubClient } from "../lib/api/stubhub/client";
import { normalizeStubHubEvent } from "../lib/api/stubhub/normalizer";
import { runApiSource, statsLine, type SourceStats } from "../lib/ingest/run-api-source";

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = parseInt(
  process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "500",
  10
);

function mergeStats(a: SourceStats, b: SourceStats): SourceStats {
  return {
    fetched:          a.fetched          + b.fetched,
    skipped:          a.skipped          + b.skipped,
    created:          a.created          + b.created,
    merged:           a.merged           + b.merged,
    ambiguous:        a.ambiguous        + b.ambiguous,
    tribute_rejected: a.tribute_rejected + b.tribute_rejected,
    unknown_city:     a.unknown_city     + b.unknown_city,
    errors:           a.errors           + b.errors,
  };
}

async function main() {
  if (DRY_RUN) console.log("[ingest-events] DRY RUN — no DB writes");
  console.log(`[ingest-events] limit per source: ${LIMIT}`);

  let total: SourceStats = {
    fetched: 0, skipped: 0, created: 0, merged: 0,
    ambiguous: 0, tribute_rejected: 0, unknown_city: 0, errors: 0,
  };

  // ─── Eventbrite ────────────────────────────────────────────────
  {
    const client = new EventbriteClient();
    const stats = await runApiSource({
      tag: "eventbrite",
      events: client.allMexicoEvents(),
      normalize: normalizeEventbriteEvent,
      limit: LIMIT,
      dryRun: DRY_RUN,
    });
    console.log(statsLine("eventbrite", stats));
    total = mergeStats(total, stats);
  }

  // ─── Songkick ──────────────────────────────────────────────────
  const skKey = process.env.SONGKICK_API_KEY;
  if (skKey) {
    const client = new SongkickClient(skKey);
    const stats = await runApiSource({
      tag: "songkick",
      events: client.allMexicoEvents(),
      normalize: normalizeSongkickEvent,
      limit: LIMIT,
      dryRun: DRY_RUN,
    });
    console.log(statsLine("songkick", stats));
    total = mergeStats(total, stats);
  } else {
    console.warn("[ingest-events] SONGKICK_API_KEY not set — skipping");
  }

  // ─── StubHub ───────────────────────────────────────────────────
  const shId = process.env.STUBHUB_CLIENT_ID;
  const shSecret = process.env.STUBHUB_CLIENT_SECRET;
  if (shId && shSecret) {
    const client = new StubHubClient(shId, shSecret);
    const stats = await runApiSource({
      tag: "stubhub",
      events: client.mexicoConcerts(LIMIT),
      normalize: normalizeStubHubEvent,
      limit: LIMIT,
      dryRun: DRY_RUN,
    });
    console.log(statsLine("stubhub", stats));
    total = mergeStats(total, stats);
  } else {
    console.warn("[ingest-events] STUBHUB_CLIENT_ID / STUBHUB_CLIENT_SECRET not set — skipping");
  }

  console.log("──────────────────────────────────────────────────");
  console.log(statsLine("TOTAL", total));
}

main().catch((err) => {
  console.error("[ingest-events] fatal:", err);
  process.exit(1);
});
