/**
 * Fetch 10 Eventbrite music events in Mexico and print title + URL.
 * No DB writes. Run with:
 *   npx dotenv -e .env.local -- npx tsx scripts/test-eventbrite.ts
 */
import { EventbriteClient } from "../lib/api/eventbrite/client";
import { normalizeEventbriteEvent } from "../lib/api/eventbrite/normalizer";

async function main() {
  const token = process.env.EVENTBRITE_API_KEY;
  if (!token) {
    console.error(
      "[test-eventbrite] EVENTBRITE_API_KEY not set.\n" +
      "Get a free key at: https://www.eventbrite.com/platform/api\n" +
      "Then add to .env.local:  EVENTBRITE_API_KEY=<your_private_token>"
    );
    process.exit(1);
  }

  const client = new EventbriteClient(token);
  const results: Array<{ title: string; url: string }> = [];

  outer: for await (const ev of client.allMexicoEvents()) {
    const normalized = normalizeEventbriteEvent(ev);
    if (!normalized) continue;

    results.push({ title: normalized.title, url: normalized.url });
    if (results.length >= 10) break outer;
  }

  if (results.length === 0) {
    console.log("[test-eventbrite] No events returned. Check your API key and quota.");
    return;
  }

  console.log(`\n[test-eventbrite] ${results.length} events found:\n`);
  for (const { title, url } of results) {
    console.log(`  title: ${title}`);
    console.log(`  url  : ${url}`);
    console.log();
  }
}

main().catch((err) => {
  console.error("[test-eventbrite] fatal:", err);
  process.exit(1);
});
