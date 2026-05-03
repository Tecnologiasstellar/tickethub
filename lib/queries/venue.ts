import { query, queryOne } from "@/lib/db";

export interface VenuePageVenue {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  capacity: number | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
  description_es: string | null;
  city_id: string | null;
  city_name: string | null;
  city_slug: string | null;
}

export interface VenueEvent {
  id: string;
  slug: string;
  title: string;
  date: string;
  image_url: string | null;
  artist_name: string | null;
  artist_slug: string | null;
  min_price: number | null;
  source_count: number;
}

export async function getVenueBySlug(slug: string): Promise<VenuePageVenue | null> {
  return queryOne<VenuePageVenue>(`
    SELECT
      v.id, v.name, v.slug, v.address, v.capacity, v.lat, v.lng,
      v.image_url, v.description_es, v.city_id,
      c.name AS city_name, c.slug AS city_slug
    FROM venues v
    LEFT JOIN cities c ON v.city_id = c.id
    WHERE v.slug = $1
  `, [slug]);
}

export async function getVenueUpcomingEvents(venueId: string): Promise<VenueEvent[]> {
  return query<VenueEvent>(`
    SELECT
      e.id, e.slug, e.title, e.date, e.image_url,
      a.name AS artist_name, a.slug AS artist_slug,
      (SELECT MIN(ps.min_price)
       FROM event_sources es
       JOIN price_snapshots ps ON ps.event_source_id = es.id
       WHERE es.event_id = e.id AND NOT ps.is_sold_out
      ) AS min_price,
      (SELECT COUNT(*)::int FROM event_sources WHERE event_id = e.id) AS source_count
    FROM events e
    LEFT JOIN artists a ON e.artist_id = a.id
    WHERE e.venue_id = $1
      AND e.status = 'active'
      AND e.date > NOW()
    ORDER BY e.date ASC
  `, [venueId]);
}

export async function getVenuePastEvents(venueId: string, limit = 10): Promise<VenueEvent[]> {
  return query<VenueEvent>(`
    SELECT
      e.id, e.slug, e.title, e.date, e.image_url,
      a.name AS artist_name, a.slug AS artist_slug,
      (SELECT MIN(ps.min_price)
       FROM event_sources es
       JOIN price_snapshots ps ON ps.event_source_id = es.id
       WHERE es.event_id = e.id
      ) AS min_price,
      (SELECT COUNT(*)::int FROM event_sources WHERE event_id = e.id) AS source_count
    FROM events e
    LEFT JOIN artists a ON e.artist_id = a.id
    WHERE e.venue_id = $1
      AND e.date <= NOW()
    ORDER BY e.date DESC
    LIMIT $2
  `, [venueId, limit]);
}
