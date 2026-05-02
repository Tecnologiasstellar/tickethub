# Phase 7 & 8 — Ingest Pipeline + AI Content Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all Phase 6 data sources into a scheduled ingest pipeline and generate AI-anchored content (SEO, context, FAQ, bio) for every event, artist, and venue.

**Architecture:** A shared `lib/ingest/run-api-source.ts` helper encapsulates the fetch→normalize→ingest loop so both CLI scripts and Vercel cron routes can call it with a per-run limit. Content generation uses OpenAI JSON mode with Zod validation; results are written to DB only when the schema validates — incomplete data is allowed in the prompt but inventing specifics is forbidden by the system prompt.

**Tech Stack:** Next.js 15 App Router (route handlers), Neon/Postgres, OpenAI SDK 4.x, Zod 3, tsx (CLI scripts), GitHub Actions, Playwright (scrapers — runs in GHA only).

---

## File Map

| Path | Action | Responsibility |
|---|---|---|
| `lib/ingest/run-api-source.ts` | **Create** | Generic loop: fetch paginated events, normalize, ingest with optional limit |
| `scripts/ingest-events.ts` | **Create** | CLI orchestrator: calls all API sources sequentially, prints aggregate stats |
| `app/api/cron/fetch-events/route.ts` | **Create** | POST endpoint: verifies CRON_SECRET, runs API sources with per-run limit |
| `app/api/cron/generate-content/route.ts` | **Create** | POST endpoint: verifies CRON_SECRET, processes N queued content_jobs |
| `.github/workflows/fetch-events.yml` | **Create** | Every 6 h: curl the fetch-events cron endpoint |
| `.github/workflows/scrape-events.yml` | **Create** | Daily: install Playwright + run scrape-boletia + scrape-superboletos via tsx |
| `scripts/migrate-add-content-cols.ts` | **Create** | ALTER TABLE: add `h1_title TEXT`, `faq_json JSONB` to events |
| `lib/db/schema.sql` | **Modify** | Add the two new event columns to the canonical schema |
| `lib/content/prompts.ts` | **Create** | Prompt template builders (no DB access — pure string helpers) |
| `lib/content/generate-event-context.ts` | **Create** | `generateEventContext(eventId)` — OpenAI + Zod → writes to events + content_jobs |
| `lib/content/generate-artist-bio.ts` | **Create** | `generateArtistBio(artistId)` — OpenAI + Zod → writes to artists + content_jobs |
| `lib/content/generate-venue-description.ts` | **Create** | `generateVenueDescription(venueId)` — OpenAI + Zod → writes to venues + content_jobs |
| `scripts/generate-content.ts` | **Create** | CLI batch processor: reads queued content_jobs, calls generators, prints stats |
| `package.json` | **Modify** | Add `ingest:events` and `content:generate` npm scripts |
| `.env.local.example` | **Modify** | Add `CRON_SECRET` placeholder |

---

## Task 1: Shared ingest helper (`lib/ingest/run-api-source.ts`)

**Files:**
- Create: `lib/ingest/run-api-source.ts`

- [ ] **Step 1: Create the shared helper**

```typescript
// lib/ingest/run-api-source.ts
import { ingestNormalizedEvent } from "../dedupe/ingest";
import type { NormalizedEvent } from "../types";

export interface SourceStats {
  fetched: number;
  skipped: number;
  created: number;
  merged: number;
  ambiguous: number;
  tribute_rejected: number;
  unknown_city: number;
  errors: number;
}

export async function runApiSource<T>(options: {
  tag: string;
  events: AsyncIterable<T>;
  normalize: (ev: T) => NormalizedEvent | null;
  limit?: number;
  dryRun?: boolean;
}): Promise<SourceStats> {
  const { tag, events, normalize, limit = Infinity, dryRun = false } = options;
  const stats: SourceStats = {
    fetched: 0, skipped: 0, created: 0, merged: 0,
    ambiguous: 0, tribute_rejected: 0, unknown_city: 0, errors: 0,
  };

  for await (const ev of events) {
    if (stats.fetched >= limit) break;
    stats.fetched++;

    const normalized = normalize(ev);
    if (!normalized) { stats.skipped++; continue; }

    if (dryRun) {
      console.log(
        `[${tag}] would ingest: "${normalized.title}" (${normalized.cityName}, ${normalized.date.toISOString().slice(0, 10)})`
      );
      continue;
    }

    try {
      const result = await ingestNormalizedEvent(normalized);
      console.log(result.log);
      switch (result.action) {
        case "created":               stats.created++; break;
        case "merged":                stats.merged++; break;
        case "ambiguous_skipped":     stats.ambiguous++; break;
        case "rejected_tribute":      stats.tribute_rejected++; break;
        case "rejected_unknown_city": stats.unknown_city++; break;
      }
    } catch (err) {
      stats.errors++;
      console.error(
        `[${tag}] error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return stats;
}

