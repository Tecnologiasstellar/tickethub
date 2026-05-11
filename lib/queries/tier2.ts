import slugify from "slugify";
import { query } from "@/lib/db";

export interface StaticSlug {
  slug: string;
}

export interface SitemapSlugRow {
  slug: string;
  updated_at: string;
}

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

export interface CityMonthCombo {
  slug: string;
  mes: string;
  updated_at: string;
}

export interface GenreMeta {
  name: string;
  slug: string;
  event_count: number;
  updated_at: string;
}

function genreSlug(genre: string): string {
  return slugify(genre, { lower: true, strict: true, locale: "es" });
}

export async function getPublishedEventSlugs(): Promise<StaticSlug[]> {
  return query<StaticSlug>(`
    SELECT e.slug
    FROM events e
    WHERE e.content_status = 'published'
      AND e.status IN ('active', 'sold_out')
      AND e.date > NOW() - INTERVAL '1 day'
      AND EXISTS (
        SELECT 1 FROM event_sources es WHERE es.event_id = e.id
      )
    ORDER BY e.date ASC
  `);
}

export async function getPublishedArtistSlugs(): Promise<StaticSlug[]> {
  return query<StaticSlug>(`
    SELECT DISTINCT a.slug
    FROM artists a
    JOIN events e ON e.artist_id = a.id
    WHERE a.content_status = 'published'
      AND e.content_status = 'published'
      AND e.status IN ('active', 'sold_out')
      AND e.date > NOW()
      AND EXISTS (
        SELECT 1 FROM event_sources es WHERE es.event_id = e.id
      )
    ORDER BY a.slug ASC
  `);
}

export async function getPublishedCitySlugs(): Promise<StaticSlug[]> {
  return query<StaticSlug>(`
    SELECT DISTINCT c.slug
    FROM cities c
    JOIN events e ON e.city_id = c.id
    WHERE e.content_status = 'published'
      AND e.status IN ('active', 'sold_out')
      AND e.date > NOW()
      AND EXISTS (
        SELECT 1 FROM event_sources es WHERE es.event_id = e.id
      )
    ORDER BY c.slug ASC
  `);
}

export async function getPublishedVenueSlugs(): Promise<StaticSlug[]> {
  return query<StaticSlug>(`
    SELECT DISTINCT v.slug
    FROM venues v
    JOIN events e ON e.venue_id = v.id
    WHERE v.content_status = 'published'
      AND e.content_status = 'published'
      AND e.status IN ('active', 'sold_out')
      AND e.date > NOW()
      AND EXISTS (
        SELECT 1 FROM event_sources es WHERE es.event_id = e.id
      )
    ORDER BY v.slug ASC
  `);
}

