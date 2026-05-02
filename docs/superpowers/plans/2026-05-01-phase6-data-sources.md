# Phase 6: Data Source Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Eventbrite, Spotify, Songkick, Setlist.fm, Boletia, Superboletos, StubHub, and Ticketmaster so real events populate the DB through the existing dedupe engine.

**Architecture:** Each API source follows a `client → types → normalizer → NormalizedEvent → ingestNormalizedEvent()` pipeline. Enrichment sources (Spotify, Ticketmaster) update existing artist/event rows rather than creating new ones. Scrapers use Playwright for JS-rendered pages; all HTTP clients share a `fetchWithRetry` utility for 429/5xx resilience.

**Tech Stack:** TypeScript strict, Neon Postgres via `@neondatabase/serverless`, `playwright` (scrapers), `tsx` + `dotenv-cli` (scripts), no Jest (script-based test harness matching existing patterns).

---

## File Map

```
lib/
  utils/
    http.ts                          CREATE – fetchWithRetry + delay
  api/
    eventbrite/
      types.ts                       CREATE – EB API response shapes
      client.ts                      CREATE – paginated search client
      normalizer.ts                  CREATE – EBEvent → NormalizedEvent
    spotify/
      types.ts                       CREATE – token + artist shapes
      client.ts                      CREATE – client_credentials + search
      enricher.ts                    CREATE – update DB artist row
    songkick/
      types.ts                       CREATE – SK event/venue shapes
      client.ts                      CREATE – paginated metro-area events
      normalizer.ts                  CREATE – SKEvent → NormalizedEvent
    setlistfm/
      types.ts                       CREATE – SLF artist + setlist shapes
      client.ts                      CREATE – artist search + setlist pages
      normalizer.ts                  CREATE – SLFSetlist → DB insert shape
    ticketmaster/
      types.ts                       CREATE – TM event/venue/attraction shapes
      client.ts                      CREATE – paginated events search
      enricher.ts                    CREATE – upsert source + snapshot
    stubhub/
      types.ts                       CREATE – SH event shapes
      client.ts                      CREATE – OAuth + event search
      normalizer.ts                  CREATE – SHEvent → NormalizedEvent
  scrapers/
    boletia/
      types.ts                       CREATE – raw scraped shape
      scraper.ts                     CREATE – Playwright page fetcher
      normalizer.ts                  CREATE – raw → NormalizedEvent
    superboletos/
      types.ts                       CREATE – raw scraped shape
      scraper.ts                     CREATE – Playwright page fetcher
      normalizer.ts                  CREATE – raw → NormalizedEvent
lib/
  types/index.ts                     MODIFY – add mbid to ArtistRow
scripts/
  migrate-add-mbid.ts               CREATE – ALTER TABLE artists ADD COLUMN mbid
  ingest-eventbrite.ts              CREATE – paginate + ingest + stats
  enrich-spotify.ts                 CREATE – enrich artists missing spotify_id
  ingest-songkick.ts                CREATE – metro-area calendar ingest
  fetch-setlists.ts                 CREATE – per-artist setlist fetch + save
  ingest-stubhub.ts                 CREATE – search Mexico + ingest
  enrich-ticketmaster.ts            CREATE – search Mexico + enrich/create
  scrape-boletia.ts                 CREATE – Playwright scrape + ingest
  scrape-superboletos.ts            CREATE – Playwright scrape + ingest
package.json                        MODIFY – new scripts + playwright dep
.env.local.example                  CREATE – all required env var placeholders
```

---

## Task 1: Install Playwright + add MBID migration

**Files:**
- Modify: `package.json`
- Create: `scripts/migrate-add-mbid.ts`
- Modify: `lib/types/index.ts`

- [ ] **Step 1: Install playwright**

```bash
npm install playwright
```

Expected: `playwright` appears in `dependencies` in `package.json`.

- [ ] **Step 2: Install Chromium browser**

```bash
npx playwright install chromium
```

Expected: Chromium downloaded to local playwright cache.

- [ ] **Step 3: Create MBID migration script**

Create `scripts/migrate-add-mbid.ts`:

```typescript
import { query } from "../lib/db";

async function main() {
  await query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'artists' AND column_name = 'mbid'
      ) THEN
        ALTER TABLE artists ADD COLUMN mbid TEXT UNIQUE;
      END IF;
    END $$
  `);
  console.log("[migrate] mbid column ensured on artists table");
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
```

- [ ] **Step 4: Update ArtistRow type**

In `lib/types/index.ts`, replace the `ArtistRow` interface:

```typescript
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
```

- [ ] **Step 5: Add migration script to package.json**

In `package.json`, add to `"scripts"`:

```json
"db:migrate-mbid": "dotenv -e .env.local -- tsx scripts/migrate-add-mbid.ts"
```

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json lib/types/index.ts scripts/migrate-add-mbid.ts
git commit -m "feat(phase6): install playwright, add mbid column migration"
```

---

## Task 2: Shared HTTP retry utility

**Files:**
- Create: `lib/utils/http.ts`

- [ ] **Step 1: Write the utility**

Create `lib/utils/http.ts`:

```typescript
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with automatic retry on 429 (rate-limit) and 5xx (server error).
 * - 429: waits Retry-After seconds (default 60s) then retries.
 * - 5xx: exponential backoff starting at baseDelayMs.
 * - Network error: same exponential backoff.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<Response> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("Retry-After") ?? "60", 10);
        const wait = (isNaN(retryAfter) ? 60 : retryAfter) * 1000;
        console.warn(
          `[http] 429 rate-limited on ${url} — waiting ${wait / 1000}s (attempt ${attempt + 1}/${maxRetries + 1})`
        );
        await delay(wait);
        continue;
      }

      if (res.status >= 500) {
        const wait = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
        console.warn(
          `[http] ${res.status} server error on ${url} — backoff ${Math.round(wait)}ms (attempt ${attempt + 1}/${maxRetries + 1})`
        );
        await delay(wait);
        continue;
      }

      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const wait = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
        console.warn(
          `[http] network error on ${url} — backoff ${Math.round(wait)}ms (attempt ${attempt + 1}/${maxRetries + 1})`
        );
        await delay(wait);
      }
    }
  }

  throw lastError ?? new Error(`fetchWithRetry: exhausted retries for ${url}`);
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add lib/utils/http.ts
git commit -m "feat(phase6): add fetchWithRetry + delay utility"
```

---

## Task 3: Eventbrite – types + client + normalizer

**Files:**
- Create: `lib/api/eventbrite/types.ts`
- Create: `lib/api/eventbrite/client.ts`
- Create: `lib/api/eventbrite/normalizer.ts`

- [ ] **Step 1: Write Eventbrite types**

Create `lib/api/eventbrite/types.ts`:

```typescript
export interface EBMultiLang {
  text: string;
  html: string;
}

export interface EBMoney {
  currency: string;
  /** Numeric value in major units (MXN, USD). */
  value: number;
  display: string;
}

export interface EBVenue {
  id: string;
  name: string;
  address: {
    city?: string;
    region?: string;
    country?: string;
    address_1?: string;
    localized_address_display?: string;
  };
}

export interface EBTicketAvailability {
  has_available_tickets: boolean;
  is_sold_out: boolean;
  minimum_ticket_price?: EBMoney;
  maximum_ticket_price?: EBMoney;
}

export interface EBEvent {
  id: string;
  name: EBMultiLang;
  description?: EBMultiLang;
  url: string;
  start: { timezone: string; local: string; utc: string };
  end: { timezone: string; local: string; utc: string };
  status: "live" | "draft" | "cancelled" | "completed";
  listed: boolean;
  logo?: { url: string; original?: { url: string } };
  venue?: EBVenue;
  ticket_availability?: EBTicketAvailability;
  category_id?: string;
  /** Populated only for organizer-expand requests. */
  organizer?: { name: string };
}

export interface EBSearchResponse {
  events: EBEvent[];
  pagination: {
    object_count: number;
    page_number: number;
    page_size: number;
    page_count: number;
    continuation?: string;
    has_more_items: boolean;
  };
}
```

- [ ] **Step 2: Write Eventbrite client**

Create `lib/api/eventbrite/client.ts`:

```typescript
import { fetchWithRetry, delay } from "../../utils/http";
import type { EBSearchResponse, EBEvent } from "./types";

const BASE = "https://www.eventbriteapi.com/v3";

/** Mexico metro area searches — add more cities as needed. */
const MX_LOCATIONS = [
  "Ciudad de Mexico,MX",
  "Guadalajara,MX",
  "Monterrey,MX",
  "Puebla,MX",
  "Queretaro,MX",
  "Tijuana,MX",
  "Leon,MX",
];

/** Music category ID on Eventbrite. */
const MUSIC_CATEGORY = "103";

export class EventbriteClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private headers(): HeadersInit {
    return { Authorization: `Bearer ${this.token}` };
  }

  /**
   * Fetch one page of events for a location.
   * Uses continuation cursor when present (Eventbrite v3 pagination).
   */
  async searchPage(params: {
    location: string;
    continuation?: string;
    pageSize?: number;
  }): Promise<EBSearchResponse> {
    const qs = new URLSearchParams({
      expand: "venue,ticket_availability,organizer",
      categories: MUSIC_CATEGORY,
      "location.address": params.location,
      "location.within": "100km",
      "start_date.range_start": new Date().toISOString(),
      page_size: String(params.pageSize ?? 50),
    });
    if (params.continuation) {
      qs.set("continuation", params.continuation);
    }

    const res = await fetchWithRetry(`${BASE}/events/search/?${qs}`, {
      headers: this.headers(),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Eventbrite search failed ${res.status}: ${body}`);
    }

    return res.json() as Promise<EBSearchResponse>;
  }

  /**
   * Yield all upcoming music events in Mexican metros.
   * Respects pagination and adds 200ms delay between pages.
   */
  async *allMexicoEvents(): AsyncGenerator<EBEvent> {
    for (const location of MX_LOCATIONS) {
      let continuation: string | undefined = undefined;
      let pageNum = 1;

      do {
        const data = await this.searchPage({ location, continuation });
        console.log(
          `[eventbrite] ${location} page ${pageNum}: ${data.events.length} events`
        );

        for (const ev of data.events) {
          yield ev;
        }

        continuation = data.pagination.has_more_items
          ? data.pagination.continuation
          : undefined;
        pageNum++;

        if (continuation) await delay(200);
      } while (continuation);
    }
  }
}
```

- [ ] **Step 3: Write Eventbrite normalizer**

Create `lib/api/eventbrite/normalizer.ts`:

```typescript
import type { EBEvent } from "./types";
import type { NormalizedEvent } from "../../types";

