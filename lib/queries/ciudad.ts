import { query, queryOne } from "@/lib/db";
import type { CityRow } from "@/lib/types";

export interface CityEvent {
  id: string;
  slug: string;
  title: string;
  date: string;
  image_url: string | null;
  artist_name: string | null;
  artist_slug: string | null;
  artist_genres: string[] | null;
  venue_name: string | null;
  venue_slug: string | null;
  min_price: number | null;
  source_count: number;
}

export interface CityVenue {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  capacity: number | null;
  lat: number | null;
  lng: number | null;
  upcoming_count: number;
}

export async function getCityBySlug(slug: string): Promise<CityRow | null> {
  return queryOne<CityRow>(`SELECT * FROM cities WHERE slug = $1`, [slug]);
}

export async function getCityUpcomingEvents(cityId: string): Promise<CityEvent[]> {
  return query<CityEvent>(`
    SELECT
      e.id, e.slug, e.title, e.date,
      COALESCE(e.image_url, a.image_url) AS image_url,
      a.name   AS artist_name, a.slug   AS artist_slug,
      a.genres AS artist_genres,
      v.name   AS venue_name,  v.slug   AS venue_slug,
      (SELECT MIN(ps.min_price)
       FROM event_sources es
       JOIN price_snapshots ps ON ps.event_source_id = es.id
       WHERE es.event_id = e.id AND NOT ps.is_sold_out
      ) AS min_price,
      (SELECT COUNT(*)::int FROM event_sources WHERE event_id = e.id) AS source_count
    FROM events e
    LEFT JOIN artists a ON e.artist_id = a.id
    LEFT JOIN venues  v ON e.venue_id  = v.id
    WHERE e.city_id = $1
      AND e.status IN ('active', 'sold_out')
      AND e.content_status = 'published'
      AND e.date > NOW()
      AND EXISTS (
        SELECT 1 FROM event_sources es WHERE es.event_id = e.id
      )
    ORDER BY e.date ASC
  `, [cityId]);
}

export async function getCityVenues(cityId: string): Promise<CityVenue[]> {
  return query<CityVenue>(`
    SELECT
      v.id, v.name, v.slug, v.address, v.capacity, v.lat, v.lng,
      COUNT(e.id)::int AS upcoming_count
    FROM venues v
    LEFT JOIN events e ON e.venue_id = v.id
      AND e.status IN ('active', 'sold_out')
      AND e.content_status = 'published'
      AND e.date > NOW()
      AND EXISTS (
        SELECT 1 FROM event_sources es WHERE es.event_id = e.id
      )
    WHERE v.city_id = $1
    GROUP BY v.id
    ORDER BY upcoming_count DESC, v.capacity DESC NULLS LAST
  `, [cityId]);
}

