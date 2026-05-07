import { query } from "@/lib/db";
import type { HomeEvent } from "@/lib/queries/home";

export async function searchEvents(q: string, limit = 48): Promise<HomeEvent[]> {
  const term = `%${q}%`;
  return query<HomeEvent>(
    `
    SELECT
      e.id, e.slug, e.title, e.date, e.image_url,
      a.name  AS artist_name, a.slug AS artist_slug,
      v.name  AS venue_name,
      c.name  AS city_name,  c.slug AS city_slug,
      (SELECT MIN(ps.min_price)
       FROM event_sources es
       JOIN price_snapshots ps ON ps.event_source_id = es.id
       WHERE es.event_id = e.id AND NOT ps.is_sold_out
      ) AS min_price,
      (SELECT COUNT(*)::int FROM event_sources WHERE event_id = e.id) AS source_count
    FROM events e
    LEFT JOIN artists a ON e.artist_id = a.id
    LEFT JOIN venues  v ON e.venue_id  = v.id
    LEFT JOIN cities  c ON e.city_id   = c.id
    WHERE e.status = 'active'
      AND e.date > NOW()
      AND (
        e.title    ILIKE $1 OR
        a.name     ILIKE $1 OR
        c.name     ILIKE $1 OR
        v.name     ILIKE $1
      )
    ORDER BY e.date ASC
    LIMIT $2
    `,
    [term, limit],
  );
}
