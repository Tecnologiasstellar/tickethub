import { buildAffiliateUrl } from "../lib/affiliate";

class AssertionError extends Error {}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new AssertionError(msg);
}

interface TestCase {
  name: string;
  run: () => void;
}
const cases: TestCase[] = [];
function test(name: string, run: () => void) {
  cases.push({ name, run });
}

test("eventbrite: appends aff=tickethub", () => {
  const out = buildAffiliateUrl("https://www.eventbrite.com/e/123", "eventbrite");
  const u = new URL(out);
  assert(u.searchParams.get("aff") === "tickethub", `aff missing: ${out}`);
});

test("ticketmaster: appends utm_source/medium/campaign", () => {
  const out = buildAffiliateUrl(
    "https://www.ticketmaster.com.mx/event/abc",
    "ticketmaster",
  );
  const u = new URL(out);
  assert(u.searchParams.get("utm_source") === "tickethub", `utm_source: ${out}`);
  assert(u.searchParams.get("utm_medium") === "aff", `utm_medium: ${out}`);
  assert(u.searchParams.get("utm_campaign") === "mx", `utm_campaign: ${out}`);
});

test("stubhub: appends utm_source/medium=affiliate", () => {
  const out = buildAffiliateUrl("https://www.stubhub.com/event/42", "stubhub");
  const u = new URL(out);
  assert(u.searchParams.get("utm_source") === "tickethub", `utm_source: ${out}`);
  assert(u.searchParams.get("utm_medium") === "affiliate", `utm_medium: ${out}`);
});

test("boletia: appends ref=tickethub", () => {
  const out = buildAffiliateUrl("https://boletia.com/e/foo", "boletia");
  assert(new URL(out).searchParams.get("ref") === "tickethub", `ref: ${out}`);
});

test("superboletos: appends ref=tickethub", () => {
  const out = buildAffiliateUrl(
    "https://www.superboletos.com/evento/x",
    "superboletos",
  );
  assert(
    new URL(out).searchParams.get("ref") === "tickethub",
    `ref: ${out}`,
  );
});

test("default: unknown platform falls back to ref=tickethub", () => {
  const out = buildAffiliateUrl("https://example.com/e", "manual");
  assert(new URL(out).searchParams.get("ref") === "tickethub", `ref: ${out}`);
});

test("preserves existing query params", () => {
  const out = buildAffiliateUrl(
    "https://www.eventbrite.com/e/123?foo=bar",
    "eventbrite",
  );
  const u = new URL(out);
  assert(u.searchParams.get("foo") === "bar", `foo lost: ${out}`);
  assert(u.searchParams.get("aff") === "tickethub", `aff missing: ${out}`);
});

test("invalid URL returns input unchanged", () => {
  const out = buildAffiliateUrl("not a url", "eventbrite");
  assert(out === "not a url", `mutated invalid url: ${out}`);
});

let failed = 0;
for (const c of cases) {
  try {
    c.run();
    console.log(`  ok  ${c.name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL  ${c.name}`);
    console.error(`        ${(err as Error).message}`);
  }
}
console.log(
  `\n${cases.length - failed}/${cases.length} passed${failed ? ` (${failed} failed)` : ""}`,
);
process.exit(failed ? 1 : 0);
