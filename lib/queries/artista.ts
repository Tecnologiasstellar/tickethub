import { query, queryOne } from "@/lib/db";
import type { ArtistRow } from "@/lib/types";

export interface ArtistUpcomingEvent {
  id: string;
  slug: string;
  title: string;
  date: string;
  venue_name: string | null;
  city_name: string | null;
  city_slug: string | null;
  min_price: number | null;
  source_count: number;
}

export interface ArtistSetlist {
  id: string;
  event_date: string | null;
  venue_name: string | null;
  city_name: string | null;
  country: string | null;
  songs: Array<{ name: string; position?: number }>;
  source_url: string | null;
}

export interface SimilarArtist {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  genres: string[] | null;
  upcoming_count: number;
}

export async function getArtistBySlug(slug: string): Promise<ArtistRow | null> {
  return queryOne<ArtistRow>(`SELECT * FROM artists WHERE slug = $1`, [slug]);
}

export async function getArtistUpcomingEvents(artistId: string): Promise<ArtistUpcomingEvent[]> {
  return query<ArtistUpcomingEvent>(`
    SELECT
      e.id, e.slug, e.title, e.date,
      v.name AS venue_name,
      c.name AS city_name, c.slug AS city_slug,
      (SELECT MIN(ps.min_price)
       FROM event_sources es
       JOIN price_snapshots ps ON ps.event_source_id = es.id
       WHERE es.event_id = e.id AND NOT ps.is_sold_out
      ) AS min_price,
      (SELECT COUNT(*)::int FROM event_sources WHERE event_id = e.id) AS source_count
    FROM events e
    LEFT JOIN venues v ON e.venue_id = v.id
    LEFT JOIN cities c ON e.city_id  = c.id
    WHERE e.artist_id = $1
      AND e.date > NOW()
      AND e.status = 'active'
    ORDER BY e.date ASC
  `, [artistId]);
}

export async function getArtistSetlists(artistId: string, limit = 5): Promise<ArtistSetlist[]> {
  return query<ArtistSetlist>(`
    SELECT id, event_date, venue_name, city_name, country, songs, source_url
    FROM setlists
    WHERE artist_id = $1
    ORDER BY event_date DESC
    LIMIT $2
  `, [artistId, limit]);
}

export async function getSimilarArtists(
  artistId: string,
  genres: string[],
  limit = 6,
): Promise<SimilarArtist[]> {
  if (!genres.length) return [];
  return query<SimilarArtist>(`
    SELECT
      a.id, a.name, a.slug, a.image_url, a.genres,
      COUNT(e.id)::int AS upcoming_count
    FROM artists a
    LEFT JOIN events e ON e.artist_id = a.id
      AND e.status = 'active'
      AND e.date > NOW()
    WHERE a.id != $1
      AND a.genres && $2
    GROUP BY a.id
    ORDER BY upcoming_count DESC, a.popularity DESC NULLS LAST
    LIMIT $3
  `, [artistId, genres, limit]);
}
