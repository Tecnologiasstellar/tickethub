import { queryOne } from "../db";
import type { NormalizedEvent } from "../types";
import {
  isTributeOrCover,
  matchNormalizedEvent,
  resolveCityId,
  toSlug,
  type MatchDecision,
} from "./match-events";

// ─── Result shape ────────────────────────────────────────────────────────────

export type IngestAction =
  | "merged"
  | "created"
  | "ambiguous_skipped"
  | "rejected_tribute"
  | "rejected_unknown_city";

export interface IngestResult {
  action: IngestAction;
  eventId: string | null;
  eventSourceId: string | null;
  priceSnapshotId: string | null;
  decision: MatchDecision | null;
  /** Message worth printing to logs / monitoring. */
  log: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function upsertArtist(name: string): Promise<string> {
  const slug = toSlug(name);
  const row = await queryOne<{ id: string }>(
    `INSERT INTO artists (name, slug)
     VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE
       SET name = EXCLUDED.name
     RETURNING id`,
    [name, slug]
  );
  return row!.id;
}

async function upsertVenue(
  name: string,
  cityId: string
): Promise<{ id: string; slug: string }> {
  const slug = toSlug(name);
  const row = await queryOne<{ id: string }>(
    `INSERT INTO venues (name, slug, city_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (slug) DO UPDATE
       SET name    = EXCLUDED.name,
           city_id = COALESCE(venues.city_id, EXCLUDED.city_id)
     RETURNING id`,
    [name, slug, cityId]
  );
  return { id: row!.id, slug };
}

function buildEventSlug(
  artistName: string,
  venueSlug: string,
  date: Date
): string {
  const day = date.toISOString().slice(0, 10);
  return `${toSlug(artistName)}-${venueSlug}-${day}`;
}

async function insertEvent(params: {
  slug: string;
  title: string;
  artistId: string;
  venueId: string;
  cityId: string;
  date: Date;
  imageUrl?: string;
}): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO events
       (slug, title, artist_id, venue_id, city_id, date, status, tier, content_status, image_url)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', 'tier2', 'queued', $7)
     ON CONFLICT (slug) DO UPDATE
       SET title     = EXCLUDED.title,
           artist_id = COALESCE(events.artist_id, EXCLUDED.artist_id),
           venue_id  = COALESCE(events.venue_id, EXCLUDED.venue_id),
           city_id   = COALESCE(events.city_id, EXCLUDED.city_id),
           image_url = COALESCE(events.image_url, EXCLUDED.image_url)
     RETURNING id`,
    [
      params.slug,
      params.title,
      params.artistId,
      params.venueId,
      params.cityId,
      params.date.toISOString(),
      params.imageUrl ?? null,
    ]
  );
  return row!.id;
}

async function upsertEventSource(
  eventId: string,
  n: NormalizedEvent
): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO event_sources
       (event_id, platform, source_event_id, url, affiliate_url, is_resale)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (platform, source_event_id) DO UPDATE
       SET event_id      = EXCLUDED.event_id,
           url           = EXCLUDED.url,
           affiliate_url = COALESCE(EXCLUDED.affiliate_url, event_sources.affiliate_url),
           is_resale     = EXCLUDED.is_resale
     RETURNING id`,
    [
      eventId,
      n.sourcePlatform,
      n.sourceId,
      n.url,
      n.affiliateUrl ?? null,
      n.isResale ?? false,
    ]
  );
  return row!.id;
}

async function insertPriceSnapshot(
  eventSourceId: string,
  n: NormalizedEvent
): Promise<string | null> {
  // Skip snapshot when there is no price information at all — avoids polluting
  // the time-series with rows that say nothing about availability.
  if (n.minPrice === undefined && n.maxPrice === undefined) return null;
  const row = await queryOne<{ id: string }>(
    `INSERT INTO price_snapshots
       (event_source_id, min_price, max_price, currency, is_sold_out)
     VALUES ($1, $2, $3, $4, FALSE)
     RETURNING id`,
    [
      eventSourceId,
      n.minPrice ?? null,
      n.maxPrice ?? null,
      n.currency ?? "MXN",
    ]
  );
  return row!.id;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Ingest a normalized event from any source.
 *
 * Flow:
 *  1. Resolve city by slug. If unknown, abort (cities are curated).
 *  2. Detect tribute / cover and abort merge path.
 *  3. Upsert artist + venue.
 *  4. Run dedupe. On `merge` attach to the canonical event.
 *  5. On `no-match` create a new event. On `ambiguous` create a new event but
 *     log the near-match for human review.
 *  6. Always write event_source + price_snapshot when the event lands.
 */
export async function ingestNormalizedEvent(
  n: NormalizedEvent
): Promise<IngestResult> {
  if (isTributeOrCover(n.title, n.artistName)) {
    return {
      action: "rejected_tribute",
      eventId: null,
      eventSourceId: null,
      priceSnapshotId: null,
      decision: null,
      log: `[dedupe] rejected tribute/cover: "${n.title}" (${n.sourcePlatform}:${n.sourceId})`,
    };
  }

  const cityId = await resolveCityId(n.cityName);
  if (!cityId) {
    return {
      action: "rejected_unknown_city",
      eventId: null,
      eventSourceId: null,
      priceSnapshotId: null,
      decision: null,
      log: `[dedupe] unknown city "${n.cityName}" — seed it first (${n.sourcePlatform}:${n.sourceId})`,
    };
  }

  const artistId = await upsertArtist(n.artistName);
  const { id: venueId, slug: venueSlug } = await upsertVenue(
    n.venueName,
    cityId
  );

  const decision = await matchNormalizedEvent({
    normalized: n,
    cityId,
    venueSlug,
  });

  let eventId: string;
  let action: IngestAction;
  let log: string;

  if (decision.action === "merge" && decision.matchedEventId) {
    eventId = decision.matchedEventId;
    action = "merged";
    const c = decision.bestCandidate!;
    log = `[dedupe] MERGE ${n.sourcePlatform}:${n.sourceId} -> ${c.candidateSlug} score=${c.score} (${c.reasons.join(", ")})`;
  } else {
    const slug = buildEventSlug(n.artistName, venueSlug, n.date);
    eventId = await insertEvent({
      slug,
      title: n.title,
      artistId,
      venueId,
      cityId,
      date: n.date,
      imageUrl: n.imageUrl,
    });

    if (decision.action === "ambiguous" && decision.bestCandidate) {
      action = "ambiguous_skipped";
      const c = decision.bestCandidate;
      log = `[dedupe] AMBIGUOUS new=${slug} near=${c.candidateSlug} score=${c.score} (${c.reasons.join(", ")}) — created new event for human review`;
    } else {
      action = "created";
      log = `[dedupe] CREATE ${slug} from ${n.sourcePlatform}:${n.sourceId}`;
    }
  }

  const eventSourceId = await upsertEventSource(eventId, n);
  const priceSnapshotId = await insertPriceSnapshot(eventSourceId, n);

  return {
    action,
    eventId,
    eventSourceId,
    priceSnapshotId,
    decision,
    log,
  };
}

/** Convenience export for callers that only need the matching decision. */
export { matchNormalizedEvent } from "./match-events";
