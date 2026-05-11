// scripts/migrate-add-content-cols.ts
import { query } from "../lib/db";

async function main() {
  await query(`
    ALTER TABLE events
      ADD COLUMN IF NOT EXISTS h1_title TEXT,
      ADD COLUMN IF NOT EXISTS faq_json JSONB;
  `);
  console.log("[migrate] added h1_title, faq_json to events — done");
}

main().catch((err) => {
  console.error("[migrate] fatal:", err);
  process.exit(1);
});
