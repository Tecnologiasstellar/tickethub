import { query } from "../lib/db";
import { buildAffiliateUrl } from "../lib/affiliate";

async function main() {
  await query(
    `ALTER TABLE event_sources ADD COLUMN IF NOT EXISTS affiliate_url TEXT`,
  );
  console.log("[migrate] affiliate_url column ensured on event_sources");

  const rows = await query<{ id: string; platform: string; url: string }>(
    `SELECT id, platform, url FROM event_sources WHERE affiliate_url IS NULL`,
  );
  console.log(`[migrate] backfilling ${rows.length} rows`);
  for (const r of rows) {
    const aff = buildAffiliateUrl(r.url, r.platform);
    await query(
      `UPDATE event_sources SET affiliate_url = $1 WHERE id = $2`,
      [aff, r.id],
    );
  }
  console.log("[migrate] backfill complete");
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
