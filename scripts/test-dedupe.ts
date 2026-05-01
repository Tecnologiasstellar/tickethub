import { query } from "../lib/db";
import { ingestNormalizedEvent } from "../lib/dedupe/ingest";
import type { NormalizedEvent } from "../lib/types";

// All test data is namespaced so it can be wiped before and after the run
// without touching real records. Hero events have neither this slug prefix
// nor this source-id prefix.
const SLUG_PREFIX = "dedupe-test-";
const SOURCE_ID_PREFIX = "__dedupe_test__";

// ─── State helpers ───────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  // Order: events cascade-delete event_sources + price_snapshots (FK).
  // Then drop the test artists / venues we created.
  await query(`DELETE FROM events  WHERE slug LIKE $1`, [`${SLUG_PREFIX}%`]);
  await query(`DELETE FROM artists WHERE slug LIKE $1`, [`${SLUG_PREFIX}%`]);
  await query(`DELETE FROM venues  WHERE slug LIKE $1`, [`${SLUG_PREFIX}%`]);
  // Belt-and-suspenders: any orphan sources from prior failed runs.
  await query(`DELETE FROM event_sources WHERE source_event_id LIKE $1`, [
    `${SOURCE_ID_PREFIX}%`,
  ]);
}

// ─── Test harness ────────────────────────────────────────────────────────────

interface TestCase {
  name: string;
  run: () => Promise<void>;
}

const cases: TestCase[] = [];
function test(name: string, run: () => Promise<void>) {
  cases.push({ name, run });
}

class AssertionError extends Error {}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new AssertionError(msg);
}

// ─── Test events ─────────────────────────────────────────────────────────────
// Use unique artist/venue names per test to avoid cross-contamination via
// shared slug. Dates are far in the future so they never overlap with seeded
// hero events.

const futureIso = (offsetDays: number, hours = 21): string => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() + 5);
  d.setUTCMonth(0, 1 + offsetDays);
  d.setUTCHours(hours, 0, 0, 0);
  return d.toISOString();
};

type EvtInput = Omit<Partial<NormalizedEvent>, "date"> & {
  sourceIdSuffix: string;
  artistName: string;
  venueName: string;
  title: string;
  cityName: string;
  date: string;
};