/**
 * Heuristic: extract headliner from titles like
 * "Caifanes en el Auditorio Nacional" → "Caifanes"
 * "Bad Bunny - Mexico City Tour"      → "Bad Bunny"
 */
function extractArtist(title: string): string {
  // Match text before: " en ", " en el ", " at ", " at the ", " - ", " – ", " — ", " @ "
  const match = title.match(
    /^(.+?)(?:\s+(?:en\s+el|en\s+la|en|at\s+the|at|in)\s+|\s*[-–—@]\s*).*/i
  );
  if (match) return match[1].trim();
  // Fallback: everything before the first dash
  const dashIdx = title.search(/[-–—]/);
  return dashIdx > 0 ? title.slice(0, dashIdx).trim() : title.trim();
}

/** Map Eventbrite city names to the slugified city names in our cities table. */
const CITY_MAP: Record<string, string> = {
  "Mexico City": "Ciudad de Mexico",
  "Ciudad de México": "Ciudad de Mexico",
  "Guadalajara": "Guadalajara",
  "Monterrey": "Monterrey",
  "Puebla": "Puebla",
  "Querétaro": "Queretaro",
  "Tijuana": "Tijuana",
  "León": "Leon",
};

function normalizeCity(raw?: string): string | null {
  if (!raw) return null;
  return CITY_MAP[raw] ?? raw;
}

export function normalizeEventbriteEvent(
  ev: EBEvent
): NormalizedEvent | null {
  // Skip unlisted, non-live, or draft events
  if (!ev.listed || ev.status === "draft" || ev.status === "completed") return null;

  const title = ev.name.text.trim();
  const artistName = extractArtist(title);

  const venueName = ev.venue?.name?.trim() ?? "Por confirmar";
  const rawCity = ev.venue?.address?.city;
  const cityName = normalizeCity(rawCity);
  if (!cityName) return null;

  const date = new Date(ev.start.utc);
  if (isNaN(date.getTime())) return null;

  const avail = ev.ticket_availability;
  const minPrice = avail?.minimum_ticket_price?.value;
  const maxPrice = avail?.maximum_ticket_price?.value;
  const currency = avail?.minimum_ticket_price?.currency ?? "MXN";
  const imageUrl = ev.logo?.original?.url ?? ev.logo?.url;

  return {
    sourceId: ev.id,
    sourcePlatform: "eventbrite",
    title,
    artistName,
    venueName,
    cityName,
    date,
    url: ev.url,
    minPrice,
    maxPrice,
    currency,
    imageUrl,
    isResale: false,
  };
}
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add lib/api/eventbrite/
git commit -m "feat(phase6): Eventbrite types, client, and normalizer"
```

---

## Task 4: Eventbrite ingest script

**Files:**
- Create: `scripts/ingest-eventbrite.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the ingest script**

Create `scripts/ingest-eventbrite.ts`:

```typescript
import { EventbriteClient } from "../lib/api/eventbrite/client";
import { normalizeEventbriteEvent } from "../lib/api/eventbrite/normalizer";
import { ingestNormalizedEvent } from "../lib/dedupe/ingest";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const token = process.env.EVENTBRITE_API_KEY;
  if (!token) {
    console.error("[eventbrite] EVENTBRITE_API_KEY is not set — skipping");
    process.exit(0);
  }

  if (DRY_RUN) console.log("[eventbrite] DRY RUN — no DB writes");

  const client = new EventbriteClient(token);

  const stats = {
    fetched: 0,
    skipped_normalize: 0,
    created: 0,
    merged: 0,
    ambiguous: 0,
    tribute_rejected: 0,
    unknown_city: 0,
    errors: 0,
  };

  for await (const ev of client.allMexicoEvents()) {
    stats.fetched++;

    const normalized = normalizeEventbriteEvent(ev);
    if (!normalized) {
      stats.skipped_normalize++;
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `[eventbrite] would ingest: "${normalized.title}" (${normalized.cityName}, ${normalized.date.toISOString().slice(0, 10)})`
      );
      continue;
    }

    try {
      const result = await ingestNormalizedEvent(normalized);
      console.log(result.log);
      switch (result.action) {
        case "created":          stats.created++; break;
        case "merged":           stats.merged++; break;
        case "ambiguous_skipped": stats.ambiguous++; break;
        case "rejected_tribute": stats.tribute_rejected++; break;
        case "rejected_unknown_city": stats.unknown_city++; break;
      }
    } catch (err) {
      stats.errors++;
      console.error(
        `[eventbrite] error ingesting ${ev.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.log(
    `[eventbrite] done. fetched=${stats.fetched} skipped=${stats.skipped_normalize} ` +
    `created=${stats.created} merged=${stats.merged} ambiguous=${stats.ambiguous} ` +
    `tribute_rejected=${stats.tribute_rejected} unknown_city=${stats.unknown_city} errors=${stats.errors}`
  );
}

