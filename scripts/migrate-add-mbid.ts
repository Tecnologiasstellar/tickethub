import { query } from "../lib/db";

async function main() {
  await query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'artists' AND column_name = 'mbid'
      ) THEN
        ALTER TABLE artists ADD COLUMN mbid TEXT UNIQUE;
      END IF;
    END $$
  `);
  console.log("[migrate] mbid column ensured on artists table");
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
