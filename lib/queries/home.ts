import { query } from "@/lib/db";

export interface HomeEvent {
  id: string;
  slug: string;
  title: string;
  date: string;
  image_url: string | null;
  artist_name: string | null;
  artist_slug: string | null;
  venue_name: string | null;
  city_name: string | null;
  city_slug: string | null;
  min_price: number | null;
  source_count: number;
}

export interface HomeCity {
  id: string;
  name: string;
  slug: string;
  lat: number | null;
  lng: number | null;
  event_count: number;
}

export async function getTier1UpcomingEvents(limit = 8): Promise<HomeEvent[]> {
  return query<HomeEvent>(`
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
    WHERE e.tier = 'tier1'
      AND e.status = 'active'
      AND e.date > NOW()
    ORDER BY e.date ASC
    LIMIT $1
  `, [limit]);
}

export async function getThisWeekEvents(limit = 6): Promise<HomeEvent[]> {
  return query<HomeEvent>(`
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
      AND e.date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
    ORDER BY e.date ASC
    LIMIT $1
  `, [limit]);
}

export async function getTier1Cities(): Promise<HomeCity[]> {
  return query<HomeCity>(`
    SELECT
      c.id, c.name, c.slug, c.lat, c.lng,
      COUNT(e.id)::int AS event_count
    FROM cities c
    LEFT JOIN events e ON e.city_id = c.id
      AND e.status = 'active'
      AND e.date > NOW()
    WHERE c.tier = 1
    GROUP BY c.id
    ORDER BY event_count DESC
  `);
}

export async function getTopGenres(limit = 12): Promise<string[]> {
  const rows = await query<{ genre: string }>(`
    SELECT unnest(a.genres) AS genre, COUNT(*) AS cnt
    FROM artists a
    JOIN events e ON e.artist_id = a.id
    WHERE e.status = 'active'
      AND e.date > NOW()
      AND a.genres IS NOT NULL
    GROUP BY genre
    ORDER BY cnt DESC
    LIMIT $1
  `, [limit]);
  return rows.map(r => r.genre);
}
