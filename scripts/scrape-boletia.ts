import { runBoletiaScrape } from "../lib/scrape/boletia";
import { query } from "../lib/db";

async function main() {
  console.log("[scrape-boletia] launching browser…");
  const result = await runBoletiaScrape();

  console.log(
    `\nProcesados: ${result.processed} | Guardados: ${result.created} | Saltados: ${result.skipped}`
  );
  if (Object.keys(result.skipReasons).length) {
    console.log("Skip reasons:", result.skipReasons);
  }

  const all = await query<{ title: string; url: string }>(
    `SELECT e.title, es.url
     FROM events e
     JOIN event_sources es ON es.event_id = e.id
     WHERE es.platform = 'boletia'
     ORDER BY e.created_at DESC`
  );
  console.log(`\nTotal boletia events in DB: ${all.length}`);
  for (const row of all) console.log(`  ${row.title}\n    → ${row.url}`);
}

main().catch((err) => {
  console.error("[scrape-boletia] fatal:", err);
  process.exit(1);
});
