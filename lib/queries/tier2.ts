import slugify from "slugify";
import { query } from "@/lib/db";

// Shared event card shape reused across tier2 listing pages
export interface Tier2ListingEvent {
  id: string;
  slug: string;
  title: string;
  date: string;
  image_url: string | null;
  artist_name: string | null;
  artist_slug: string | null;
  venue_name: string | null;
  venue_slug: string | null;
  city_name: string | null;
  city_slug: string | null;
  min_price: number | null;
  source_count: number;
}

// ── generateStaticParams helpers ──────────────────────────────────────────────

/** All published events (tier1 + tier2) for generateStaticParams. */
export async function getAllPublishedEventSlugs(): Promise<{ slug: string }[]> {
  return query<{ slug: string }>(`
    SELECT slug
    FROM events
    WHERE content_status = 'published'
      AND status IN ('active', 'sold_out')
    ORDER BY date DESC
  `);
}

/** All published artists that have at least one upcoming active event. */
export async function getAllPublishedArtistSlugs(): Promise<{ slug: string }[]> {
  return query<{ slug: string }>(`
    SELECT DISTINCT a.slug
    FROM artists a
    JOIN events e ON e.artist_id = a.id
    WHERE a.content_status = 'published'
      AND e.status = 'active'
      AND e.date > NOW()
    ORDER BY a.slug
  `);
}

/** All cities that have at least one upcoming active event. */
export async function getAllCitySlugsWithEvents(): Promise<{ slug: string }[]> {
  return query<{ slug: string }>(`
    SELECT DISTINCT c.slug
    FROM cities c
    JOIN events e ON e.city_id = c.id
    WHERE e.status = 'active'
      AND e.date > NOW()
    ORDER BY c.slug
  `);
}

/** All published venues that have at least one upcoming active event. */
export async function getAllVenueSlugsWithEvents(): Promise<{ slug: string }[]> {
  return query<{ slug: string }>(`
    SELECT DISTINCT v.slug
    FROM venues v
    JOIN events e ON e.venue_id = v.id
    WHERE v.content_status = 'published'
      AND e.status = 'active'
      AND e.date > NOW()
    ORDER BY v.slug
  `);
}

// ── City + month ──────────────────────────────────────────────────────────────

export interface CityMonthCombo {
  citySlug: string;
  mes: string; // YYYY-MM
}

/**
 * All future city+month combinations that have at least one active event.
 * Used for generateStaticParams and the sitemap.
 */
export async function getAllCityMonthCombos(): Promise<CityMonthCombo[]> {
  const rows = await query<{ city_slug: string; mes: string }>(`
    SELECT DISTINCT
      c.slug           AS city_slug,
      TO_CHAR(e.date, 'YYYY-MM') AS mes
    FROM events e
    JOIN cities c ON e.city_id = c.id
    WHERE e.status = 'active'
      AND e.date > NOW()
    ORDER BY mes ASC, city_slug ASC
  `);
  return rows.map((r) => ({ citySlug: r.city_slug, mes: r.mes }));
}

/**
 * Events in a specific city during a specific month.
 * `mes` is a YYYY-MM string, e.g. "2025-03".
 */
export async function getCityMonthEvents(
  citySlug: string,
  mes: string,
): Promise<Tier2ListingEvent[]> {
  return query<Tier2ListingEvent>(
    `
    SELECT
      e.id, e.slug, e.title, e.date,
      COALESCE(e.image_url, a.image_url) AS image_url,
      a.name AS artist_name, a.slug AS artist_slug,
      v.name AS venue_name, v.slug AS venue_slug,
      c.name AS city_name, c.slug AS city_slug,
      (SELECT MIN(ps.min_price)
       FROM event_sources es
       JOIN price_snapshots ps ON ps.event_source_id = es.id
       WHERE es.event_id = e.id AND NOT ps.is_sold_out
      ) AS min_price,
      (SELECT COUNT(*)::int FROM event_sources WHERE event_id = e.id) AS source_count
    FROM events e
    JOIN cities  c ON e.city_id   = c.id
    LEFT JOIN artists a ON e.artist_id = a.id
    LEFT JOIN venues  v ON e.venue_id  = v.id
    WHERE c.slug = $1
      AND TO_CHAR(e.date, 'YYYY-MM') = $2
      AND e.status = 'active'
    ORDER BY e.date ASC
  `,
    [citySlug, mes],
  );
}

