import { query } from "../lib/db";

async function main() {
  console.log("[migrate] adding h1_title and faq_json columns to events...");

  await query(`
    ALTER TABLE events
      ADD COLUMN IF NOT EXISTS h1_title  TEXT,
      ADD COLUMN IF NOT EXISTS faq_json  JSONB
  `);

  console.log("[migrate] done.");
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
