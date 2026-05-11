import { query, queryOne } from "@/lib/db";

export interface EventPageEvent {
  id: string;
  slug: string;
  title: string;
  date: string;
  status: string;
  tier: string;
  content_status: string;
  seo_title: string | null;
  seo_description: string | null;
  description_es: string | null;
  context_text: string | null;
  image_url: string | null;
  h1_title: string | null;
  faq_json: unknown;
  artist_id: string | null;
  artist_name: string | null;
  artist_slug: string | null;
  artist_image_url: string | null;
  artist_genres: string[] | null;
  artist_popularity: number | null;
  artist_spotify_id: string | null;
  venue_id: string | null;
  venue_name: string | null;
  venue_slug: string | null;
  venue_address: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
  city_name: string | null;
  city_slug: string | null;
}

export interface EventSource {
  id: string;
  platform: string;
  url: string;
  affiliate_url: string | null;
  is_resale: boolean;
  min_price: number | null;
  max_price: number | null;
  currency: string | null;
  is_sold_out: boolean;
  snapped_at: string | null;
}

export interface OtherDate {
  id: string;
  slug: string;
  title: string;
  date: string;
  venue_name: string | null;
  city_name: string | null;
  image_url: string | null;
  min_price: number | null;
  source_count: number;
}

export async function getEventBySlug(slug: string): Promise<EventPageEvent | null> {
  return queryOne<EventPageEvent>(`
    SELECT
      e.id, e.slug, e.title, e.date, e.status, e.tier, e.content_status,
      e.seo_title, e.seo_description, e.description_es, e.context_text,
      e.image_url, e.h1_title, e.faq_json,
      e.artist_id,
      a.name        AS artist_name,      a.slug        AS artist_slug,
      a.image_url   AS artist_image_url, a.genres      AS artist_genres,
      a.popularity  AS artist_popularity, a.spotify_id  AS artist_spotify_id,
      e.venue_id,
      v.name        AS venue_name, v.slug    AS venue_slug,
      v.address     AS venue_address,
      v.lat         AS venue_lat,  v.lng     AS venue_lng,
      c.name        AS city_name,  c.slug    AS city_slug
    FROM events e
    LEFT JOIN artists a ON e.artist_id = a.id
    LEFT JOIN venues  v ON e.venue_id  = v.id
    LEFT JOIN cities  c ON e.city_id   = c.id
    WHERE e.slug = $1
  `, [slug]);
}

export async function getEventSources(eventId: string): Promise<EventSource[]> {
  return query<EventSource>(`
    SELECT
      es.id, es.platform, es.url, es.affiliate_url, es.is_resale,
      latest.min_price, latest.max_price, latest.currency,
      latest.is_sold_out, latest.snapped_at
    FROM event_sources es
    LEFT JOIN LATERAL (
      SELECT min_price, max_price, currency, is_sold_out, snapped_at
      FROM price_snapshots
      WHERE event_source_id = es.id
      ORDER BY snapped_at DESC
      LIMIT 1
    ) latest ON true
    WHERE es.event_id = $1
    ORDER BY latest.min_price ASC NULLS LAST
  `, [eventId]);
}

export async function getArtistOtherDates(
  artistId: string,
  excludeSlug: string,
): Promise<OtherDate[]> {
  return query<OtherDate>(`
    SELECT
      e.id, e.slug, e.title, e.date,
      e.image_url,
      v.name AS venue_name,
      c.name AS city_name,
      agg.min_price,
      agg.source_count
    FROM events e
    LEFT JOIN venues v ON e.venue_id = v.id
    LEFT JOIN cities c ON e.city_id  = c.id
    LEFT JOIN LATERAL (
      SELECT
        MIN(latest.min_price) AS min_price,
        COUNT(*)::int        AS source_count
      FROM event_sources es
      LEFT JOIN LATERAL (
        SELECT min_price
        FROM price_snapshots
        WHERE event_source_id = es.id
        ORDER BY snapped_at DESC
        LIMIT 1
      ) latest ON true
      WHERE es.event_id = e.id
    ) agg ON true
    WHERE e.artist_id = $1
      AND e.slug != $2
      AND e.date > NOW()
      AND e.status IN ('active', 'sold_out')
      AND e.content_status = 'published'
      AND EXISTS (
        SELECT 1 FROM event_sources es WHERE es.event_id = e.id
      )
    ORDER BY e.date ASC
    LIMIT 6
  `, [artistId, excludeSlug]);
}