main().catch((err) => {
  console.error("[eventbrite] fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Add script to package.json**

In `package.json` `"scripts"`, add:

```json
"ingest:eventbrite": "dotenv -e .env.local -- tsx scripts/ingest-eventbrite.ts",
"ingest:eventbrite:dry": "dotenv -e .env.local -- tsx scripts/ingest-eventbrite.ts --dry-run"
```

- [ ] **Step 3: Run dry-run to verify it compiles and runs without DB**

```bash
EVENTBRITE_API_KEY=invalid npm run ingest:eventbrite:dry
```

Expected: Script starts, attempts API call, fails gracefully (network/401 error logged), exits without crash.

If `EVENTBRITE_API_KEY` env var is not set it exits with "skipping" message and code 0.

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add scripts/ingest-eventbrite.ts package.json
git commit -m "feat(phase6): Eventbrite ingest script with dry-run + stats"
```

---

## Task 5: Spotify enrichment – types + client + enricher

**Files:**
- Create: `lib/api/spotify/types.ts`
- Create: `lib/api/spotify/client.ts`
- Create: `lib/api/spotify/enricher.ts`

- [ ] **Step 1: Write Spotify types**

Create `lib/api/spotify/types.ts`:

```typescript
export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  popularity: number;
  images: SpotifyImage[];
  followers: { href: string | null; total: number };
  external_urls: { spotify: string };
  uri: string;
  type: "artist";
}

export interface SpotifyArtistSearchResponse {
  artists: {
    href: string;
    items: SpotifyArtist[];
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
  };
}
```

- [ ] **Step 2: Write Spotify client**

Create `lib/api/spotify/client.ts`:

```typescript
import { fetchWithRetry, delay } from "../../utils/http";
import type {
  SpotifyTokenResponse,
  SpotifyArtist,
  SpotifyArtistSearchResponse,
} from "./types";

const ACCOUNTS = "https://accounts.spotify.com";
const API = "https://api.spotify.com/v1";

export class SpotifyClient {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  private async ensureToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 30_000) return;

    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString("base64");

    const res = await fetchWithRetry(`${ACCOUNTS}/api/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Spotify token request failed ${res.status}: ${body}`);
    }

    const data = (await res.json()) as SpotifyTokenResponse;
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
  }

  private async get<T>(path: string, qs?: Record<string, string>): Promise<T> {
    await this.ensureToken();
    const url = `${API}${path}${qs ? "?" + new URLSearchParams(qs) : ""}`;
    const res = await fetchWithRetry(url, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Spotify GET ${path} failed ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  /**
   * Search for an artist by name. Returns the best match or null.
   * Compares the top result name case-insensitively.
   */
  async searchArtist(name: string): Promise<SpotifyArtist | null> {
    const data = await this.get<SpotifyArtistSearchResponse>("/search", {
      q: name,
      type: "artist",
      limit: "3",
    });
    const items = data.artists.items;
    if (items.length === 0) return null;

    const normalizedQuery = name.toLowerCase().trim();
    const exact = items.find(
      (a) => a.name.toLowerCase().trim() === normalizedQuery
    );
    return exact ?? items[0];
  }

  /** Small delay helper for callers. */
  wait(ms: number) {
    return delay(ms);
  }
}
```

- [ ] **Step 3: Write Spotify enricher**

Create `lib/api/spotify/enricher.ts`:

```typescript
import { queryOne } from "../../db";
import type { SpotifyArtist } from "./types";

/**
 * Persist Spotify data to an artist row.
 * Uses COALESCE so existing non-null fields are preserved.
 */
export async function enrichArtistFromSpotify(
  artistId: string,
  sp: SpotifyArtist
): Promise<void> {
  const bestImage =
    sp.images.find((i) => i.width && i.width >= 300) ?? sp.images[0];

  await queryOne(
    `UPDATE artists
     SET spotify_id  = COALESCE(spotify_id, $2),
         image_url   = COALESCE(image_url, $3),
         genres      = COALESCE(genres, $4),
         popularity  = COALESCE(popularity, $5),
         updated_at  = NOW()
     WHERE id = $1`,
    [
      artistId,
      sp.id,
      bestImage?.url ?? null,
      sp.genres.length > 0 ? sp.genres : null,
      sp.popularity,
    ]
  );
}
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add lib/api/spotify/
git commit -m "feat(phase6): Spotify client, types, and enricher"
```

---

## Task 6: Spotify enrichment script

**Files:**
- Create: `scripts/enrich-spotify.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the enrichment script**

Create `scripts/enrich-spotify.ts`:

```typescript
import { query } from "../lib/db";
import { SpotifyClient } from "../lib/api/spotify/client";
import { enrichArtistFromSpotify } from "../lib/api/spotify/enricher";

const DRY_RUN = process.argv.includes("--dry-run");
const DELAY_MS = 150;

async function main() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("[spotify] SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET not set — skipping");
    process.exit(0);
  }

  if (DRY_RUN) console.log("[spotify] DRY RUN — no DB writes");

  const spotify = new SpotifyClient(clientId, clientSecret);

  // Fetch artists that are missing spotify enrichment
  const artists = await query<{ id: string; name: string }>(
    `SELECT id, name FROM artists
     WHERE spotify_id IS NULL OR image_url IS NULL OR genres IS NULL
     ORDER BY popularity DESC NULLS LAST, name
     LIMIT 500`
  );

  console.log(`[spotify] enriching ${artists.length} artists`);

  const stats = { enriched: 0, not_found: 0, errors: 0 };

  for (const artist of artists) {
    try {
      const sp = await spotify.searchArtist(artist.name);
      if (!sp) {
        stats.not_found++;
        console.log(`[spotify] not found: "${artist.name}"`);
        await spotify.wait(DELAY_MS);
        continue;
      }

      if (DRY_RUN) {
        console.log(
          `[spotify] would enrich "${artist.name}" → ${sp.id} genres=${sp.genres.slice(0, 2).join(",")} pop=${sp.popularity}`
        );
        await spotify.wait(DELAY_MS);
        continue;
      }

      await enrichArtistFromSpotify(artist.id, sp);
      stats.enriched++;
      console.log(
        `[spotify] enriched "${artist.name}" → ${sp.id} pop=${sp.popularity}`
      );
    } catch (err) {
      stats.errors++;
      console.error(
        `[spotify] error for "${artist.name}": ${err instanceof Error ? err.message : String(err)}`
      );
    }

    await spotify.wait(DELAY_MS);
  }

  console.log(
    `[spotify] done. enriched=${stats.enriched} not_found=${stats.not_found} errors=${stats.errors}`
  );
}

main().catch((err) => {
  console.error("[spotify] fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Add scripts to package.json**

In `package.json` `"scripts"`, add:

```json
"enrich:spotify": "dotenv -e .env.local -- tsx scripts/enrich-spotify.ts",
"enrich:spotify:dry": "dotenv -e .env.local -- tsx scripts/enrich-spotify.ts --dry-run"
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/enrich-spotify.ts package.json
git commit -m "feat(phase6): Spotify artist enrichment script"
```

---

## Task 7: Songkick – types + client + normalizer + script

**Files:**
- Create: `lib/api/songkick/types.ts`
- Create: `lib/api/songkick/client.ts`
- Create: `lib/api/songkick/normalizer.ts`
- Create: `scripts/ingest-songkick.ts`
- Modify: `package.json`

- [ ] **Step 1: Write Songkick types**

Create `lib/api/songkick/types.ts`:

```typescript
export interface SKArtist {
  id: number;
  displayName: string;
  uri: string;
  identifier?: Array<{ mbid: string; href: string }>;
}

export interface SKPerformance {
  id: number;
  displayName: string;
  billing: "headline" | "support";
  billingIndex: number;
  artist: SKArtist;
}

export interface SKVenue {
  id: number;
  displayName: string;
  uri: string;
  lat?: number | null;
  lng?: number | null;
  metroArea?: {
    id: number;
    displayName: string;
    country: { displayName: string };
  };
  city?: {
    displayName: string;
    country: { displayName: string };
  };
}

export interface SKEvent {
  id: number;
  displayName: string;
  type: "Concert" | "Festival";
  uri: string;
  status: "ok" | "cancelled";
  start: { date: string | null; datetime: string | null; time: string | null };
  performance: SKPerformance[];
  venue: SKVenue;
  ageRestriction?: string | null;
}

export interface SKMetroArea {
  id: number;
  displayName: string;
  country: { displayName: string };
}

export interface SKEventsResponse {
  resultsPage: {
    status: string;
    results: { event?: SKEvent[] };
    totalEntries: number;
    perPage: number;
    page: number;
  };
}

export interface SKMetroAreasResponse {
  resultsPage: {
    status: string;
    results: { location?: Array<{ metroArea: SKMetroArea }> };
    totalEntries: number;
    perPage: number;
    page: number;
  };
}
```

- [ ] **Step 2: Write Songkick client**

Create `lib/api/songkick/client.ts`:

```typescript
import { fetchWithRetry, delay } from "../../utils/http";
import type {
  SKEventsResponse,
  SKMetroAreasResponse,
  SKEvent,
  SKMetroArea,
} from "./types";

const BASE = "https://api.songkick.com/api/3.0";

/** Known Songkick metro area IDs for Mexico. Add more as needed. */
const MX_METRO_IDS: Record<string, number> = {
  "Ciudad de Mexico": 28878,
  Guadalajara: 28879,
  Monterrey: 29474,
  Puebla: 29475,
  Queretaro: 29476,
};

export class SongkickClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async get<T>(path: string, extra?: Record<string, string>): Promise<T> {
    const qs = new URLSearchParams({ apikey: this.apiKey, ...extra });
    const res = await fetchWithRetry(`${BASE}${path}?${qs}`);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Songkick GET ${path} failed ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  /** Fetch one page of upcoming events for a metro area. */
  async metroEvents(
    metroId: number,
    page = 1
  ): Promise<SKEventsResponse> {
    return this.get<SKEventsResponse>(
      `/metro_areas/${metroId}/calendar.json`,
      { page: String(page), per_page: "50" }
    );
  }

  /**
   * Yield all upcoming Concert events for known Mexican metro areas.
   * 200ms delay between pages.
   */
  async *allMexicoEvents(): AsyncGenerator<SKEvent> {
    for (const [cityName, metroId] of Object.entries(MX_METRO_IDS)) {
      let page = 1;
      let total = Infinity;

      while ((page - 1) * 50 < total) {
        const data = await this.metroEvents(metroId, page);
        const rp = data.resultsPage;
        total = rp.totalEntries;

        const events = rp.results.event ?? [];
        console.log(
          `[songkick] ${cityName} page ${page}: ${events.length} events (total=${total})`
        );

        for (const ev of events) {
          if (ev.type === "Concert" || ev.type === "Festival") yield ev;
        }

        page++;
        if (events.length > 0) await delay(200);
        else break;
      }
    }
  }
}
```

- [ ] **Step 3: Write Songkick normalizer**

Create `lib/api/songkick/normalizer.ts`:

```typescript
import type { SKEvent } from "./types";
import type { NormalizedEvent } from "../../types";

const CITY_MAP: Record<string, string> = {
  "Mexico City": "Ciudad de Mexico",
  "Mexico": "Ciudad de Mexico",
  "Guadalajara": "Guadalajara",
  "Monterrey": "Monterrey",
  "Puebla": "Puebla",
  "Querétaro": "Queretaro",
  "Tijuana": "Tijuana",
};

function resolveCity(ev: SKEvent): string | null {
  const city =
    ev.venue?.city?.displayName ??
    ev.venue?.metroArea?.displayName ??
    null;
  if (!city) return null;
  return CITY_MAP[city] ?? city;
}

function headliner(ev: SKEvent): string | null {
  if (ev.performance.length === 0) return null;
  const hl = ev.performance.find((p) => p.billing === "headline");
  return hl?.artist.displayName ?? ev.performance[0]?.artist.displayName ?? null;
}

export function normalizeSongkickEvent(ev: SKEvent): NormalizedEvent | null {
  if (ev.status === "cancelled") return null;

  const datetime = ev.start.datetime ?? (ev.start.date ? `${ev.start.date}T21:00:00` : null);
  if (!datetime) return null;
  const date = new Date(datetime);
  if (isNaN(date.getTime())) return null;

  const artistName = headliner(ev);
  if (!artistName) return null;

  const cityName = resolveCity(ev);
  if (!cityName) return null;

  const venueName = ev.venue.displayName.trim() || "Por confirmar";

  return {
    sourceId: String(ev.id),
    sourcePlatform: "songkick",
    title: ev.displayName.trim(),
    artistName,
    venueName,
    cityName,
    date,
    url: ev.uri,
    isResale: false,
  };
}
```

- [ ] **Step 4: Write Songkick ingest script**

Create `scripts/ingest-songkick.ts`:

```typescript
import { SongkickClient } from "../lib/api/songkick/client";
import { normalizeSongkickEvent } from "../lib/api/songkick/normalizer";
import { ingestNormalizedEvent } from "../lib/dedupe/ingest";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const apiKey = process.env.SONGKICK_API_KEY;
  if (!apiKey) {
    console.error("[songkick] SONGKICK_API_KEY not set — skipping");
    process.exit(0);
  }

  if (DRY_RUN) console.log("[songkick] DRY RUN — no DB writes");

  const client = new SongkickClient(apiKey);

  const stats = {
    fetched: 0,
    skipped: 0,
    created: 0,
    merged: 0,
    ambiguous: 0,
    tribute_rejected: 0,
    unknown_city: 0,
    errors: 0,
  };

  for await (const ev of client.allMexicoEvents()) {
    stats.fetched++;

    const normalized = normalizeSongkickEvent(ev);
    if (!normalized) {
      stats.skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `[songkick] would ingest: "${normalized.title}" (${normalized.cityName}, ${normalized.date.toISOString().slice(0, 10)})`
      );
      continue;
    }

    try {
      const result = await ingestNormalizedEvent(normalized);
      console.log(result.log);
      switch (result.action) {
        case "created":           stats.created++; break;
        case "merged":            stats.merged++; break;
        case "ambiguous_skipped": stats.ambiguous++; break;
        case "rejected_tribute":  stats.tribute_rejected++; break;
        case "rejected_unknown_city": stats.unknown_city++; break;
      }
    } catch (err) {
      stats.errors++;
      console.error(
        `[songkick] error ingesting ${ev.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.log(
    `[songkick] done. fetched=${stats.fetched} skipped=${stats.skipped} ` +
    `created=${stats.created} merged=${stats.merged} ambiguous=${stats.ambiguous} ` +
    `tribute_rejected=${stats.tribute_rejected} unknown_city=${stats.unknown_city} errors=${stats.errors}`
  );
}

main().catch((err) => {
  console.error("[songkick] fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 5: Add scripts to package.json**

In `package.json` `"scripts"`, add:

```json
"ingest:songkick": "dotenv -e .env.local -- tsx scripts/ingest-songkick.ts",
"ingest:songkick:dry": "dotenv -e .env.local -- tsx scripts/ingest-songkick.ts --dry-run"
```

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add lib/api/songkick/ scripts/ingest-songkick.ts package.json
git commit -m "feat(phase6): Songkick types, client, normalizer, and ingest script"
```

---

## Task 8: Setlist.fm – types + client + normalizer + script

**Files:**
- Create: `lib/api/setlistfm/types.ts`
- Create: `lib/api/setlistfm/client.ts`
- Create: `lib/api/setlistfm/normalizer.ts`
- Create: `scripts/fetch-setlists.ts`
- Modify: `package.json`

- [ ] **Step 1: Write Setlist.fm types**

Create `lib/api/setlistfm/types.ts`:

```typescript
export interface SLFArtist {
  mbid: string;
  name: string;
  sortName: string;
  disambiguation?: string;
  url: string;
}

export interface SLFArtistSearchResponse {
  type: string;
  itemsPerPage: number;
  page: number;
  total: number;
  artist: SLFArtist[];
}

export interface SLFSong {
  name: string;
  info?: string;
  tape?: boolean;
  cover?: { mbid: string; name: string };
}

export interface SLFSet {
  name?: string;
  encore?: number;
  song: SLFSong[];
}

export interface SLFSetlist {
  id: string;
  versionId?: string;
  eventDate: string;
  lastUpdated: string;
  artist: { mbid: string; name: string; sortName: string; url: string };
  venue: {
    id: string;
    name: string;
    city: {
      id: string;
      name: string;
      stateCode?: string;
      country: { code: string; name: string };
    };
    url: string;
  };
  sets: { set: SLFSet[] };
  url: string;
  info?: string;
}

export interface SLFSetlistsResponse {
  type: string;
  itemsPerPage: number;
  page: number;
  total: number;
  setlist: SLFSetlist[];
}
```

- [ ] **Step 2: Write Setlist.fm client**

Create `lib/api/setlistfm/client.ts`:

```typescript
import { fetchWithRetry, delay } from "../../utils/http";
import type {
  SLFArtistSearchResponse,
  SLFArtist,
  SLFSetlistsResponse,
  SLFSetlist,
} from "./types";

const BASE = "https://api.setlist.fm/rest/1.0";

export class SetlistFmClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private headers(): HeadersInit {
    return {
      "x-api-key": this.apiKey,
      Accept: "application/json",
    };
  }

  private async get<T>(path: string, qs?: Record<string, string>): Promise<T> {
    const url = `${BASE}${path}${qs ? "?" + new URLSearchParams(qs) : ""}`;
    const res = await fetchWithRetry(url, { headers: this.headers() });

    if (res.status === 404) {
      return { setlist: [], total: 0, itemsPerPage: 20, page: 1, type: "" } as T;
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Setlist.fm GET ${path} failed ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  /**
   * Search for an artist by name to find their MBID.
   * Returns the best match (exact name first, otherwise first result).
   */
  async findArtist(name: string): Promise<SLFArtist | null> {
    const data = await this.get<SLFArtistSearchResponse>("/search/artists", {
      artistName: name,
      sort: "relevance",
      p: "1",
    });
    if (!data.artist || data.artist.length === 0) return null;
    const lower = name.toLowerCase();
    return (
      data.artist.find((a) => a.name.toLowerCase() === lower) ??
      data.artist[0]
    );
  }

  /** Fetch one page of setlists for an MBID. */
  async setlistPage(mbid: string, page = 1): Promise<SLFSetlistsResponse> {
    return this.get<SLFSetlistsResponse>(`/artist/${mbid}/setlists`, {
      p: String(page),
    });
  }

  /**
   * Yield up to maxPages pages of setlists for an MBID.
   * 500ms delay between pages to respect the 2 req/s limit.
   */
  async *setlists(mbid: string, maxPages = 3): AsyncGenerator<SLFSetlist> {
    for (let page = 1; page <= maxPages; page++) {
      const data = await this.setlistPage(mbid, page);
      const items = data.setlist ?? [];
      for (const sl of items) yield sl;
      if (items.length < data.itemsPerPage) break;
      if (page < maxPages) await delay(500);
    }
  }
}
```

- [ ] **Step 3: Write Setlist.fm normalizer**

Create `lib/api/setlistfm/normalizer.ts`:

```typescript
import type { SLFSetlist } from "./types";

/** Shape written to the `setlists` table. */
export interface SetlistInsert {
  artistId: string;
  setlistfmId: string;
  eventDate: string;       // "YYYY-MM-DD"
  venueName: string;
  cityName: string;
  country: string;
  songs: Array<{ name: string; info?: string; isCover: boolean }>;
  sourceUrl: string;
}

/**
 * Convert a Setlist.fm setlist response to a DB-ready shape.
 * eventDate from SLF is "DD-MM-YYYY" → we convert to "YYYY-MM-DD".
 */
export function normalizeSetlist(
  sl: SLFSetlist,
  artistId: string
): SetlistInsert | null {
  if (!sl.id) return null;

  // Parse "DD-MM-YYYY" → "YYYY-MM-DD"
  const [dd, mm, yyyy] = sl.eventDate.split("-");
  if (!dd || !mm || !yyyy) return null;
  const eventDate = `${yyyy}-${mm}-${dd}`;

  // Flatten all songs from all sets
  const songs = sl.sets.set.flatMap((s) =>
    (s.song ?? []).map((song) => ({
      name: song.name,
      info: song.info,
      isCover: !!song.cover,
    }))
  );

  return {
    artistId,
    setlistfmId: sl.id,
    eventDate,
    venueName: sl.venue.name,
    cityName: sl.venue.city.name,
    country: sl.venue.city.country.code,
    songs,
    sourceUrl: sl.url,
  };
}
```

- [ ] **Step 4: Write Setlist.fm fetch script**

Create `scripts/fetch-setlists.ts`:

```typescript
import { query, queryOne } from "../lib/db";
import { SetlistFmClient } from "../lib/api/setlistfm/client";
import { normalizeSetlist } from "../lib/api/setlistfm/normalizer";
import { delay } from "../lib/utils/http";

const DRY_RUN = process.argv.includes("--dry-run");
const DELAY_BETWEEN_ARTISTS_MS = 600;

async function saveSetlist(ins: ReturnType<typeof normalizeSetlist>): Promise<boolean> {
  if (!ins) return false;
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM setlists WHERE setlistfm_id = $1`,
    [ins.setlistfmId]
  );
  if (existing) return false;

  await queryOne(
    `INSERT INTO setlists
       (artist_id, setlistfm_id, event_date, venue_name, city_name, country, songs, source_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (setlistfm_id) DO NOTHING`,
    [
      ins.artistId,
      ins.setlistfmId,
      ins.eventDate,
      ins.venueName,
      ins.cityName,
      ins.country,
      JSON.stringify(ins.songs),
      ins.sourceUrl,
    ]
  );
  return true;
}

async function main() {
  const apiKey = process.env.SETLISTFM_API_KEY;
  if (!apiKey) {
    console.error("[setlistfm] SETLISTFM_API_KEY not set — skipping");
    process.exit(0);
  }

  if (DRY_RUN) console.log("[setlistfm] DRY RUN — no DB writes");

  const client = new SetlistFmClient(apiKey);

  // Process artists that have a spotify_id (popularity signal) or are in popular events
  const artists = await query<{ id: string; name: string; mbid: string | null }>(
    `SELECT id, name, mbid FROM artists
     WHERE (spotify_id IS NOT NULL OR popularity >= 60)
     ORDER BY popularity DESC NULLS LAST
     LIMIT 200`
  );

  console.log(`[setlistfm] processing ${artists.length} artists`);

  const stats = { artists: 0, setlists_saved: 0, not_found: 0, errors: 0 };

  for (const artist of artists) {
    stats.artists++;
    let mbid = artist.mbid;

    try {
      if (!mbid) {
        const found = await client.findArtist(artist.name);
        if (!found) {
          stats.not_found++;
          console.log(`[setlistfm] artist not found: "${artist.name}"`);
          await delay(DELAY_BETWEEN_ARTISTS_MS);
          continue;
        }
        mbid = found.mbid;

        if (!DRY_RUN) {
          await queryOne(
            `UPDATE artists SET mbid = $2 WHERE id = $1`,
            [artist.id, mbid]
          );
        }
        console.log(`[setlistfm] resolved mbid for "${artist.name}" → ${mbid}`);
        await delay(500);
      }

      let setlistCount = 0;
      for await (const sl of client.setlists(mbid, 3)) {
        const normalized = normalizeSetlist(sl, artist.id);
        if (!normalized) continue;

        if (DRY_RUN) {
          console.log(
            `[setlistfm] would save setlist ${sl.id} for "${artist.name}" on ${normalized.eventDate} (${normalized.songs.length} songs)`
          );
          setlistCount++;
          continue;
        }

        const saved = await saveSetlist(normalized);
        if (saved) {
          setlistCount++;
          stats.setlists_saved++;
        }
      }

      if (setlistCount > 0) {
        console.log(`[setlistfm] "${artist.name}" → ${setlistCount} setlists saved`);
      }
    } catch (err) {
      stats.errors++;
      console.error(
        `[setlistfm] error for "${artist.name}": ${err instanceof Error ? err.message : String(err)}`
      );
    }

    await delay(DELAY_BETWEEN_ARTISTS_MS);
  }

  console.log(
    `[setlistfm] done. artists=${stats.artists} setlists_saved=${stats.setlists_saved} not_found=${stats.not_found} errors=${stats.errors}`
  );
}

main().catch((err) => {
  console.error("[setlistfm] fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 5: Add scripts to package.json**

In `package.json` `"scripts"`, add:

```json
"fetch:setlists": "dotenv -e .env.local -- tsx scripts/fetch-setlists.ts",
"fetch:setlists:dry": "dotenv -e .env.local -- tsx scripts/fetch-setlists.ts --dry-run"
```

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add lib/api/setlistfm/ scripts/fetch-setlists.ts package.json
git commit -m "feat(phase6): Setlist.fm client, types, normalizer, and fetch script"
```

---

## Task 9: Boletia scraper

**Files:**
- Create: `lib/scrapers/boletia/types.ts`
- Create: `lib/scrapers/boletia/scraper.ts`
- Create: `lib/scrapers/boletia/normalizer.ts`
- Create: `scripts/scrape-boletia.ts`
- Modify: `package.json`

- [ ] **Step 1: Write Boletia types**

Create `lib/scrapers/boletia/types.ts`:

```typescript
/** Raw event data extracted from Boletia HTML. */
export interface BoletiaRawEvent {
  /** Event page URL on boletia.com */
  url: string;
  title: string;
  artistName: string;
  venueName: string;
  cityName: string;
  dateIso: string;         // "YYYY-MM-DDTHH:mm:ss"
  imageUrl?: string;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  sourceId: string;        // extracted from URL slug or data-id
}
```

- [ ] **Step 2: Write Boletia scraper**

Create `lib/scrapers/boletia/scraper.ts`:

```typescript
import { chromium, type Browser, type Page } from "playwright";
import { delay } from "../../utils/http";
import type { BoletiaRawEvent } from "./types";

const BASE = "https://boletia.com";
const DELAY_BETWEEN_PAGES_MS = 800;
const DELAY_BETWEEN_EVENTS_MS = 500;

async function extractEventLinks(page: Page): Promise<string[]> {
  // Boletia event cards link to /eventos/<slug> or /e/<slug>
  const hrefs = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("a[href]")) as HTMLAnchorElement[];
    return links
      .map((a) => a.href)
      .filter((href) => /boletia\.com\/(eventos?|e)\/[^/]+$/.test(href));
  });
  return [...new Set(hrefs)];
}

async function scrapeEventPage(
  page: Page,
  url: string
): Promise<BoletiaRawEvent | null> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await delay(500);

  return page.evaluate((pageUrl) => {
    // Try JSON-LD first (most reliable)
    const ldScripts = Array.from(
      document.querySelectorAll('script[type="application/ld+json"]')
    );
    for (const script of ldScripts) {
      try {
        const data = JSON.parse(script.textContent ?? "");
        if (data["@type"] === "MusicEvent" || data["@type"] === "Event") {
          const performer = Array.isArray(data.performer)
            ? data.performer[0]?.name
            : data.performer?.name;
          const location = data.location;
          const slug = pageUrl.split("/").pop() ?? pageUrl;
          return {
            url: pageUrl,
            title: data.name ?? "",
            artistName: performer ?? data.name ?? "",
            venueName: location?.name ?? "Por confirmar",
            cityName:
              location?.address?.addressLocality ??
              location?.address?.addressRegion ??
              "",
            dateIso: data.startDate ?? "",
            imageUrl: data.image ?? undefined,
            minPrice: data.offers?.lowPrice ?? undefined,
            maxPrice: data.offers?.highPrice ?? undefined,
            currency: data.offers?.priceCurrency ?? "MXN",
            sourceId: slug,
          };
        }
      } catch {}
    }

    // Fallback: extract from visible DOM
    const title =
      document.querySelector("h1")?.textContent?.trim() ?? "";
    const dateEl = document.querySelector("[data-date], .event-date, time");
    const dateIso = dateEl?.getAttribute("datetime") ?? dateEl?.textContent?.trim() ?? "";
    const priceEl = document.querySelector(".price, .ticket-price, [data-price]");
    const priceText = priceEl?.textContent?.trim() ?? "";
    const priceNum = parseFloat(priceText.replace(/[^0-9.]/g, ""));

    const slug = pageUrl.split("/").pop() ?? pageUrl;
    return {
      url: pageUrl,
      title,
      artistName: title,
      venueName: "Por confirmar",
      cityName: "",
      dateIso,
      minPrice: isNaN(priceNum) ? undefined : priceNum,
      sourceId: slug,
    };
  }, url);
}

