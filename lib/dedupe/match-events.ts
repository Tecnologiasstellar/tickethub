import slugify from "slugify";
import stringSimilarity from "string-similarity";
import { differenceInHours } from "date-fns";
import { query, queryOne } from "../db";
import type { NormalizedEvent } from "../types";

// ─── Decision shape ──────────────────────────────────────────────────────────

export type MatchAction = "merge" | "ambiguous" | "no-match";

export interface MatchReason {
  candidateEventId: string;
  candidateSlug: string;
  score: number;
  hoursDiff: number;
  sameVenue: boolean;
  artistSimilarity: number;
  exactArtist: boolean;
  isFestivalMatch: boolean;
  reasons: string[];
}

export interface MatchDecision {
  action: MatchAction;
  matchedEventId: string | null;
  /** Best candidate even when not merged (useful for logging ambiguous cases). */
  bestCandidate: MatchReason | null;
  /** All scored candidates, sorted by score desc. */
  candidates: MatchReason[];
  /** True when the incoming event was rejected before scoring (tribute, cover, etc.). */
  rejected: boolean;
  rejectionReason?: string;
}

// ─── Normalization helpers ───────────────────────────────────────────────────

export function toSlug(s: string): string {
  return slugify(s, { lower: true, strict: true, locale: "es" });
}

