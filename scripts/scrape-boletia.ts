import { runBoletiaScrape } from "../lib/scrape/boletia";
import { query } from "../lib/db";
import { loadCheckpoint, markDone, clearCheckpoint } from "../lib/utils/checkpoint";

const DRY_RUN = process.argv.includes("--dry-run");
const RESET = process.argv.includes("--reset");
const CHECKPOINT_FILE = ".checkpoints/scrape-boletia.json";

async function main() {
  if (DRY_RUN) console.log("[scrape-boletia] DRY RUN — no DB writes");
  if (RESET) {
    await clearCheckpoint(CHECKPOINT_FILE);
    console.log("[scrape-boletia] checkpoint reset");
  }
  const done = await loadCheckpoint(CHECKPOINT_FILE);
  if (done.size) console.log(`[scrape-boletia] ${done.size} already completed, will skip`);

  console.log("[scrape-boletia] launching browser…");
  const result = await runBoletiaScrape({
    dryRun: DRY_RUN,
    skipIds: done,
    onDone: (id) => markDone(CHECKPOINT_FILE, id),
  });

  console.log(
    `\nProcesados: ${result.processed} | Guardados: ${result.created} | Saltados: ${result.skipped}`
  );
  if (Object.keys(result.skipReasons).length) {
    console.log("Skip reasons:", result.skipReasons);
  }

  if (!DRY_RUN) {
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
}

main().catch((err) => {
  console.error("[scrape-boletia] fatal:", err);
  process.exit(1);
});
