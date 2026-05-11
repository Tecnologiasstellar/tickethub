import { query } from "@/lib/db";

export interface SearchResult {
  id: string;
  slug: string;
  title: string;
  date: string;
  image_url: string | null;
  artist_name: string | null;
  venue_name: string | null;
  city_name: string | null;
  min_price: number | null;
  source_count: number;
}

export async function searchEvents(q: string): Promise<SearchResult[]> {
  const term = q.trim();
  if (!term) return [];

  return query<SearchResult>(
    `
    SELECT
      e.id, e.slug, e.title, e.date,
      COALESCE(e.image_url, a.image_url) AS image_url,
      a.name AS artist_name,
      v.name AS venue_name,
      c.name AS city_name,
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
    WHERE e.title ILIKE $1
       OR a.name  ILIKE $1
       OR c.name  ILIKE $1
       OR v.name  ILIKE $1
    ORDER BY e.date ASC
    LIMIT 20
    `,
    [`%${term}%`],
  );
}