export async function scrapeBoletia(maxEvents = 100): Promise<BoletiaRawEvent[]> {
  const browser = await chromium.launch({ headless: true });
  const results: BoletiaRawEvent[] = [];

  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
      "User-Agent":
        "Mozilla/5.0 (compatible; TicketHubBot/1.0; +https://tickethub.mx/bot)",
    });

    // Collect event links from the main listing and a music category page
    const listingUrls = [
      `${BASE}/conciertos`,
      `${BASE}/musica`,
      `${BASE}/eventos`,
    ];

    const allLinks: string[] = [];
    for (const listingUrl of listingUrls) {
      try {
        await page.goto(listingUrl, { waitUntil: "networkidle", timeout: 20_000 });
        await delay(1000);
        const links = await extractEventLinks(page);
        console.log(`[boletia] ${listingUrl}: ${links.length} event links`);
        allLinks.push(...links);
      } catch (err) {
        console.warn(
          `[boletia] failed to load listing ${listingUrl}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      await delay(DELAY_BETWEEN_PAGES_MS);
    }

    const uniqueLinks = [...new Set(allLinks)].slice(0, maxEvents);
    console.log(`[boletia] scraping ${uniqueLinks.length} unique event pages`);

    for (const link of uniqueLinks) {
      try {
        const ev = await scrapeEventPage(page, link);
        if (ev && ev.title) {
          results.push(ev);
        }
      } catch (err) {
        console.warn(
          `[boletia] error on ${link}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      await delay(DELAY_BETWEEN_EVENTS_MS);
    }
  } finally {
    await browser.close();
  }

  return results;
}
```

- [ ] **Step 3: Write Boletia normalizer**

Create `lib/scrapers/boletia/normalizer.ts`:

```typescript
import type { BoletiaRawEvent } from "./types";
import type { NormalizedEvent } from "../../types";

