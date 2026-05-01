import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { query } from "../lib/db";

async function main() {
  const schemaPath = resolve(process.cwd(), "lib/db/schema.sql");
  console.log(`[init-db] reading ${schemaPath}`);
  const sql = await readFile(schemaPath, "utf8");

  console.log("[init-db] executing schema against DATABASE_URL");
  await query(sql);

  const tables = await query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`
  );

  console.log(`[init-db] done. ${tables.length} tables in public schema:`);
  for (const t of tables) console.log(`  - ${t.table_name}`);
}

main().catch((err) => {
  console.error("[init-db] failed:", err);
  process.exit(1);
});
