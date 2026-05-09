// ─── Enums ────────────────────────────────────────────────────────────────────

export type EventTier = "tier1" | "tier2";

export type ContentStatus = "queued" | "processing" | "published" | "failed";

export type EventStatus = "active" | "cancelled" | "sold_out" | "past";

export type SourcePlatform =
  | "eventbrite"
  | "boletia"
  | "superboletos"
  | "stubhub"
  | "ticketmaster"
  | "songkick"
  | "manual";

// ─── Normalized event ─────────────────────────────────────────────────────────

/**
 * Common shape that every data source normalizer must produce.
 * The dedupe engine (lib/dedupe/match-events.ts) and all ingestors
 * (scripts/ingest-events.ts, lib/api/*, lib/scrapers/*) import from here.
 * Changing this interface requires updating ALL normalizers.
 */
export interface NormalizedEvent {
  /** Unique ID within the source platform */
  sourceId: string;
  sourcePlatform: SourcePlatform;

  /** Human-readable event title as shown on the source */
  title: string;

  /** Primary artist or headliner name */
  artistName: string;

  /** Venue name as shown on the source */
  venueName: string;

  /** City name — must be resolvable against the cities table */
  cityName: string;

  /** Start datetime (UTC) */
  date: Date;

  /** Direct URL to the event on the source platform */
  url: string;

  /** Affiliate-tagged URL for buy tracking (falls back to url if absent) */
  affiliateUrl?: string;

  /** Lowest ticket price in the listing */
  minPrice?: number;

  /** Highest ticket price in the listing */
  maxPrice?: number;

  /** ISO 4217 currency code, defaults to "MXN" */
  currency?: string;

  /** Cover/poster image URL */
  imageUrl?: string;

  /** True for secondary-market / resale listings */
  isResale?: boolean;
}

// ─── DB row shapes (mirrors schema.sql columns) ───────────────────────────────

export interface CityRow {
  id: string;
  name: string;
  slug: string;
  country: string;
  tier: number;
  lat: number | null;
  lng: number | null;
}

export interface ArtistRow {
  id: string;
  name: string;
  slug: string;
  spotify_id: string | null;
  mbid: string | null;
  image_url: string | null;
  genres: string[] | null;
  popularity: number | null;
  bio_es: string | null;
  content_status: ContentStatus;
}

export interface VenueRow {
  id: string;
  name: string;
  slug: string;
  city_id: string;
  address: string | null;
  capacity: number | null;
  lat: number | null;
  lng: number | null;
}

export interface EventRow {
  id: string;
  slug: string;
  title: string;
  artist_id: string | null;
  venue_id: string | null;
  city_id: string | null;
  date: Date;
  status: EventStatus;
  tier: EventTier;
  content_status: ContentStatus;
  seo_title: string | null;
  seo_description: string | null;
  description_es: string | null;
  context_text: string | null;
  image_url: string | null;
  h1_title: string | null;
  faq_json: unknown;
  created_at: Date;
  updated_at: Date;
}

export interface EventSourceRow {
  id: string;
  event_id: string;
  platform: SourcePlatform;
  source_event_id: string;
  url: string;
  affiliate_url: string | null;
  is_resale: boolean;
  created_at: Date;
}

export interface PriceSnapshotRow {
  id: string;
  event_source_id: string;
  min_price: number | null;
  max_price: number | null;
  currency: string;
  is_sold_out: boolean;
  snapped_at: Date;
}