const CITY_MAP: Record<string, string> = {
  "Ciudad de México": "Ciudad de Mexico",
  "CDMX": "Ciudad de Mexico",
  "Mexico City": "Ciudad de Mexico",
  "Guadalajara": "Guadalajara",
  "Monterrey": "Monterrey",
  "Puebla": "Puebla",
  "Querétaro": "Queretaro",
  "Tijuana": "Tijuana",
  "León": "Leon",
};

function normalizeCity(raw?: string): string | null {
  if (!raw) return null;
  return CITY_MAP[raw] ?? raw;
}

export function normalizeBoletiaEvent(
  raw: BoletiaRawEvent
): NormalizedEvent | null {
  if (!raw.title || !raw.dateIso) return null;

  const date = new Date(raw.dateIso);
  if (isNaN(date.getTime())) return null;

  const cityName = normalizeCity(raw.cityName);
  if (!cityName) return null;

  const artistName = raw.artistName?.trim() || raw.title;

  return {
    sourceId: raw.sourceId,
    sourcePlatform: "boletia",
    title: raw.title.trim(),
    artistName,
    venueName: raw.venueName?.trim() || "Por confirmar",
    cityName,
    date,
    url: raw.url,
    minPrice: raw.minPrice,
    maxPrice: raw.maxPrice,
    currency: raw.currency ?? "MXN",
    imageUrl: raw.imageUrl,
    isResale: false,
  };
}
```

- [ ] **Step 4: Write Boletia scrape script**

Create `scripts/scrape-boletia.ts`:

```typescript
import { scrapeBoletia } from "../lib/scrapers/boletia/scraper";
import { normalizeBoletiaEvent } from "../lib/scrapers/boletia/normalizer";
import { ingestNormalizedEvent } from "../lib/dedupe/ingest";

const DRY_RUN = process.argv.includes("--dry-run");
const MAX_EVENTS = parseInt(
  process.argv.find((a) => a.startsWith("--max="))?.split("=")[1] ?? "100",
  10
);