// ── Genres ────────────────────────────────────────────────────────────────────

export interface GenreMeta {
  name: string;
  slug: string;
  event_count: number;
}

/** All genres that have at least one upcoming active event, with their URL slug. */
export async function getAllActiveGenres(): Promise<GenreMeta[]> {
  const rows = await query<{ genre: string; event_count: number }>(`
    SELECT
      unnest(a.genres)       AS genre,
      COUNT(DISTINCT e.id)::int AS event_count
    FROM artists a
    JOIN events e ON e.artist_id = a.id
    WHERE e.status = 'active'
      AND e.date > NOW()
      AND a.genres IS NOT NULL
      AND cardinality(a.genres) > 0
    GROUP BY genre
    ORDER BY event_count DESC
  `);
  return rows.map((r) => ({
    name: r.genre,
    slug: slugify(r.genre, { lower: true, strict: true }),
    event_count: r.event_count,
  }));
}

/**
 * Find genre metadata by URL slug.
 * Returns null if no upcoming events exist for this genre.
 */
export async function getGenreBySlug(genreSlug: string): Promise<GenreMeta | null> {
  // Slugs are computed in JS (slugify can't run in Postgres), so we fetch all and match.
  const genres = await getAllActiveGenres();
  return genres.find((g) => g.slug === genreSlug) ?? null;
}

/**
 * Upcoming events for a genre slug.
 * Resolves slug → genre name first, then queries events.
 */
export async function getGenreEvents(genreSlug: string): Promise<Tier2ListingEvent[]> {
  const genre = await getGenreBySlug(genreSlug);
  if (!genre) return [];

  return query<Tier2ListingEvent>(
    `
    SELECT
      e.id, e.slug, e.title, e.date,
      COALESCE(e.image_url, a.image_url) AS image_url,
      a.name AS artist_name, a.slug AS artist_slug,
      v.name AS venue_name, v.slug AS venue_slug,
      c.name AS city_name, c.slug AS city_slug,
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
      AND $1 = ANY(a.genres)
    ORDER BY e.date ASC
    LIMIT 60
  `,
    [genre.name],
  );
}

// ── Sitemap helpers ───────────────────────────────────────────────────────────

export interface SitemapSlugRow {
  slug: string;
  updated_at: string;
}

export async function getSitemapEventRows(): Promise<SitemapSlugRow[]> {
  return query<SitemapSlugRow>(`
    SELECT slug, updated_at
    FROM events
    WHERE content_status = 'published'
      AND status IN ('active', 'sold_out')
      AND date > NOW() - INTERVAL '7 days'
    ORDER BY date DESC
  `);
}

export async function getSitemapArtistRows(): Promise<SitemapSlugRow[]> {
  return query<SitemapSlugRow>(`
    SELECT DISTINCT ON (a.slug) a.slug, a.updated_at
    FROM artists a
    JOIN events e ON e.artist_id = a.id
    WHERE a.content_status = 'published'
      AND e.status IN ('active', 'sold_out')
      AND e.date > NOW()
    ORDER BY a.slug
  `);
}

export async function getSitemapCityRows(): Promise<SitemapSlugRow[]> {
  // Cities have no content_status; surface any city that has upcoming active events.
  return query<SitemapSlugRow>(`
    SELECT DISTINCT ON (c.slug) c.slug, c.updated_at
    FROM cities c
    JOIN events e ON e.city_id = c.id
    WHERE e.status IN ('active', 'sold_out')
      AND e.date > NOW()
    ORDER BY c.slug
  `);
}

export async function getSitemapVenueRows(): Promise<SitemapSlugRow[]> {
  return query<SitemapSlugRow>(`
    SELECT DISTINCT ON (v.slug) v.slug, v.updated_at
    FROM venues v
    JOIN events e ON e.venue_id = v.id
    WHERE v.content_status = 'published'
      AND e.status IN ('active', 'sold_out')
      AND e.date > NOW()
    ORDER BY v.slug
  `);
}