function evt(partial: EvtInput): NormalizedEvent {
  return {
    sourceId: `${SOURCE_ID_PREFIX}${partial.sourceIdSuffix}`,
    sourcePlatform: partial.sourcePlatform ?? "eventbrite",
    title: partial.title,
    artistName: partial.artistName,
    venueName: partial.venueName,
    cityName: partial.cityName,
    date: new Date(partial.date),
    url: partial.url ?? `https://example.com/${partial.sourceIdSuffix}`,
    minPrice: partial.minPrice,
    maxPrice: partial.maxPrice,
    currency: partial.currency,
    isResale: partial.isResale,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test("exact event from two platforms must merge", async () => {
  const baseDate = futureIso(0);
  const shared = {
    artistName: "Dedupe Test Artist Alpha",
    venueName: "Dedupe Test Venue Alpha",
    cityName: "Ciudad de Mexico",
    title: "Dedupe Test Artist Alpha en Dedupe Test Venue Alpha",
    date: baseDate,
  };
  const a = evt({
    ...shared,
    sourceIdSuffix: "exact-a",
    sourcePlatform: "eventbrite",
    minPrice: 500,
    maxPrice: 1500,
  });
  const b = evt({
    ...shared,
    sourceIdSuffix: "exact-b",
    sourcePlatform: "boletia",
    minPrice: 480,
    maxPrice: 1450,
  });

  const r1 = await ingestNormalizedEvent(a);
  const r2 = await ingestNormalizedEvent(b);

  console.log(`  ${r1.log}`);
  console.log(`  ${r2.log}`);

  assert(r1.action === "created", `first ingest should create, got ${r1.action}`);
  assert(r2.action === "merged", `second ingest should merge, got ${r2.action}`);
  assert(
    r2.eventId === r1.eventId,
    `merged event id must equal first event id`
  );

  const sources = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM event_sources WHERE event_id = $1`,
    [r1.eventId]
  );
  assert(sources[0].count === "2", `expected 2 sources, got ${sources[0].count}`);
});

test("same artist + venue with 1h difference must merge", async () => {
  const baseDate = futureIso(2, 20);
  const oneHourLater = futureIso(2, 21);
  const a = evt({
    sourceIdSuffix: "1h-a",
    sourcePlatform: "songkick",
    artistName: "Dedupe Test Artist Beta",
    venueName: "Dedupe Test Venue Beta",
    cityName: "Guadalajara",
    title: "Dedupe Test Artist Beta — Tour 2030",
    date: baseDate,
  });
  const b = evt({
    ...a,
    sourceIdSuffix: "1h-b",
    sourcePlatform: "ticketmaster",
    title: "Dedupe Test Artist Beta - GDL Show",
    date: oneHourLater,
  });

  const r1 = await ingestNormalizedEvent(a);
  const r2 = await ingestNormalizedEvent(b);

  console.log(`  ${r1.log}`);
  console.log(`  ${r2.log}`);

  assert(r1.action === "created", `first ingest should create, got ${r1.action}`);
  assert(r2.action === "merged", `second ingest should merge, got ${r2.action}`);
  assert(r2.eventId === r1.eventId, "ids must match after merge");
});

test("same artist + same date in different city must not merge", async () => {
  const date = futureIso(4);
  const cdmx = evt({
    sourceIdSuffix: "city-cdmx",
    sourcePlatform: "eventbrite",
    artistName: "Dedupe Test Artist Gamma",
    venueName: "Dedupe Test Venue Gamma CDMX",
    cityName: "Ciudad de Mexico",
    title: "Dedupe Test Artist Gamma en CDMX",
    date,
  });
  const mty = evt({
    sourceIdSuffix: "city-mty",
    sourcePlatform: "boletia",
    artistName: "Dedupe Test Artist Gamma",
    venueName: "Dedupe Test Venue Gamma MTY",
    cityName: "Monterrey",
    title: "Dedupe Test Artist Gamma en Monterrey",
    date,
  });

  const r1 = await ingestNormalizedEvent(cdmx);
  const r2 = await ingestNormalizedEvent(mty);

  console.log(`  ${r1.log}`);
  console.log(`  ${r2.log}`);

  assert(r1.action === "created", `cdmx ingest should create`);
  assert(
    r2.action === "created",
    `mty ingest should create (different city), got ${r2.action}`
  );
  assert(r1.eventId !== r2.eventId, "different cities must not merge");
});

test("tribute act with similar name must not merge with original", async () => {
  // First ingest the canonical artist event.
  const date = futureIso(6);
  const original = evt({
    sourceIdSuffix: "trib-original",
    sourcePlatform: "ticketmaster",
    artistName: "Dedupe Test Artist Delta",
    venueName: "Dedupe Test Venue Delta",
    cityName: "Puebla",
    title: "Dedupe Test Artist Delta en vivo",
    date,
  });
  const tribute = evt({
    sourceIdSuffix: "trib-tribute",
    sourcePlatform: "boletia",
    artistName: "Dedupe Test Artist Delta",
    venueName: "Dedupe Test Venue Delta",
    cityName: "Puebla",
    title: "Tributo a Dedupe Test Artist Delta",
    date,
  });

  const r1 = await ingestNormalizedEvent(original);
  const r2 = await ingestNormalizedEvent(tribute);

  console.log(`  ${r1.log}`);
  console.log(`  ${r2.log}`);

  assert(r1.action === "created", `original should be created`);
  assert(
    r2.action === "rejected_tribute",
    `tribute must be rejected, got ${r2.action}`
  );
});

test("festival with multiple artists must match by festival title", async () => {
  // Two payloads representing the same festival, lineup-style: different
  // headliner reported by each source, but same festival name + venue + date.
  const date = futureIso(8);
  const a = evt({
    sourceIdSuffix: "fest-a",
    sourcePlatform: "eventbrite",
    artistName: "Dedupe Test Headliner One",
    venueName: "Dedupe Test Festival Grounds",
    cityName: "Queretaro",
    title: "Dedupe Test Festival 2030",
    date,
  });
  const b = evt({
    sourceIdSuffix: "fest-b",
    sourcePlatform: "boletia",
    artistName: "Dedupe Test Headliner Two",
    venueName: "Dedupe Test Festival Grounds",
    cityName: "Queretaro",
    title: "Dedupe Test Festival 2030",
    date,
  });

  const r1 = await ingestNormalizedEvent(a);
  const r2 = await ingestNormalizedEvent(b);

  console.log(`  ${r1.log}`);
  console.log(`  ${r2.log}`);

  assert(r1.action === "created", `first festival ingest should create`);
  assert(
    r2.action === "merged",
    `festival should match by title, got ${r2.action}`
  );
  assert(r2.eventId === r1.eventId, "festival ids must match");
});

// ─── Runner ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[test-dedupe] running ${cases.length} cases`);
  console.log(`[test-dedupe] cleaning previous test data`);
  await cleanup();

  let passed = 0;
  let failed = 0;
  const failures: { name: string; err: unknown }[] = [];

  try {
    for (const c of cases) {
      // Each case starts from a clean slate so prior state can never produce
      // a false merge / no-merge.
      await cleanup();
      console.log(`\n→ ${c.name}`);
      try {
        await c.run();
        console.log(`  ✓ ok`);
        passed++;
      } catch (err) {
        failed++;
        failures.push({ name: c.name, err });
        console.log(
          `  ✗ FAIL: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  } finally {
    console.log(`\n[test-dedupe] cleaning up`);
    await cleanup();
  }

  console.log(
    `\n[test-dedupe] summary: ${passed} passed, ${failed} failed, ${cases.length} total`
  );

  if (failed > 0) {
    for (const f of failures) {
      console.error(
        `  - ${f.name}: ${f.err instanceof Error ? f.err.stack : String(f.err)}`
      );
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[test-dedupe] failed:", err);
  process.exit(1);
});