async function main() {
  if (DRY_RUN) console.log("[boletia] DRY RUN — no DB writes");

  console.log(`[boletia] starting scrape (max=${MAX_EVENTS})`);
  const raw = await scrapeBoletia(MAX_EVENTS);
  console.log(`[boletia] scraped ${raw.length} raw events`);

  const stats = {
    scraped: raw.length,
    skipped: 0,
    created: 0,
    merged: 0,
    ambiguous: 0,
    tribute_rejected: 0,
    unknown_city: 0,
    errors: 0,
  };

  for (const ev of raw) {
    const normalized = normalizeBoletiaEvent(ev);
    if (!normalized) {
      stats.skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `[boletia] would ingest: "${normalized.title}" (${normalized.cityName}, ${normalized.date.toISOString().slice(0, 10)})`
      );
      continue;
    }

    try {
      const result = await ingestNormalizedEvent(normalized);
      console.log(result.log);
      switch (result.action) {
        case "created":           stats.created++; break;
        case "merged":            stats.merged++; break;
        case "ambiguous_skipped": stats.ambiguous++; break;
        case "rejected_tribute":  stats.tribute_rejected++; break;
        case "rejected_unknown_city": stats.unknown_city++; break;
      }
    } catch (err) {
      stats.errors++;
      console.error(
        `[boletia] error ingesting "${ev.title}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.log(
    `[boletia] done. scraped=${stats.scraped} skipped=${stats.skipped} ` +
    `created=${stats.created} merged=${stats.merged} ambiguous=${stats.ambiguous} ` +
    `tribute_rejected=${stats.tribute_rejected} unknown_city=${stats.unknown_city} errors=${stats.errors}`
  );
}

main().catch((err) => {
  console.error("[boletia] fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 5: Update scrape:boletia script in package.json**

In `package.json`, update `"scrape:boletia"` and add dry-run variant:

```json
"scrape:boletia": "dotenv -e .env.local -- tsx scripts/scrape-boletia.ts",
"scrape:boletia:dry": "dotenv -e .env.local -- tsx scripts/scrape-boletia.ts --dry-run"
```

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add lib/scrapers/boletia/ scripts/scrape-boletia.ts package.json
git commit -m "feat(phase6): Boletia Playwright scraper with dry-run"
```

---

## Task 10: Superboletos scraper

**Files:**
- Create: `lib/scrapers/superboletos/types.ts`
- Create: `lib/scrapers/superboletos/scraper.ts`
- Create: `lib/scrapers/superboletos/normalizer.ts`
- Create: `scripts/scrape-superboletos.ts`
- Modify: `package.json`

- [ ] **Step 1: Write Superboletos types**

Create `lib/scrapers/superboletos/types.ts`:

```typescript
export interface SuperboletosRawEvent {
  url: string;
  title: string;
  artistName: string;
  venueName: string;
  cityName: string;
  dateIso: string;
  imageUrl?: string;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  sourceId: string;
}
```

- [ ] **Step 2: Write Superboletos scraper**

Create `lib/scrapers/superboletos/scraper.ts`:

```typescript
import { chromium, type Page } from "playwright";
import { delay } from "../../utils/http";
import type { SuperboletosRawEvent } from "./types";

const BASE = "https://www.superboletos.com";
const DELAY_BETWEEN_PAGES_MS = 800;
const DELAY_BETWEEN_EVENTS_MS = 500;

async function extractEventLinks(page: Page): Promise<string[]> {
  const hrefs = await page.evaluate(() => {
    const links = Array.from(
      document.querySelectorAll("a[href]")
    ) as HTMLAnchorElement[];
    return links
      .map((a) => a.href)
      .filter(
        (href) =>
          /superboletos\.com\/(comprar|evento|eventos?)\/[^/]+/.test(href)
      );
  });
  return [...new Set(hrefs)];
}

async function scrapeEventPage(
  page: Page,
  url: string
): Promise<SuperboletosRawEvent | null> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await delay(500);

  return page.evaluate((pageUrl) => {
    // Try JSON-LD first
    const ldScripts = Array.from(
      document.querySelectorAll('script[type="application/ld+json"]')
    );
    for (const script of ldScripts) {
      try {
        const data = JSON.parse(script.textContent ?? "");
        if (data["@type"] === "MusicEvent" || data["@type"] === "Event") {
          const performer = Array.isArray(data.performer)
            ? data.performer[0]?.name
            : data.performer?.name;
          const location = data.location;
          const slug = pageUrl.split("/").filter(Boolean).pop() ?? pageUrl;
          return {
            url: pageUrl,
            title: data.name ?? "",
            artistName: performer ?? data.name ?? "",
            venueName: location?.name ?? "Por confirmar",
            cityName:
              location?.address?.addressLocality ??
              location?.address?.addressRegion ??
              "",
            dateIso: data.startDate ?? "",
            imageUrl: typeof data.image === "string" ? data.image : data.image?.[0] ?? undefined,
            minPrice: data.offers?.lowPrice ?? undefined,
            maxPrice: data.offers?.highPrice ?? undefined,
            currency: data.offers?.priceCurrency ?? "MXN",
            sourceId: slug,
          };
        }
      } catch {}
    }

    // Fallback
    const title = document.querySelector("h1")?.textContent?.trim() ?? "";
    const dateEl = document.querySelector("time, [data-fecha], .fecha-evento");
    const dateIso = dateEl?.getAttribute("datetime") ?? dateEl?.textContent?.trim() ?? "";
    const slug = pageUrl.split("/").filter(Boolean).pop() ?? pageUrl;
    return {
      url: pageUrl,
      title,
      artistName: title,
      venueName: "Por confirmar",
      cityName: "",
      dateIso,
      sourceId: slug,
    };
  }, url);
}

export async function scrapeSuperboletos(
  maxEvents = 100
): Promise<SuperboletosRawEvent[]> {
  const browser = await chromium.launch({ headless: true });
  const results: SuperboletosRawEvent[] = [];

  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
      "User-Agent":
        "Mozilla/5.0 (compatible; TicketHubBot/1.0; +https://tickethub.mx/bot)",
    });

    const listingUrls = [
      `${BASE}/conciertos`,
      `${BASE}/musica`,
      `${BASE}`,
    ];

    const allLinks: string[] = [];
    for (const listingUrl of listingUrls) {
      try {
        await page.goto(listingUrl, { waitUntil: "networkidle", timeout: 20_000 });
        await delay(1000);
        const links = await extractEventLinks(page);
        console.log(`[superboletos] ${listingUrl}: ${links.length} event links`);
        allLinks.push(...links);
      } catch (err) {
        console.warn(
          `[superboletos] failed to load listing ${listingUrl}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      await delay(DELAY_BETWEEN_PAGES_MS);
    }

    const uniqueLinks = [...new Set(allLinks)].slice(0, maxEvents);
    console.log(`[superboletos] scraping ${uniqueLinks.length} unique event pages`);

    for (const link of uniqueLinks) {
      try {
        const ev = await scrapeEventPage(page, link);
        if (ev && ev.title) results.push(ev);
      } catch (err) {
        console.warn(
          `[superboletos] error on ${link}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      await delay(DELAY_BETWEEN_EVENTS_MS);
    }
  } finally {
    await browser.close();
  }

  return results;
}
```

- [ ] **Step 3: Write Superboletos normalizer**

Create `lib/scrapers/superboletos/normalizer.ts`:

```typescript
import type { SuperboletosRawEvent } from "./types";
import type { NormalizedEvent } from "../../types";

const CITY_MAP: Record<string, string> = {
  "Ciudad de México": "Ciudad de Mexico",
  "CDMX": "Ciudad de Mexico",
  "Mexico City": "Ciudad de Mexico",
  "Guadalajara": "Guadalajara",
  "Monterrey": "Monterrey",
  "Puebla": "Puebla",
  "Querétaro": "Queretaro",
  "Tijuana": "Tijuana",
  "León": "Leon",
};

function normalizeCity(raw?: string): string | null {
  if (!raw) return null;
  return CITY_MAP[raw] ?? raw;
}

export function normalizeSuperboletosEvent(
  raw: SuperboletosRawEvent
): NormalizedEvent | null {
  if (!raw.title || !raw.dateIso) return null;

  const date = new Date(raw.dateIso);
  if (isNaN(date.getTime())) return null;

  const cityName = normalizeCity(raw.cityName);
  if (!cityName) return null;

  const artistName = raw.artistName?.trim() || raw.title;

  return {
    sourceId: raw.sourceId,
    sourcePlatform: "superboletos",
    title: raw.title.trim(),
    artistName,
    venueName: raw.venueName?.trim() || "Por confirmar",
    cityName,
    date,
    url: raw.url,
    minPrice: raw.minPrice,
    maxPrice: raw.maxPrice,
    currency: raw.currency ?? "MXN",
    imageUrl: raw.imageUrl,
    isResale: false,
  };
}
```

- [ ] **Step 4: Write Superboletos scrape script**

Create `scripts/scrape-superboletos.ts`:

```typescript
import { scrapeSuperboletos } from "../lib/scrapers/superboletos/scraper";
import { normalizeSuperboletosEvent } from "../lib/scrapers/superboletos/normalizer";
import { ingestNormalizedEvent } from "../lib/dedupe/ingest";

const DRY_RUN = process.argv.includes("--dry-run");
const MAX_EVENTS = parseInt(
  process.argv.find((a) => a.startsWith("--max="))?.split("=")[1] ?? "100",
  10
);

async function main() {
  if (DRY_RUN) console.log("[superboletos] DRY RUN — no DB writes");

  console.log(`[superboletos] starting scrape (max=${MAX_EVENTS})`);
  const raw = await scrapeSuperboletos(MAX_EVENTS);
  console.log(`[superboletos] scraped ${raw.length} raw events`);

  const stats = {
    scraped: raw.length,
    skipped: 0,
    created: 0,
    merged: 0,
    ambiguous: 0,
    tribute_rejected: 0,
    unknown_city: 0,
    errors: 0,
  };

  for (const ev of raw) {
    const normalized = normalizeSuperboletosEvent(ev);
    if (!normalized) {
      stats.skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `[superboletos] would ingest: "${normalized.title}" (${normalized.cityName}, ${normalized.date.toISOString().slice(0, 10)})`
      );
      continue;
    }

    try {
      const result = await ingestNormalizedEvent(normalized);
      console.log(result.log);
      switch (result.action) {
        case "created":           stats.created++; break;
        case "merged":            stats.merged++; break;
        case "ambiguous_skipped": stats.ambiguous++; break;
        case "rejected_tribute":  stats.tribute_rejected++; break;
        case "rejected_unknown_city": stats.unknown_city++; break;
      }
    } catch (err) {
      stats.errors++;
      console.error(
        `[superboletos] error ingesting "${ev.title}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.log(
    `[superboletos] done. scraped=${stats.scraped} skipped=${stats.skipped} ` +
    `created=${stats.created} merged=${stats.merged} ambiguous=${stats.ambiguous} ` +
    `tribute_rejected=${stats.tribute_rejected} unknown_city=${stats.unknown_city} errors=${stats.errors}`
  );
}

main().catch((err) => {
  console.error("[superboletos] fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 5: Update package.json scripts**

In `package.json`, update `"scrape:superboletos"` and add dry-run variant:

```json
"scrape:superboletos": "dotenv -e .env.local -- tsx scripts/scrape-superboletos.ts",
"scrape:superboletos:dry": "dotenv -e .env.local -- tsx scripts/scrape-superboletos.ts --dry-run"
```

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add lib/scrapers/superboletos/ scripts/scrape-superboletos.ts package.json
git commit -m "feat(phase6): Superboletos Playwright scraper with dry-run"
```

---

## Task 11: StubHub – types + client + normalizer + script

**Files:**
- Create: `lib/api/stubhub/types.ts`
- Create: `lib/api/stubhub/client.ts`
- Create: `lib/api/stubhub/normalizer.ts`
- Create: `scripts/ingest-stubhub.ts`
- Modify: `package.json`

- [ ] **Step 1: Write StubHub types**

Create `lib/api/stubhub/types.ts`:

```typescript
export interface SHTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface SHPerformer {
  id: number;
  name: string;
  primaryAct: boolean;
}

export interface SHVenue {
  id: number;
  name: string;
  city: string;
  state: string;
  country: string;
  lat?: number;
  lon?: number;
}

export interface SHTicketInfo {
  minPrice: number;
  maxPrice: number;
  currency: string;
  totalTickets: number;
}

export interface SHEvent {
  id: number;
  name: string;
  dateLocal: string;          // "YYYY-MM-DDTHH:mm:ss"
  status: "Active" | "Cancelled" | "Postponed";
  performers: SHPerformer[];
  venue: SHVenue;
  eventUrl: string;
  imageUrl?: string;
  ticketInfo?: SHTicketInfo;
}

export interface SHEventsResponse {
  events: SHEvent[];
  totalResults: number;
  page: number;
  pageSize: number;
}
```

- [ ] **Step 2: Write StubHub client**

Create `lib/api/stubhub/client.ts`:

```typescript
import { fetchWithRetry, delay } from "../../utils/http";
import type { SHTokenResponse, SHEventsResponse, SHEvent } from "./types";

const AUTH_BASE = "https://account.stubhub.com";
const API_BASE = "https://api.stubhub.com";

export class StubHubClient {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  private async ensureToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 30_000) return;

    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString("base64");

    const res = await fetchWithRetry(`${AUTH_BASE}/sellers/oauth/accesstoken`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=read:events",
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`StubHub token failed ${res.status}: ${body}`);
    }

    const data = (await res.json()) as SHTokenResponse;
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
  }

  private async get<T>(path: string, qs?: Record<string, string>): Promise<T> {
    await this.ensureToken();
    const url = `${API_BASE}${path}${qs ? "?" + new URLSearchParams(qs) : ""}`;
    const res = await fetchWithRetry(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Accept-Language": "es-MX",
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`StubHub GET ${path} failed ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async searchPage(params: {
    query: string;
    rows?: number;
    start?: number;
  }): Promise<SHEventsResponse> {
    return this.get<SHEventsResponse>("/catalog/events/v1", {
      q: params.query,
      rows: String(params.rows ?? 50),
      start: String(params.start ?? 0),
      country: "MX",
      sort: "date asc",
    });
  }

  /**
   * Yield up to maxEvents resale events for Mexico concerts.
   */
  async *mexicoConcerts(maxEvents = 200): AsyncGenerator<SHEvent> {
    const queries = ["concierto mexico", "concert mexico city", "guadalajara concierto"];
    let yielded = 0;

    for (const q of queries) {
      if (yielded >= maxEvents) break;
      let start = 0;

      while (yielded < maxEvents) {
        const data = await this.searchPage({ query: q, rows: 50, start });
        const events = data.events ?? [];
        if (events.length === 0) break;

        for (const ev of events) {
          yield ev;
          yielded++;
        }

        start += events.length;
        if (start >= data.totalResults) break;
        await delay(300);
      }
    }
  }
}
```

- [ ] **Step 3: Write StubHub normalizer**

Create `lib/api/stubhub/normalizer.ts`:

```typescript
import type { SHEvent } from "./types";
import type { NormalizedEvent } from "../../types";

const CITY_MAP: Record<string, string> = {
  "Mexico City": "Ciudad de Mexico",
  "Ciudad de Mexico": "Ciudad de Mexico",
  "Guadalajara": "Guadalajara",
  "Monterrey": "Monterrey",
  "Puebla": "Puebla",
  "Queretaro": "Queretaro",
  "Tijuana": "Tijuana",
  "Leon": "Leon",
};

export function normalizeStubHubEvent(ev: SHEvent): NormalizedEvent | null {
  if (ev.status !== "Active") return null;

  const date = new Date(ev.dateLocal);
  if (isNaN(date.getTime())) return null;

  const cityName = CITY_MAP[ev.venue.city] ?? ev.venue.city;
  if (!cityName) return null;

  const headliner =
    ev.performers.find((p) => p.primaryAct)?.name ??
    ev.performers[0]?.name ??
    ev.name;

  return {
    sourceId: String(ev.id),
    sourcePlatform: "stubhub",
    title: ev.name.trim(),
    artistName: headliner.trim(),
    venueName: ev.venue.name.trim() || "Por confirmar",
    cityName,
    date,
    url: ev.eventUrl,
    minPrice: ev.ticketInfo?.minPrice,
    maxPrice: ev.ticketInfo?.maxPrice,
    currency: ev.ticketInfo?.currency ?? "MXN",
    imageUrl: ev.imageUrl,
    isResale: true,
  };
}
```

- [ ] **Step 4: Write StubHub ingest script**

Create `scripts/ingest-stubhub.ts`:

```typescript
import { StubHubClient } from "../lib/api/stubhub/client";
import { normalizeStubHubEvent } from "../lib/api/stubhub/normalizer";
import { ingestNormalizedEvent } from "../lib/dedupe/ingest";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const clientId = process.env.STUBHUB_CLIENT_ID;
  const clientSecret = process.env.STUBHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("[stubhub] STUBHUB_CLIENT_ID / STUBHUB_CLIENT_SECRET not set — skipping");
    process.exit(0);
  }

  if (DRY_RUN) console.log("[stubhub] DRY RUN — no DB writes");

  const client = new StubHubClient(clientId, clientSecret);

  const stats = {
    fetched: 0,
    skipped: 0,
    created: 0,
    merged: 0,
    ambiguous: 0,
    tribute_rejected: 0,
    unknown_city: 0,
    errors: 0,
  };

  for await (const ev of client.mexicoConcerts(200)) {
    stats.fetched++;
    const normalized = normalizeStubHubEvent(ev);
    if (!normalized) { stats.skipped++; continue; }

    if (DRY_RUN) {
      console.log(
        `[stubhub] would ingest: "${normalized.title}" (${normalized.cityName}, ${normalized.date.toISOString().slice(0, 10)})`
      );
      continue;
    }

    try {
      const result = await ingestNormalizedEvent(normalized);
      console.log(result.log);
      switch (result.action) {
        case "created":           stats.created++; break;
        case "merged":            stats.merged++; break;
        case "ambiguous_skipped": stats.ambiguous++; break;
        case "rejected_tribute":  stats.tribute_rejected++; break;
        case "rejected_unknown_city": stats.unknown_city++; break;
      }
    } catch (err) {
      stats.errors++;
      console.error(
        `[stubhub] error for event ${ev.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.log(
    `[stubhub] done. fetched=${stats.fetched} skipped=${stats.skipped} ` +
    `created=${stats.created} merged=${stats.merged} ambiguous=${stats.ambiguous} ` +
    `tribute_rejected=${stats.tribute_rejected} unknown_city=${stats.unknown_city} errors=${stats.errors}`
  );
}

main().catch((err) => {
  console.error("[stubhub] fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 5: Add scripts to package.json**

```json
"ingest:stubhub": "dotenv -e .env.local -- tsx scripts/ingest-stubhub.ts",
"ingest:stubhub:dry": "dotenv -e .env.local -- tsx scripts/ingest-stubhub.ts --dry-run"
```

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add lib/api/stubhub/ scripts/ingest-stubhub.ts package.json
git commit -m "feat(phase6): StubHub client, types, normalizer, and ingest script"
```

---

## Task 12: Ticketmaster enrichment – types + client + enricher + script

**Files:**
- Create: `lib/api/ticketmaster/types.ts`
- Create: `lib/api/ticketmaster/client.ts`
- Create: `lib/api/ticketmaster/enricher.ts`
- Create: `scripts/enrich-ticketmaster.ts`
- Modify: `package.json`

- [ ] **Step 1: Write Ticketmaster types**

Create `lib/api/ticketmaster/types.ts`:

```typescript
export interface TMImage {
  url: string;
  width: number;
  height: number;
  ratio: "16_9" | "3_2" | "4_3" | string;
  fallback?: boolean;
}

export interface TMClassification {
  primary: boolean;
  segment: { id: string; name: string };
  genre?: { id: string; name: string };
  subGenre?: { id: string; name: string };
}

export interface TMAttraction {
  id: string;
  name: string;
  type: string;
  images?: TMImage[];
  classifications?: TMClassification[];
}

export interface TMVenue {
  id: string;
  name: string;
  city?: { name: string };
  state?: { name: string };
  country?: { countryCode: string; name: string };
  address?: { line1: string };
  location?: { latitude: string; longitude: string };
}

export interface TMEvent {
  id: string;
  name: string;
  type: string;
  url: string;
  images: TMImage[];
  dates: {
    start: { localDate: string; localTime?: string; dateTime?: string };
    status: { code: "onsale" | "offsale" | "cancelled" | "postponed" | string };
  };
  priceRanges?: Array<{
    type: string;
    currency: string;
    min: number;
    max: number;
  }>;
  _embedded?: {
    venues?: TMVenue[];
    attractions?: TMAttraction[];
  };
}

export interface TMEventsResponse {
  _embedded?: {
    events: TMEvent[];
  };
  page: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
}
```

- [ ] **Step 2: Write Ticketmaster client**

Create `lib/api/ticketmaster/client.ts`:

```typescript
import { fetchWithRetry, delay } from "../../utils/http";
import type { TMEventsResponse, TMEvent } from "./types";

const BASE = "https://app.ticketmaster.com/discovery/v2";

export class TicketmasterClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async get<T>(path: string, qs: Record<string, string> = {}): Promise<T> {
    const params = new URLSearchParams({ apikey: this.apiKey, ...qs });
    const res = await fetchWithRetry(`${BASE}${path}.json?${params}`);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Ticketmaster GET ${path} failed ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async eventsPage(page = 0): Promise<TMEventsResponse> {
    return this.get<TMEventsResponse>("/events", {
      countryCode: "MX",
      classificationName: "music",
      size: "200",
      page: String(page),
      sort: "date,asc",
    });
  }

  /**
   * Yield all music events in Mexico, up to maxEvents.
   * 300ms delay between pages.
   */
  async *mexicoMusicEvents(maxEvents = 500): AsyncGenerator<TMEvent> {
    let page = 0;
    let yielded = 0;
    let totalPages = Infinity;

    while (page < totalPages && yielded < maxEvents) {
      const data = await this.eventsPage(page);
      totalPages = data.page.totalPages;
      const events = data._embedded?.events ?? [];
      console.log(
        `[ticketmaster] page ${page + 1}/${totalPages}: ${events.length} events`
      );

      for (const ev of events) {
        yield ev;
        yielded++;
        if (yielded >= maxEvents) break;
      }

      page++;
      if (page < totalPages && yielded < maxEvents) await delay(300);
    }
  }
}
```

- [ ] **Step 3: Write Ticketmaster enricher**

The Ticketmaster enricher does not create events from scratch. It finds existing events by artist + date + city and adds a `ticketmaster` event_source + price_snapshot. If no match exists, it creates the event via `ingestNormalizedEvent`.

Create `lib/api/ticketmaster/enricher.ts`:

```typescript
import type { TMEvent } from "./types";
import type { NormalizedEvent } from "../../types";

const CITY_MAP: Record<string, string> = {
  "Mexico City": "Ciudad de Mexico",
  "Ciudad de México": "Ciudad de Mexico",
  "Guadalajara": "Guadalajara",
  "Monterrey": "Monterrey",
  "Puebla": "Puebla",
  "Querétaro": "Queretaro",
  "Tijuana": "Tijuana",
  "León": "Leon",
};

export function tmEventToNormalized(ev: TMEvent): NormalizedEvent | null {
  const status = ev.dates.status.code;
  if (status === "cancelled") return null;

  const dateStr = ev.dates.start.dateTime ?? `${ev.dates.start.localDate}T21:00:00Z`;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  const venue = ev._embedded?.venues?.[0];
  const rawCity = venue?.city?.name ?? "";
  const cityName = CITY_MAP[rawCity] ?? rawCity;
  if (!cityName) return null;

  const attraction = ev._embedded?.attractions?.[0];
  const artistName = attraction?.name ?? ev.name;

  const venueName = venue?.name?.trim() ?? "Por confirmar";

  const prices = ev.priceRanges?.find((p) => p.type === "standard") ?? ev.priceRanges?.[0];
  const minPrice = prices?.min;
  const maxPrice = prices?.max;
  const currency = prices?.currency ?? "MXN";

  const image =
    ev.images.find((i) => i.ratio === "16_9" && i.width >= 640) ??
    ev.images[0];

  return {
    sourceId: ev.id,
    sourcePlatform: "ticketmaster",
    title: ev.name.trim(),
    artistName: artistName.trim(),
    venueName,
    cityName,
    date,
    url: ev.url,
    minPrice,
    maxPrice,
    currency,
    imageUrl: image?.url,
    isResale: false,
  };
}
```

- [ ] **Step 4: Write Ticketmaster enrichment script**

Create `scripts/enrich-ticketmaster.ts`:

```typescript
import { TicketmasterClient } from "../lib/api/ticketmaster/client";
import { tmEventToNormalized } from "../lib/api/ticketmaster/enricher";
import { ingestNormalizedEvent } from "../lib/dedupe/ingest";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    console.error("[ticketmaster] TICKETMASTER_API_KEY not set — skipping");
    process.exit(0);
  }

  if (DRY_RUN) console.log("[ticketmaster] DRY RUN — no DB writes");

  const client = new TicketmasterClient(apiKey);

  const stats = {
    fetched: 0,
    skipped: 0,
    created: 0,
    merged: 0,
    ambiguous: 0,
    tribute_rejected: 0,
    unknown_city: 0,
    errors: 0,
  };

  for await (const ev of client.mexicoMusicEvents(500)) {
    stats.fetched++;
    const normalized = tmEventToNormalized(ev);
    if (!normalized) { stats.skipped++; continue; }

    if (DRY_RUN) {
      console.log(
        `[ticketmaster] would ingest: "${normalized.title}" (${normalized.cityName}, ${normalized.date.toISOString().slice(0, 10)})`
      );
      continue;
    }

    try {
      const result = await ingestNormalizedEvent(normalized);
      console.log(result.log);
      switch (result.action) {
        case "created":           stats.created++; break;
        case "merged":            stats.merged++; break;
        case "ambiguous_skipped": stats.ambiguous++; break;
        case "rejected_tribute":  stats.tribute_rejected++; break;
        case "rejected_unknown_city": stats.unknown_city++; break;
      }
    } catch (err) {
      stats.errors++;
      console.error(
        `[ticketmaster] error for ${ev.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.log(
    `[ticketmaster] done. fetched=${stats.fetched} skipped=${stats.skipped} ` +
    `created=${stats.created} merged=${stats.merged} ambiguous=${stats.ambiguous} ` +
    `tribute_rejected=${stats.tribute_rejected} unknown_city=${stats.unknown_city} errors=${stats.errors}`
  );
}

main().catch((err) => {
  console.error("[ticketmaster] fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 5: Add scripts to package.json**

```json
"enrich:ticketmaster": "dotenv -e .env.local -- tsx scripts/enrich-ticketmaster.ts",
"enrich:ticketmaster:dry": "dotenv -e .env.local -- tsx scripts/enrich-ticketmaster.ts --dry-run"
```

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add lib/api/ticketmaster/ scripts/enrich-ticketmaster.ts package.json
git commit -m "feat(phase6): Ticketmaster types, client, enricher, and script"
```

---

## Task 13: .env.local.example + final typecheck + lint

**Files:**
- Create: `.env.local.example`
- Modify: `package.json` (add db:migrate-mbid to all scripts list)

- [ ] **Step 1: Create .env.local.example**

Create `.env.local.example`:

```bash
# ─── Database ────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# ─── Eventbrite ──────────────────────────────────────────────────────────────
# Docs: https://www.eventbrite.com/platform/api
EVENTBRITE_API_KEY=

# ─── Spotify ─────────────────────────────────────────────────────────────────
# Docs: https://developer.spotify.com/documentation/web-api
# Auth: Client Credentials (no user login needed)
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=

# ─── Songkick ────────────────────────────────────────────────────────────────
# Docs: https://www.songkick.com/developer
# Note: Songkick API requires an approved partner account as of 2022.
SONGKICK_API_KEY=

# ─── Setlist.fm ──────────────────────────────────────────────────────────────
# Docs: https://api.setlist.fm/docs/1.0/index.html
# Free registration at: https://www.setlist.fm/settings/api
SETLISTFM_API_KEY=

# ─── StubHub ─────────────────────────────────────────────────────────────────
# Docs: https://developer.stubhub.com
STUBHUB_CLIENT_ID=
STUBHUB_CLIENT_SECRET=

# ─── Ticketmaster ────────────────────────────────────────────────────────────
# Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
# Free developer key at: https://developer-acct.ticketmaster.com/user/register
TICKETMASTER_API_KEY=

# ─── OpenAI (content generation — Phase 7) ───────────────────────────────────
OPENAI_API_KEY=
```

- [ ] **Step 2: Final typecheck**

```bash
npm run typecheck
```

Expected: No errors across all new files.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: No errors. Fix any `prefer-const` or import-order warnings before committing.

- [ ] **Step 4: Commit**

```bash
git add .env.local.example
git commit -m "feat(phase6): add .env.local.example with all data source placeholders"
```

---

## Definition of Done Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run ingest:eventbrite:dry` exits 0 (skips gracefully if no API key)
- [ ] `npm run ingest:songkick:dry` exits 0 (skips gracefully if no API key)
- [ ] `npm run enrich:spotify:dry` exits 0 (skips gracefully if no API key)
- [ ] `npm run fetch:setlists:dry` exits 0 (skips gracefully if no API key)
- [ ] `npm run scrape:boletia:dry` exits 0 (no DB required, no crash)
- [ ] `npm run scrape:superboletos:dry` exits 0 (no DB required, no crash)
- [ ] All scripts print aggregated stats at exit
- [ ] No real secrets committed — `.env.local.example` uses empty placeholders
- [ ] `.env.local` is in `.gitignore`

---

## Execution Notes

**API keys for testing:**
- **Ticketmaster** and **Setlist.fm** have free developer tiers — register first.
- **Spotify** client credentials are free.
- **Eventbrite** requires an organizer account.
- **Songkick** API is invite-only; script exits cleanly with no key.
- **StubHub** requires a partner account; script exits cleanly with no key.

**Scraper selector adjustment:**
If Boletia or Superboletos update their HTML structure, the JSON-LD path in the scraper will likely still work (structured data is more stable than CSS selectors). If JSON-LD is absent, enable `headless: false` in the scraper constructor during debugging to see what Playwright loads.

**Running the MBID migration:**
Before running `fetch:setlists`, run `npm run db:migrate-mbid` once.
