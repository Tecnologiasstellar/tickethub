import { query } from "../lib/db";

(async () => {
  console.log("\n=== Events with most sources (real ticketing data) ===");
  const r1 = await query(`
    SELECT
      e.slug,
      LEFT(e.title, 60) AS title,
      e.tier,
      e.date::text AS date,
      LEFT(COALESCE(a.name, '—'), 30) AS artist,
      (SELECT count(*) FROM event_sources WHERE event_id = e.id) AS srcs,
      (SELECT array_agg(DISTINCT platform) FROM event_sources WHERE event_id = e.id) AS platforms
    FROM events e
    LEFT JOIN artists a ON e.artist_id = a.id
    WHERE e.date > NOW() AND e.image_url IS NOT NULL
    ORDER BY srcs DESC, e.date ASC
    LIMIT 10
  `);
  console.table(r1);

  console.log("\n=== Tier1 events sorted by date ===");
  const r2 = await query(`
    SELECT e.slug, LEFT(e.title, 60) AS title, e.date::text AS date,
           LEFT(COALESCE(a.name, '—'), 30) AS artist
    FROM events e
    LEFT JOIN artists a ON e.artist_id = a.id
    WHERE e.date > NOW() AND e.tier = 'tier1' AND e.image_url IS NOT NULL
    ORDER BY e.date ASC
    LIMIT 15
  `);
  console.table(r2);
  process.exit(0);
})();