export function statsLine(tag: string, s: SourceStats): string {
  return (
    `[${tag}] fetched=${s.fetched} skipped=${s.skipped} ` +
    `created=${s.created} merged=${s.merged} ambiguous=${s.ambiguous} ` +
    `tribute_rejected=${s.tribute_rejected} unknown_city=${s.unknown_city} errors=${s.errors}`
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/albertovillalpando/Proyectos/TicketHub/.claude/worktrees/crazy-jackson-a72319
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/ingest/run-api-source.ts
git commit -m "feat(ingest): add shared runApiSource helper with SourceStats"
```

---

## Task 2: CLI orchestrator (`scripts/ingest-events.ts`)

**Files:**
- Create: `scripts/ingest-events.ts`

Context: each existing ingest script pulls from one platform. This script orchestrates them all. Scrapers (Playwright) are excluded — they run in GHA daily. The StubHub client's `mexicoConcerts(n)` takes a max-count param; others expose `AsyncIterable`.

- [ ] **Step 1: Create the orchestrator**

```typescript
// scripts/ingest-events.ts
import { EventbriteClient } from "../lib/api/eventbrite/client";
import { normalizeEventbriteEvent } from "../lib/api/eventbrite/normalizer";
import { SongkickClient } from "../lib/api/songkick/client";
import { normalizeSongkickEvent } from "../lib/api/songkick/normalizer";
import { StubHubClient } from "../lib/api/stubhub/client";
import { normalizeStubHubEvent } from "../lib/api/stubhub/normalizer";
import { runApiSource, statsLine, type SourceStats } from "../lib/ingest/run-api-source";

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = parseInt(
  process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "500",
  10
);

function mergeStats(a: SourceStats, b: SourceStats): SourceStats {
  return {
    fetched:          a.fetched          + b.fetched,
    skipped:          a.skipped          + b.skipped,
    created:          a.created          + b.created,
    merged:           a.merged           + b.merged,
    ambiguous:        a.ambiguous        + b.ambiguous,
    tribute_rejected: a.tribute_rejected + b.tribute_rejected,
    unknown_city:     a.unknown_city     + b.unknown_city,
    errors:           a.errors           + b.errors,
  };
}

async function main() {
  if (DRY_RUN) console.log("[ingest-events] DRY RUN — no DB writes");
  console.log(`[ingest-events] limit per source: ${LIMIT}`);

  let total: SourceStats = {
    fetched: 0, skipped: 0, created: 0, merged: 0,
    ambiguous: 0, tribute_rejected: 0, unknown_city: 0, errors: 0,
  };

  // ─── Eventbrite ────────────────────────────────────────────────
  const ebKey = process.env.EVENTBRITE_API_KEY;
  if (ebKey) {
    const client = new EventbriteClient(ebKey);
    const stats = await runApiSource({
      tag: "eventbrite",
      events: client.allMexicoEvents(),
      normalize: normalizeEventbriteEvent,
      limit: LIMIT,
      dryRun: DRY_RUN,
    });
    console.log(statsLine("eventbrite", stats));
    total = mergeStats(total, stats);
  } else {
    console.warn("[ingest-events] EVENTBRITE_API_KEY not set — skipping");
  }

  // ─── Songkick ──────────────────────────────────────────────────
  const skKey = process.env.SONGKICK_API_KEY;
  if (skKey) {
    const client = new SongkickClient(skKey);
    const stats = await runApiSource({
      tag: "songkick",
      events: client.allMexicoEvents(),
      normalize: normalizeSongkickEvent,
      limit: LIMIT,
      dryRun: DRY_RUN,
    });
    console.log(statsLine("songkick", stats));
    total = mergeStats(total, stats);
  } else {
    console.warn("[ingest-events] SONGKICK_API_KEY not set — skipping");
  }

  // ─── StubHub ───────────────────────────────────────────────────
  const shId = process.env.STUBHUB_CLIENT_ID;
  const shSecret = process.env.STUBHUB_CLIENT_SECRET;
  if (shId && shSecret) {
    const client = new StubHubClient(shId, shSecret);
    const stats = await runApiSource({
      tag: "stubhub",
      events: client.mexicoConcerts(LIMIT),
      normalize: normalizeStubHubEvent,
      limit: LIMIT,
      dryRun: DRY_RUN,
    });
    console.log(statsLine("stubhub", stats));
    total = mergeStats(total, stats);
  } else {
    console.warn("[ingest-events] STUBHUB_CLIENT_ID / STUBHUB_CLIENT_SECRET not set — skipping");
  }

  console.log("──────────────────────────────────────────────────");
  console.log(statsLine("TOTAL", total));
}

main().catch((err) => {
  console.error("[ingest-events] fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Add npm script to package.json**

In `package.json` `"scripts"`, the key `"ingest:events"` already exists pointing to `scripts/ingest-events.ts`. Verify it is present:

```bash
grep '"ingest:events"' package.json
```
Expected: `"ingest:events": "dotenv -e .env.local -- tsx scripts/ingest-events.ts"`

If missing, add it to the `"scripts"` block:
```json
"ingest:events": "dotenv -e .env.local -- tsx scripts/ingest-events.ts",
"ingest:events:dry": "dotenv -e .env.local -- tsx scripts/ingest-events.ts --dry-run",
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/ingest-events.ts package.json
git commit -m "feat(scripts): add ingest-events orchestrator for all API sources"
```

---

## Task 3: Cron endpoint — fetch-events (`app/api/cron/fetch-events/route.ts`)

**Files:**
- Create: `app/api/cron/fetch-events/route.ts`

The Vercel timeout limit is ~10 s for Hobby, 60 s for Pro. `EVENTS_PER_RUN` (default 50) keeps each source's loop short.

- [ ] **Step 1: Create the route**

```typescript
// app/api/cron/fetch-events/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/utils/cron";
import { EventbriteClient } from "@/lib/api/eventbrite/client";
import { normalizeEventbriteEvent } from "@/lib/api/eventbrite/normalizer";
import { SongkickClient } from "@/lib/api/songkick/client";
import { normalizeSongkickEvent } from "@/lib/api/songkick/normalizer";
import { StubHubClient } from "@/lib/api/stubhub/client";
import { normalizeStubHubEvent } from "@/lib/api/stubhub/normalizer";
import { runApiSource, statsLine, type SourceStats } from "@/lib/ingest/run-api-source";

const EVENTS_PER_RUN = parseInt(process.env.EVENTS_PER_RUN ?? "50", 10);

function mergeStats(a: SourceStats, b: SourceStats): SourceStats {
  return {
    fetched:          a.fetched          + b.fetched,
    skipped:          a.skipped          + b.skipped,
    created:          a.created          + b.created,
    merged:           a.merged           + b.merged,
    ambiguous:        a.ambiguous        + b.ambiguous,
    tribute_rejected: a.tribute_rejected + b.tribute_rejected,
    unknown_city:     a.unknown_city     + b.unknown_city,
    errors:           a.errors           + b.errors,
  };
}

export async function POST(req: NextRequest) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  let total: SourceStats = {
    fetched: 0, skipped: 0, created: 0, merged: 0,
    ambiguous: 0, tribute_rejected: 0, unknown_city: 0, errors: 0,
  };
  const sources: string[] = [];

  // ─── Eventbrite ────────────────────────────────────────────────
  const ebKey = process.env.EVENTBRITE_API_KEY;
  if (ebKey) {
    const client = new EventbriteClient(ebKey);
    const stats = await runApiSource({
      tag: "eventbrite",
      events: client.allMexicoEvents(),
      normalize: normalizeEventbriteEvent,
      limit: EVENTS_PER_RUN,
    });
    sources.push(statsLine("eventbrite", stats));
    total = mergeStats(total, stats);
  }

  // ─── Songkick ──────────────────────────────────────────────────
  const skKey = process.env.SONGKICK_API_KEY;
  if (skKey) {
    const client = new SongkickClient(skKey);
    const stats = await runApiSource({
      tag: "songkick",
      events: client.allMexicoEvents(),
      normalize: normalizeSongkickEvent,
      limit: EVENTS_PER_RUN,
    });
    sources.push(statsLine("songkick", stats));
    total = mergeStats(total, stats);
  }

  // ─── StubHub ───────────────────────────────────────────────────
  const shId = process.env.STUBHUB_CLIENT_ID;
  const shSecret = process.env.STUBHUB_CLIENT_SECRET;
  if (shId && shSecret) {
    const client = new StubHubClient(shId, shSecret);
    const stats = await runApiSource({
      tag: "stubhub",
      events: client.mexicoConcerts(EVENTS_PER_RUN),
      normalize: normalizeStubHubEvent,
      limit: EVENTS_PER_RUN,
    });
    sources.push(statsLine("stubhub", stats));
    total = mergeStats(total, stats);
  }

  return NextResponse.json({
    ok: true,
    eventsPerRun: EVENTS_PER_RUN,
    sources,
    total,
  });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/fetch-events/route.ts
git commit -m "feat(cron): add /api/cron/fetch-events route with CRON_SECRET auth"
```

---

## Task 4: Cron endpoint — generate-content (`app/api/cron/generate-content/route.ts`)

**Files:**
- Create: `app/api/cron/generate-content/route.ts`

This route processes up to `CONTENT_JOBS_PER_RUN` (default 10) queued content_jobs. It delegates to the generators in `lib/content/` which are created in Tasks 7–9. This task creates the route skeleton; it will import the generators once they exist. Write this now as a forward-compatible stub and revisit after Tasks 7–9.

- [ ] **Step 1: Create the route**

```typescript
// app/api/cron/generate-content/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/utils/cron";
import { query, queryOne } from "@/lib/db";
import { generateEventContext } from "@/lib/content/generate-event-context";
import { generateArtistBio } from "@/lib/content/generate-artist-bio";
import { generateVenueDescription } from "@/lib/content/generate-venue-description";

const JOBS_PER_RUN = parseInt(process.env.CONTENT_JOBS_PER_RUN ?? "10", 10);

interface ContentJob {
  id: string;
  entity_type: string;
  entity_id: string;
  job_type: string;
}

export async function POST(req: NextRequest) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const jobs = await query<ContentJob>(
    `SELECT id, entity_type, entity_id, job_type
     FROM content_jobs
     WHERE status = 'queued'
     ORDER BY created_at
     LIMIT $1`,
    [JOBS_PER_RUN]
  );

  const stats = { processed: 0, done: 0, failed: 0 };

  for (const job of jobs) {
    stats.processed++;
    try {
      if (job.entity_type === "event") {
        await generateEventContext(job.entity_id);
      } else if (job.entity_type === "artist") {
        await generateArtistBio(job.entity_id);
      } else if (job.entity_type === "venue") {
        await generateVenueDescription(job.entity_id);
      } else {
        await queryOne(
          `UPDATE content_jobs SET status='failed', last_error=$1, updated_at=NOW() WHERE id=$2`,
          [`unknown entity_type: ${job.entity_type}`, job.id]
        );
        stats.failed++;
        continue;
      }
      stats.done++;
    } catch (err) {
      stats.failed++;
      console.error(`[generate-content] job ${job.id} failed:`, err);
    }
  }

  return NextResponse.json({ ok: true, jobsPerRun: JOBS_PER_RUN, stats });
}
```

**Note:** This file will have import errors until Tasks 7–9 create the generator files. That is expected — `tsc --noEmit` will fail until then. Do NOT commit this file until after Task 9. Proceed to Task 5 now.

---

## Task 5: GitHub Actions workflows

**Files:**
- Create: `.github/workflows/fetch-events.yml`
- Create: `.github/workflows/scrape-events.yml`

- [ ] **Step 1: Create the API-sources workflow**

```yaml
# .github/workflows/fetch-events.yml
name: Fetch Events (API Sources)

on:
  schedule:
    - cron: '0 */6 * * *'   # every 6 hours
  workflow_dispatch:          # manual trigger for testing

jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - name: Call fetch-events cron endpoint
        run: |
          HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
            -X POST "${{ secrets.VERCEL_URL }}/api/cron/fetch-events" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}")
          echo "Response: $HTTP_STATUS"
          if [ "$HTTP_STATUS" != "200" ]; then
            echo "Cron endpoint returned $HTTP_STATUS"
            exit 1
          fi
```

Required GitHub secrets: `VERCEL_URL` (e.g. `https://tickethub.vercel.app`), `CRON_SECRET`.

- [ ] **Step 2: Create the Playwright scrapers workflow**

```yaml
# .github/workflows/scrape-events.yml
name: Scrape Events (Playwright)

on:
  schedule:
    - cron: '0 4 * * *'     # daily at 04:00 UTC
  workflow_dispatch:

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install chromium --with-deps

      - name: Scrape Boletia
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: npx tsx scripts/scrape-boletia.ts

      - name: Scrape Superboletos
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: npx tsx scripts/scrape-superboletos.ts
```

Required GitHub secrets: `DATABASE_URL`.

- [ ] **Step 3: Create the workflows directory and commit**

```bash
mkdir -p .github/workflows
git add .github/workflows/fetch-events.yml .github/workflows/scrape-events.yml
git commit -m "feat(ci): add fetch-events (6h) and scrape-events (daily) workflows"
```

---

## Task 6: DB migration for h1_title and faq_json

**Files:**
- Create: `scripts/migrate-add-content-cols.ts`
- Modify: `lib/db/schema.sql`

The events table is missing `h1_title` (the page's `<h1>`) and `faq_json` (structured FAQ array). These are separate from `seo_title` / `seo_description`.

- [ ] **Step 1: Add columns to schema.sql**

In `lib/db/schema.sql`, find the events table block ending with `image_url TEXT,` and the `created_at` / `updated_at` lines. Add the two new columns between `context_text` and `image_url`:

```sql
  context_text    TEXT,
  h1_title        TEXT,
  faq_json        JSONB,
  image_url       TEXT,
```

- [ ] **Step 2: Create the migration script**

```typescript
// scripts/migrate-add-content-cols.ts
import { query } from "../lib/db";

async function main() {
  await query(`
    ALTER TABLE events
      ADD COLUMN IF NOT EXISTS h1_title TEXT,
      ADD COLUMN IF NOT EXISTS faq_json JSONB;
  `);
  console.log("[migrate] added h1_title, faq_json to events — done");
}

main().catch((err) => {
  console.error("[migrate] fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Add npm script to package.json**

Add to `"scripts"` in `package.json`:
```json
"db:migrate-content-cols": "dotenv -e .env.local -- tsx scripts/migrate-add-content-cols.ts",
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate-add-content-cols.ts lib/db/schema.sql package.json
git commit -m "feat(db): add h1_title and faq_json columns to events"
```

---

## Task 7: Content prompts library (`lib/content/prompts.ts`)

**Files:**
- Create: `lib/content/prompts.ts`

This file contains only pure string-builder functions. No DB access. No OpenAI calls.

- [ ] **Step 1: Create the prompts file**

```typescript
// lib/content/prompts.ts

export const SYSTEM_PROMPT = `
You are a Mexican concert content writer. You produce JSON content for a live-event
aggregator website (tickethub.mx). Write exclusively in Mexican Spanish.

Rules you MUST follow:
- Only use facts present in the data provided. NEVER invent dates, prices, venue
  names, setlists, or any other detail not given to you.
- If a field is missing or null, acknowledge the gap naturally — do not fill it
  with generic filler.
- Keep all text concise and useful for fans searching for concert information.
- Return ONLY valid JSON that matches the requested schema. No prose outside the JSON.
`.trim();

// ─── Event ────────────────────────────────────────────────────────────────────

export interface EventData {
  title: string;
  artistName: string;
  venueName: string;
  cityName: string;
  dateIso: string;            // YYYY-MM-DD
  genres: string[] | null;
  minPrice: number | null;
  maxPrice: number | null;
  currency: string | null;
}

export function buildEventPrompt(d: EventData): string {
  const price =
    d.minPrice != null
      ? `Precio desde ${d.minPrice} ${d.currency ?? "MXN"}` +
        (d.maxPrice != null ? ` hasta ${d.maxPrice} ${d.currency ?? "MXN"}` : "")
      : "Precio no disponible";

  const genres =
    d.genres && d.genres.length > 0
      ? `Géneros: ${d.genres.join(", ")}`
      : "Género musical desconocido";

  return `
Genera contenido para este evento de concierto. Devuelve JSON con exactamente estos campos:
{
  "seo_title": string,       // max 60 chars, incluye artista + ciudad + año
  "seo_description": string, // max 160 chars, 1 oración persuasiva con datos reales
  "h1_title": string,        // max 100 chars, variación natural del seo_title para H1
  "context_text": string,    // 80–300 chars, párrafo de contexto para fans
  "faq": [                   // 3 preguntas frecuentes del fan, respondidas con los datos disponibles
    { "question": string, "answer": string },
    { "question": string, "answer": string },
    { "question": string, "answer": string }
  ]
}

Datos del evento:
- Título: ${d.title}
- Artista: ${d.artistName}
- ${genres}
- Fecha: ${d.dateIso}
- Recinto: ${d.venueName}
- Ciudad: ${d.cityName}
- ${price}
`.trim();
}

// ─── Artist ───────────────────────────────────────────────────────────────────

export interface ArtistData {
  name: string;
  genres: string[] | null;
  popularity: number | null;
  upcomingEventCount: number;
}

export function buildArtistPrompt(d: ArtistData): string {
  const genres =
    d.genres && d.genres.length > 0
      ? `Géneros: ${d.genres.join(", ")}`
      : "Género musical no especificado";

  const popularity =
    d.popularity != null
      ? `Popularidad en Spotify: ${d.popularity}/100`
      : "Popularidad no disponible";

  return `
Genera una biografía corta del artista en español mexicano. Devuelve JSON:
{
  "bio_es": string  // 80–300 chars, 2-3 oraciones. Solo datos reales, sin inventar.
}

Datos del artista:
- Nombre: ${d.name}
- ${genres}
- ${popularity}
- Conciertos próximos en México: ${d.upcomingEventCount}
`.trim();
}

// ─── Venue ────────────────────────────────────────────────────────────────────

export interface VenueData {
  name: string;
  cityName: string | null;
  capacity: number | null;
  address: string | null;
}

export function buildVenuePrompt(d: VenueData): string {
  const capacity =
    d.capacity != null ? `Capacidad: ${d.capacity} personas` : "Capacidad desconocida";
  const address = d.address ?? "Dirección no disponible";
  const city = d.cityName ?? "Ciudad desconocida";

  return `
Genera una descripción corta del recinto en español mexicano. Devuelve JSON:
{
  "description_es": string  // 50–200 chars, 1-2 oraciones. Solo datos reales.
}

Datos del recinto:
- Nombre: ${d.name}
- Ciudad: ${city}
- Dirección: ${address}
- ${capacity}
`.trim();
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/content/prompts.ts
git commit -m "feat(content): add prompt template builders for events, artists, venues"
```

---

## Task 8: generateEventContext (`lib/content/generate-event-context.ts`)

**Files:**
- Create: `lib/content/generate-event-context.ts`

- [ ] **Step 1: Create the generator**

```typescript
// lib/content/generate-event-context.ts
import OpenAI from "openai";
import { z } from "zod";
import { query, queryOne } from "../db";
import {
  SYSTEM_PROMPT,
  buildEventPrompt,
  type EventData,
} from "./prompts";

const EventContentSchema = z.object({
  seo_title:       z.string().min(10).max(60),
  seo_description: z.string().min(20).max(160),
  h1_title:        z.string().min(10).max(100),
  context_text:    z.string().min(50).max(500),
  faq: z.array(
    z.object({
      question: z.string().min(5),
      answer:   z.string().min(5),
    })
  ).length(3),
});

type EventContent = z.infer<typeof EventContentSchema>;

async function markJobStatus(
  eventId: string,
  jobType: string,
  status: "processing" | "done" | "failed",
  lastError?: string
) {
  await queryOne(
    `UPDATE content_jobs
     SET status=$1, last_error=$2, attempts=attempts+1, updated_at=NOW()
     WHERE entity_type='event' AND entity_id=$3 AND job_type=$4`,
    [status, lastError ?? null, eventId, jobType]
  );
}

export async function generateEventContext(eventId: string): Promise<EventContent> {
  const JOB_TYPE = "event_context";

  await markJobStatus(eventId, JOB_TYPE, "processing");

  const row = await queryOne<{
    title: string;
    date: Date;
    artist_name: string | null;
    genres: string[] | null;
    venue_name: string | null;
    city_name: string | null;
    min_price: number | null;
    max_price: number | null;
    currency: string | null;
  }>(
    `SELECT
       e.title,
       e.date,
       a.name  AS artist_name,
       a.genres,
       v.name  AS venue_name,
       c.name  AS city_name,
       (SELECT MIN(ps.min_price) FROM price_snapshots ps
        JOIN event_sources es ON es.id = ps.event_source_id
        WHERE es.event_id = e.id) AS min_price,
       (SELECT MAX(ps.max_price) FROM price_snapshots ps
        JOIN event_sources es ON es.id = ps.event_source_id
        WHERE es.event_id = e.id) AS max_price,
       (SELECT ps.currency FROM price_snapshots ps
        JOIN event_sources es ON es.id = ps.event_source_id
        WHERE es.event_id = e.id LIMIT 1) AS currency
     FROM events e
     LEFT JOIN artists a ON a.id = e.artist_id
     LEFT JOIN venues  v ON v.id = e.venue_id
     LEFT JOIN cities  c ON c.id = e.city_id
     WHERE e.id = $1`,
    [eventId]
  );

  if (!row) {
    const err = `event ${eventId} not found`;
    await markJobStatus(eventId, JOB_TYPE, "failed", err);
    throw new Error(err);
  }

  const eventData: EventData = {
    title:      row.title,
    artistName: row.artist_name ?? row.title,
    venueName:  row.venue_name  ?? "Recinto por confirmar",
    cityName:   row.city_name   ?? "México",
    dateIso:    new Date(row.date).toISOString().slice(0, 10),
    genres:     row.genres,
    minPrice:   row.min_price,
    maxPrice:   row.max_price,
    currency:   row.currency,
  };

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: buildEventPrompt(eventData) },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const parsed = EventContentSchema.safeParse(JSON.parse(raw));

  if (!parsed.success) {
    const err = `validation failed: ${parsed.error.message}`;
    await markJobStatus(eventId, JOB_TYPE, "failed", err);
    throw new Error(`[generate-event-context] ${err}`);
  }

  const content = parsed.data;

  await query(
    `UPDATE events
     SET seo_title=$1, seo_description=$2, h1_title=$3, context_text=$4,
         faq_json=$5, content_status='published', updated_at=NOW()
     WHERE id=$6`,
    [
      content.seo_title,
      content.seo_description,
      content.h1_title,
      content.context_text,
      JSON.stringify(content.faq),
      eventId,
    ]
  );

  await markJobStatus(eventId, JOB_TYPE, "done");

  return content;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors (the `h1_title` and `faq_json` columns must already be in the DB — run migration in Task 6 first).

- [ ] **Step 3: Commit**

```bash
git add lib/content/generate-event-context.ts
git commit -m "feat(content): add generateEventContext with Zod validation"
```

---

## Task 9: generateArtistBio + generateVenueDescription

**Files:**
- Create: `lib/content/generate-artist-bio.ts`
- Create: `lib/content/generate-venue-description.ts`

- [ ] **Step 1: Create generateArtistBio**

```typescript
// lib/content/generate-artist-bio.ts
import OpenAI from "openai";
import { z } from "zod";
import { queryOne } from "../db";
import { SYSTEM_PROMPT, buildArtistPrompt, type ArtistData } from "./prompts";

const ArtistBioSchema = z.object({
  bio_es: z.string().min(50).max(400),
});

async function markJobStatus(
  artistId: string,
  status: "processing" | "done" | "failed",
  lastError?: string
) {
  await queryOne(
    `UPDATE content_jobs
     SET status=$1, last_error=$2, attempts=attempts+1, updated_at=NOW()
     WHERE entity_type='artist' AND entity_id=$3 AND job_type='artist_bio'`,
    [status, lastError ?? null, artistId]
  );
}

export async function generateArtistBio(artistId: string): Promise<string> {
  await markJobStatus(artistId, "processing");

  const row = await queryOne<{
    name: string;
    genres: string[] | null;
    popularity: number | null;
    event_count: number;
  }>(
    `SELECT
       a.name,
       a.genres,
       a.popularity,
       COUNT(e.id) AS event_count
     FROM artists a
     LEFT JOIN events e ON e.artist_id = a.id AND e.date > NOW() AND e.status = 'active'
     WHERE a.id = $1
     GROUP BY a.id`,
    [artistId]
  );

  if (!row) {
    const err = `artist ${artistId} not found`;
    await markJobStatus(artistId, "failed", err);
    throw new Error(err);
  }

  const artistData: ArtistData = {
    name:               row.name,
    genres:             row.genres,
    popularity:         row.popularity,
    upcomingEventCount: Number(row.event_count),
  };

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: buildArtistPrompt(artistData) },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const parsed = ArtistBioSchema.safeParse(JSON.parse(raw));

  if (!parsed.success) {
    const err = `validation failed: ${parsed.error.message}`;
    await markJobStatus(artistId, "failed", err);
    throw new Error(`[generate-artist-bio] ${err}`);
  }

  const { bio_es } = parsed.data;

  await queryOne(
    `UPDATE artists SET bio_es=$1, content_status='published', updated_at=NOW() WHERE id=$2`,
    [bio_es, artistId]
  );

  await markJobStatus(artistId, "done");

  return bio_es;
}
```

- [ ] **Step 2: Create generateVenueDescription**

```typescript
// lib/content/generate-venue-description.ts
import OpenAI from "openai";
import { z } from "zod";
import { queryOne } from "../db";
import { SYSTEM_PROMPT, buildVenuePrompt, type VenueData } from "./prompts";

const VenueDescriptionSchema = z.object({
  description_es: z.string().min(30).max(300),
});

async function markJobStatus(
  venueId: string,
  status: "processing" | "done" | "failed",
  lastError?: string
) {
  await queryOne(
    `UPDATE content_jobs
     SET status=$1, last_error=$2, attempts=attempts+1, updated_at=NOW()
     WHERE entity_type='venue' AND entity_id=$3 AND job_type='venue_description'`,
    [status, lastError ?? null, venueId]
  );
}

export async function generateVenueDescription(venueId: string): Promise<string> {
  await markJobStatus(venueId, "processing");

  const row = await queryOne<{
    name: string;
    city_name: string | null;
    capacity: number | null;
    address: string | null;
  }>(
    `SELECT v.name, c.name AS city_name, v.capacity, v.address
     FROM venues v
     LEFT JOIN cities c ON c.id = v.city_id
     WHERE v.id = $1`,
    [venueId]
  );

  if (!row) {
    const err = `venue ${venueId} not found`;
    await markJobStatus(venueId, "failed", err);
    throw new Error(err);
  }

  const venueData: VenueData = {
    name:     row.name,
    cityName: row.city_name,
    capacity: row.capacity,
    address:  row.address,
  };

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: buildVenuePrompt(venueData) },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const parsed = VenueDescriptionSchema.safeParse(JSON.parse(raw));

  if (!parsed.success) {
    const err = `validation failed: ${parsed.error.message}`;
    await markJobStatus(venueId, "failed", err);
    throw new Error(`[generate-venue-description] ${err}`);
  }

  const { description_es } = parsed.data;

  await queryOne(
    `UPDATE venues SET description_es=$1, content_status='published', updated_at=NOW() WHERE id=$2`,
    [description_es, venueId]
  );

  await markJobStatus(venueId, "done");

  return description_es;
}
```

- [ ] **Step 3: Type-check (all three content files + the cron route)**

```bash
npx tsc --noEmit
```
Expected: no errors now that all generators exist (cron route imports are satisfied).

- [ ] **Step 4: Commit**

```bash
git add lib/content/generate-artist-bio.ts lib/content/generate-venue-description.ts
git commit -m "feat(content): add generateArtistBio and generateVenueDescription"
```

---

## Task 10: generate-content script + cron route commit + env example

**Files:**
- Create: `scripts/generate-content.ts`
- Commit deferred: `app/api/cron/generate-content/route.ts` (from Task 4)
- Modify: `.env.local.example`

- [ ] **Step 1: Create the CLI batch processor**

```typescript
// scripts/generate-content.ts
import { query } from "../lib/db";
import { generateEventContext } from "../lib/content/generate-event-context";
import { generateArtistBio } from "../lib/content/generate-artist-bio";
import { generateVenueDescription } from "../lib/content/generate-venue-description";

const LIMIT = parseInt(
  process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "20",
  10
);

interface ContentJob {
  id: string;
  entity_type: string;
  entity_id: string;
  job_type: string;
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[generate-content] OPENAI_API_KEY not set — exiting");
    process.exit(1);
  }

  console.log(`[generate-content] processing up to ${LIMIT} queued jobs`);

  const jobs = await query<ContentJob>(
    `SELECT id, entity_type, entity_id, job_type
     FROM content_jobs
     WHERE status = 'queued'
     ORDER BY created_at
     LIMIT $1`,
    [LIMIT]
  );

  console.log(`[generate-content] found ${jobs.length} queued jobs`);

  const stats = { processed: 0, done: 0, failed: 0 };

  for (const job of jobs) {
    stats.processed++;
    console.log(
      `[generate-content] processing ${job.entity_type}:${job.entity_id} (${job.job_type})`
    );

    try {
      if (job.entity_type === "event") {
        await generateEventContext(job.entity_id);
      } else if (job.entity_type === "artist") {
        await generateArtistBio(job.entity_id);
      } else if (job.entity_type === "venue") {
        await generateVenueDescription(job.entity_id);
      } else {
        console.warn(`[generate-content] unknown entity_type: ${job.entity_type} — skipping`);
        stats.failed++;
        continue;
      }
      stats.done++;
      console.log(`[generate-content] ✓ ${job.entity_type}:${job.entity_id}`);
    } catch (err) {
      stats.failed++;
      console.error(
        `[generate-content] ✗ ${job.entity_type}:${job.entity_id}: ` +
        `${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.log(
    `[generate-content] done. processed=${stats.processed} done=${stats.done} failed=${stats.failed}`
  );
}

main().catch((err) => {
  console.error("[generate-content] fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Add npm script to package.json**

The `"content:generate"` key already appears in `package.json` pointing to `scripts/generate-content.ts`. Verify:

```bash
grep '"content:generate"' package.json
```
Expected: `"content:generate": "dotenv -e .env.local -- tsx scripts/generate-content.ts"`

If missing, add:
```json
"content:generate": "dotenv -e .env.local -- tsx scripts/generate-content.ts",
```

- [ ] **Step 3: Add CRON_SECRET to .env.local.example**

In `.env.local.example`, add after the `TICKETMASTER_API_KEY` block:

```bash
# ─── Cron & pipeline ─────────────────────────────────────────────────────────
# Shared secret for /api/cron/* endpoints.
# Generate with: openssl rand -hex 32
CRON_SECRET=

# Max events to ingest per source per Vercel cron run (default: 50)
EVENTS_PER_RUN=50

# Max content jobs to process per Vercel cron run (default: 10)
CONTENT_JOBS_PER_RUN=10
```

- [ ] **Step 4: Type-check everything**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit all remaining files**

```bash
git add \
  scripts/generate-content.ts \
  app/api/cron/generate-content/route.ts \
  .env.local.example \
  package.json
git commit -m "feat(phase7-8): add generate-content script, cron route, and env placeholders"
```

---

## Self-Review Checklist

### Spec coverage

| Requirement | Task |
|---|---|
| `scripts/ingest-events.ts` | Task 2 |
| `app/api/cron/fetch-events/route.ts` | Task 3 |
| `app/api/cron/generate-content/route.ts` | Task 4 + 10 |
| GitHub Actions workflow every 6h | Task 5 |
| GitHub Actions daily Playwright workflow | Task 5 |
| Endpoint verifies `Authorization: Bearer ${CRON_SECRET}` | Task 3, 4 |
| Vercel run limit via env var | Task 3, 4 |
| Scripts print final stats | Task 2, 10 |
| `lib/content/prompts.ts` | Task 7 |
| `generateEventContext(eventId)` | Task 8 |
| `generateArtistBio(artistId)` | Task 9 |
| `generateVenueDescription(venueId)` | Task 9 |
| `scripts/generate-content.ts` | Task 10 |
| OpenAI JSON mode + Zod validation | Tasks 8, 9 |
| `content_status = 'published'` only on validation pass | Tasks 8, 9 |
| `last_error` on failure | Tasks 8, 9 |
| Jobs cycle through `queued → processing → done/failed` | Tasks 8, 9 |
| Complete event generates SEO title, description, h1, context_text, FAQ | Task 8 |
| Incomplete event doesn't invent data (system prompt enforces) | Task 7 |
| Workflow documents required secrets | Task 5 |

### Type consistency

- `SourceStats` defined in `lib/ingest/run-api-source.ts`, imported in Task 3 — ✓ consistent
- `generateEventContext`, `generateArtistBio`, `generateVenueDescription` — names match between `app/api/cron/generate-content/route.ts` (Task 4) and the files created in Tasks 8–9 — ✓ consistent
- `h1_title` column added in Task 6 migration, used in Task 8 UPDATE query — ✓ consistent
- `faq_json` column added in Task 6 migration, used in Task 8 UPDATE query — ✓ consistent
- `markJobStatus` helper in each generator uses correct `entity_type` strings matching `content_jobs` CHECK constraint — ✓ consistent