export async function getPublishedCityMonthCombos(): Promise<CityMonthCombo[]> {
  const rows = await query<{
    slug: string;
    mes: string;
    updated_at: string;
  }>(`
    SELECT
      c.slug AS slug,
      TO_CHAR(DATE_TRUNC('month', e.date), 'YYYY-MM') AS mes,
      MAX(e.updated_at)::text AS updated_at
    FROM events e
    JOIN cities c ON e.city_id = c.id
    WHERE e.content_status = 'published'
      AND e.status IN ('active', 'sold_out')
      AND e.date > NOW()
      AND EXISTS (
        SELECT 1 FROM event_sources es WHERE es.event_id = e.id
      )
    GROUP BY c.slug, DATE_TRUNC('month', e.date)
    ORDER BY DATE_TRUNC('month', e.date) ASC, c.slug ASC
  `);

  return rows.map((row) => ({
    slug: row.slug,
    mes: row.mes,
    updated_at: row.updated_at,
  }));
}

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
    JOIN cities c ON e.city_id = c.id
    LEFT JOIN artists a ON e.artist_id = a.id
    LEFT JOIN venues v ON e.venue_id = v.id
    WHERE c.slug = $1
      AND e.date >= TO_DATE($2, 'YYYY-MM')
      AND e.date < TO_DATE($2, 'YYYY-MM') + INTERVAL '1 month'
      AND e.content_status = 'published'
      AND e.status IN ('active', 'sold_out')
      AND EXISTS (
        SELECT 1 FROM event_sources es WHERE es.event_id = e.id
      )
    ORDER BY e.date ASC
  `,
    [citySlug, mes],
  );
}

export async function getActiveGenres(): Promise<GenreMeta[]> {
  const rows = await query<{
    genre: string;
    event_count: number;
    updated_at: string;
  }>(`
    SELECT
      g.genre AS genre,
      COUNT(DISTINCT e.id)::int AS event_count,
      MAX(e.updated_at)::text AS updated_at
    FROM artists a
    JOIN LATERAL unnest(a.genres) AS g(genre) ON true
    JOIN events e ON e.artist_id = a.id
    WHERE e.content_status = 'published'
      AND e.status IN ('active', 'sold_out')
      AND e.date > NOW()
      AND a.genres IS NOT NULL
      AND cardinality(a.genres) > 0
      AND EXISTS (
        SELECT 1 FROM event_sources es WHERE es.event_id = e.id
      )
    GROUP BY g.genre
    ORDER BY event_count DESC, g.genre ASC
  `);

  const bySlug = new Map<string, GenreMeta>();
  for (const row of rows) {
    const slug = genreSlug(row.genre);
    if (!slug || bySlug.has(slug)) continue;
    bySlug.set(slug, {
      name: row.genre,
      slug,
      event_count: row.event_count,
      updated_at: row.updated_at,
    });
  }

  return Array.from(bySlug.values());
}

export async function getGenreBySlug(slug: string): Promise<GenreMeta | null> {
  const genres = await getActiveGenres();
  return genres.find((genre) => genre.slug === slug) ?? null;
}

export async function getGenreEvents(slug: string): Promise<Tier2ListingEvent[]> {
  const genre = await getGenreBySlug(slug);
  if (!genre) return [];

  return getGenreEventsByName(genre.name);
}

export async function getGenreEventsByName(
  genreName: string,
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
    JOIN artists a ON e.artist_id = a.id
    LEFT JOIN venues v ON e.venue_id = v.id
    LEFT JOIN cities c ON e.city_id = c.id
    WHERE $1 = ANY(a.genres)
      AND e.content_status = 'published'
      AND e.status IN ('active', 'sold_out')
      AND e.date > NOW()
      AND EXISTS (
        SELECT 1 FROM event_sources es WHERE es.event_id = e.id
      )
    ORDER BY e.date ASC
    LIMIT 72
  `,
    [genreName],
  );
}

export async function getSitemapEventRows(): Promise<SitemapSlugRow[]> {
  return query<SitemapSlugRow>(`
    SELECT e.slug, e.updated_at::text AS updated_at
    FROM events e
    WHERE e.content_status = 'published'
      AND e.status IN ('active', 'sold_out')
      AND e.date > NOW() - INTERVAL '1 day'
      AND EXISTS (
        SELECT 1 FROM event_sources es WHERE es.event_id = e.id
      )
    ORDER BY e.date ASC
  `);
}

export async function getSitemapArtistRows(): Promise<SitemapSlugRow[]> {
  return query<SitemapSlugRow>(`
    SELECT DISTINCT ON (a.slug) a.slug, a.updated_at::text AS updated_at
    FROM artists a
    JOIN events e ON e.artist_id = a.id
    WHERE a.content_status = 'published'
      AND e.content_status = 'published'
      AND e.status IN ('active', 'sold_out')
      AND e.date > NOW()
      AND EXISTS (
        SELECT 1 FROM event_sources es WHERE es.event_id = e.id
      )
    ORDER BY a.slug ASC, a.updated_at DESC
  `);
}

export async function getSitemapCityRows(): Promise<SitemapSlugRow[]> {
  return query<SitemapSlugRow>(`
    SELECT DISTINCT ON (c.slug) c.slug, c.updated_at::text AS updated_at
    FROM cities c
    JOIN events e ON e.city_id = c.id
    WHERE e.content_status = 'published'
      AND e.status IN ('active', 'sold_out')
      AND e.date > NOW()
      AND EXISTS (
        SELECT 1 FROM event_sources es WHERE es.event_id = e.id
      )
    ORDER BY c.slug ASC, c.updated_at DESC
  `);
}

export async function getSitemapVenueRows(): Promise<SitemapSlugRow[]> {
  return query<SitemapSlugRow>(`
    SELECT DISTINCT ON (v.slug) v.slug, v.updated_at::text AS updated_at
    FROM venues v
    JOIN events e ON e.venue_id = v.id
    WHERE v.content_status = 'published'
      AND e.content_status = 'published'
      AND e.status IN ('active', 'sold_out')
      AND e.date > NOW()
      AND EXISTS (
        SELECT 1 FROM event_sources es WHERE es.event_id = e.id
      )
    ORDER BY v.slug ASC, v.updated_at DESC
  `);
}