/** Lowercase + strip accents + collapse whitespace. Used for similarity. */
export function normalizeForCompare(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const TRIBUTE_PATTERNS = [
  /\btribut[oa]\b/i,
  /\btribute\b/i,
  /\bhomenaje\b/i,
  /\bcover\s+band\b/i,
  /\bcoverband\b/i,
  /\bcovers?\s+de\b/i,
  /\bsymphonic\s+tribute\b/i,
  /\bafter\s*party\b/i,
  /\blistening\s+party\b/i,
  /\bexperience\b/i,
  /\bexperiencia\b/i,
];

export function isTributeOrCover(...texts: Array<string | undefined>): boolean {
  for (const t of texts) {
    if (!t) continue;
    for (const re of TRIBUTE_PATTERNS) {
      if (re.test(t)) return true;
    }
  }
  return false;
}

const FESTIVAL_PATTERNS = [
  /\bfestival\b/i,
  /\bfest\b/i,
  /\bcorona\s+capital\b/i,
  /\bvive\s+latino\b/i,
  /\bpa['’]?l\s+norte\b/i,
  /\bhellow\s+fest\b/i,
  /\bemf\b/i,
  /\bedc\b/i,
];

export function isFestival(...texts: Array<string | undefined>): boolean {
  for (const t of texts) {
    if (!t) continue;
    for (const re of FESTIVAL_PATTERNS) {
      if (re.test(t)) return true;
    }
  }
  return false;
}

/**
 * Extract a stable "festival key" from a title, used to match events
 * that share the same festival across artists/venues changes.
 */
export function festivalKey(title: string): string | null {
  if (!isFestival(title)) return null;
  return toSlug(title)
    .replace(/-+\d{4}$/, "")
    .replace(/-(edicion|edition)-.*$/, "");
}

// ─── DB candidate lookup ─────────────────────────────────────────────────────

interface CandidateRow {
  id: string;
  slug: string;
  title: string;
  date: Date;
  city_id: string | null;
  venue_id: string | null;
  venue_name: string | null;
  venue_slug: string | null;
  artist_id: string | null;
  artist_name: string | null;
  artist_slug: string | null;
}

async function findCandidates(
  cityId: string,
  date: Date
): Promise<CandidateRow[]> {
  // ±1 day window in the same city.
  const lo = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  const hi = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  return query<CandidateRow>(
    `SELECT
       e.id, e.slug, e.title, e.date, e.city_id, e.venue_id, e.artist_id,
       v.name AS venue_name,
       v.slug AS venue_slug,
       a.name AS artist_name,
       a.slug AS artist_slug
     FROM events e
     LEFT JOIN venues  v ON v.id = e.venue_id
     LEFT JOIN artists a ON a.id = e.artist_id
     WHERE e.city_id = $1
       AND e.date BETWEEN $2 AND $3`,
    [cityId, lo.toISOString(), hi.toISOString()]
  );
}

// ─── City resolution ─────────────────────────────────────────────────────────

/**
 * Cities must exist (seeded via scripts/seed-cities.ts). We do not auto-create
 * cities at ingest time because city tier and metadata are curated.
 */
export async function resolveCityId(cityName: string): Promise<string | null> {
  const slug = toSlug(cityName);
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM cities WHERE slug = $1`,
    [slug]
  );
  return row?.id ?? null;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

interface ScoreInput {
  normalized: NormalizedEvent;
  normalizedVenueSlug: string;
  candidate: CandidateRow;
}

function scoreCandidate({
  normalized,
  normalizedVenueSlug,
  candidate,
}: ScoreInput): MatchReason {
  const reasons: string[] = [];
  let score = 0;

  const hoursDiff = Math.abs(differenceInHours(normalized.date, candidate.date));
  if (hoursDiff <= 6) {
    score += 40;
    reasons.push(`date_within_6h(+40, diff=${hoursDiff.toFixed(1)}h)`);
  } else if (hoursDiff <= 24) {
    reasons.push(`date_outside_6h(diff=${hoursDiff.toFixed(1)}h)`);
  }

  const sameVenue =
    !!candidate.venue_slug && candidate.venue_slug === normalizedVenueSlug;
  if (sameVenue) {
    score += 30;
    reasons.push(`same_venue(+30, ${candidate.venue_slug})`);
  }

  const incomingArtist = normalizeForCompare(normalized.artistName);
  const candidateArtist = candidate.artist_name
    ? normalizeForCompare(candidate.artist_name)
    : "";
  const artistSimilarity = candidateArtist
    ? stringSimilarity.compareTwoStrings(incomingArtist, candidateArtist)
    : 0;
  const exactArtist = !!candidateArtist && incomingArtist === candidateArtist;

  if (artistSimilarity > 0.85) {
    score += 30;
    reasons.push(
      `artist_similarity(+30, ${artistSimilarity.toFixed(2)} "${candidate.artist_name}")`
    );
  } else if (candidateArtist) {
    reasons.push(
      `artist_low_similarity(${artistSimilarity.toFixed(2)} "${candidate.artist_name}")`
    );
  }

  // Festival override: if both titles look like the same festival (and same
  // city, which the candidate query already enforces), score gets a boost.
  const incomingFestival = festivalKey(normalized.title);
  const candidateFestival = festivalKey(candidate.title);
  const isFestivalMatch =
    !!incomingFestival &&
    !!candidateFestival &&
    incomingFestival === candidateFestival;
  if (isFestivalMatch) {
    score = Math.max(score, 90);
    reasons.push(`festival_match(=>90, key="${incomingFestival}")`);
  }

  return {
    candidateEventId: candidate.id,
    candidateSlug: candidate.slug,
    score,
    hoursDiff,
    sameVenue,
    artistSimilarity,
    exactArtist,
    isFestivalMatch,
    reasons,
  };
}

// ─── Public API: matchNormalizedEvent ───────────────────────────────────────

export interface MatchInput {
  normalized: NormalizedEvent;
  cityId: string;
  /** Pre-computed venue slug (the ingestor already needs to upsert the venue). */
  venueSlug: string;
}

export async function matchNormalizedEvent(
  input: MatchInput
): Promise<MatchDecision> {
  // Tribute / cover / after-party events never merge into the original artist.
  if (isTributeOrCover(input.normalized.title, input.normalized.artistName)) {
    return {
      action: "no-match",
      matchedEventId: null,
      bestCandidate: null,
      candidates: [],
      rejected: true,
      rejectionReason: "tribute_or_cover",
    };
  }

  const candidates = await findCandidates(input.cityId, input.normalized.date);
  const scored = candidates
    .map((c) =>
      scoreCandidate({
        normalized: input.normalized,
        normalizedVenueSlug: input.venueSlug,
        candidate: c,
      })
    )
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      action: "no-match",
      matchedEventId: null,
      bestCandidate: null,
      candidates: [],
      rejected: false,
    };
  }

  const best = scored[0];

  // Rule order matches Workplan/skills/05-dedupe-price-moat.md.
  if (best.score >= 80) {
    return {
      action: "merge",
      matchedEventId: best.candidateEventId,
      bestCandidate: best,
      candidates: scored,
      rejected: false,
    };
  }

  if (best.score >= 60 && best.exactArtist && best.sameVenue) {
    return {
      action: "merge",
      matchedEventId: best.candidateEventId,
      bestCandidate: best,
      candidates: scored,
      rejected: false,
    };
  }

  // Anything in (40, 80) without exact artist+venue is ambiguous: do not merge,
  // but surface to logs so a human can review.
  if (best.score >= 40) {
    return {
      action: "ambiguous",
      matchedEventId: null,
      bestCandidate: best,
      candidates: scored,
      rejected: false,
    };
  }

  return {
    action: "no-match",
    matchedEventId: null,
    bestCandidate: best,
    candidates: scored,
    rejected: false,
  };
}
