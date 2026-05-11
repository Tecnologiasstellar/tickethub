import { TicketmasterClient } from "../lib/api/ticketmaster/client";
import { tmEventToNormalized } from "../lib/api/ticketmaster/enricher";

async function main() {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    console.error("[test-ticketmaster] TICKETMASTER_API_KEY not set");
    process.exit(1);
  }

  const client = new TicketmasterClient(apiKey);

  let inspected = 0;
  let normalizable = 0;
  const SAMPLE = 5;

  console.log(`[test-ticketmaster] inspecting first ${SAMPLE} normalizable events (no DB writes)\n`);

  for await (const ev of client.mexicoMusicEvents(50)) {
    inspected++;
    const n = tmEventToNormalized(ev);
    if (!n) continue;
    normalizable++;

    console.log(`#${normalizable} ${n.title}`);
    console.log(`  artist : ${n.artistName}`);
    console.log(`  city   : ${n.cityName}`);
    console.log(`  venue  : ${n.venueName}`);
    console.log(`  date   : ${n.date.toISOString()}`);
    console.log(`  price  : ${n.minPrice ?? "?"} - ${n.maxPrice ?? "?"} ${n.currency ?? ""}`);
    console.log(`  raw url: ${ev.url}`);
    console.log(`  utm url: ${n.url}`);

    const hasUtm = n.url.includes("utm_source=tickethub");
    const isTmHost = /ticketmaster\.com(?:\.mx)?\//.test(n.url);
    console.log(`  ✓ utm   : ${hasUtm ? "yes" : "NO"}`);
    console.log(`  ✓ host  : ${isTmHost ? "ticketmaster.com[.mx]" : "OTHER (" + new URL(n.url).host + ")"}\n`);

    if (normalizable >= SAMPLE) break;
  }

  console.log(`[test-ticketmaster] inspected=${inspected} normalizable=${normalizable}`);
  if (normalizable < SAMPLE) {
    console.warn(`[test-ticketmaster] WARNING: fewer than ${SAMPLE} normalizable events in first batch`);
  }
}

main().catch((err) => {
  console.error("[test-ticketmaster] fatal:", err);
  process.exit(1);
});
