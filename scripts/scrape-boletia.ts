import { chromium } from "playwright";
import slugify from "slugify";
import { query, queryOne } from "../lib/db";

// ─── City detection ───────────────────────────────────────────────────────────

// Map of keyword patterns (checked against URL slug + venue name) → city slug
const CITY_PATTERNS: Array<{ pattern: RegExp; slug: string }> = [
  { pattern: /\bcdmx\b|ciudad-de-mexico|ciudad de mexico|\bdf\b|mexico-city/, slug: "ciudad-de-mexico" },
  { pattern: /\bgdl\b|guadalajara/, slug: "guadalajara" },
  // mty without word boundary: slug may be "emperatriztourmty" (no separator after mty)
  { pattern: /mty\b|monterrey/, slug: "monterrey" },
  { pattern: /\bpuebla\b/, slug: "puebla" },
  // qro is a common abbreviation in slugs
  { pattern: /queretaro|quer[eé]taro|\bqro\b/, slug: "queretaro" },
  { pattern: /\btijuana\b/, slug: "tijuana" },
  { pattern: /\bleon\b|le[oó]n/, slug: "leon" },
  { pattern: /cancun|canc[uú]n/, slug: "cancun" },
  { pattern: /\bmerida\b|m[eé]rida/, slug: "merida" },
  { pattern: /san-luis-potosi|san luis potosi|san luis potos[ií]/, slug: "san-luis-potosi" },
  { pattern: /\btoluca\b/, slug: "toluca" },
  { pattern: /aguascalientes/, slug: "aguascalientes" },
];

// Known venue → city mappings to help when URL slug has no city clue
const VENUE_CITY: Record<string, string> = {
  // CDMX
  "auditorio nacional": "ciudad-de-mexico",
  "palacio de los deportes": "ciudad-de-mexico",
  "foro sol": "ciudad-de-mexico",
  "arena cdmx": "ciudad-de-mexico",
  "pepsi center wtc": "ciudad-de-mexico",
  "multiforo alicia": "ciudad-de-mexico",
  "teatro de la ciudad": "ciudad-de-mexico",
  "salon gran forum": "ciudad-de-mexico",
  "salón gran forum": "ciudad-de-mexico",
  "teatro del pueblo ali chumacero": "ciudad-de-mexico",
  "teatro del pueblo alí chumacero": "ciudad-de-mexico",
  "capilla gotica": "ciudad-de-mexico",
  "capilla gótica": "ciudad-de-mexico",
  "foro nacion": "ciudad-de-mexico",
  "foro nación": "ciudad-de-mexico",
  "la teatreria": "ciudad-de-mexico",
  "la teatrería": "ciudad-de-mexico",
  "centro de convenciones de cu": "ciudad-de-mexico",
  "centro cultural universitario": "ciudad-de-mexico",
  "teatro metropolian": "ciudad-de-mexico",
  "teatro metropolitan": "ciudad-de-mexico",
  "el plaza condesa": "ciudad-de-mexico",
  "plaza condesa": "ciudad-de-mexico",
  "salon 21": "ciudad-de-mexico",
  "salón 21": "ciudad-de-mexico",
  "metapatio": "ciudad-de-mexico",
  // Guadalajara
  "auditorio telmex": "guadalajara",
  "c3 stage": "guadalajara",
  "arena gdl": "guadalajara",
  "conjunto santander": "guadalajara",
  // Monterrey
  "arena monterrey": "monterrey",
  "arena jose sulaiman": "monterrey",
  "arena jose sulaimán": "monterrey",
  "estadio bbva": "monterrey",
  "explanada de los heroes": "monterrey",
  // León
  "palenque de leon": "leon",
  "palenque de león": "leon",
  "poliforum leon": "leon",
  "poliforum león": "leon",
  // Puebla
  "auditorio metropolitano": "puebla",
  "auditorio metropolitano de puebla": "puebla",
  "live aqua puebla": "puebla",
  // Querétaro
  "estadio corregidora": "queretaro",
  "hacienda tovares": "queretaro",
  "centro de congresos queretaro": "queretaro",
  "centro de congresos querétaro": "queretaro",
  // Cancún
  "ik kil": "cancun",
};

function detectCity(urlSlug: string, venueName: string): string | null {
  const haystack = `${urlSlug} ${venueName}`.toLowerCase();

  for (const { pattern, slug } of CITY_PATTERNS) {
    if (pattern.test(haystack)) return slug;
  }

  // Venue exact match
  const venueKey = venueName.toLowerCase().trim();
  if (VENUE_CITY[venueKey]) return VENUE_CITY[venueKey];

  // Partial venue match
  for (const [key, citySlug] of Object.entries(VENUE_CITY)) {
    if (venueKey.includes(key) || key.includes(venueKey)) return citySlug;
  }

  return null;
}

// ─── Date parsing ─────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  // Spanish abbreviated
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
  // English abbreviated
  jan: 1, apr: 4, aug: 8, dec: 12,
};

function buildDateIso(day: string, month: string): string {
  const now = new Date();
  const d = parseInt(day, 10);
  const m = MONTH_MAP[month.toLowerCase()] ?? 0;
  if (!d || !m) return new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();

  let year = now.getFullYear();
  // If this month/day already passed this year, assume next year
  const candidate = new Date(Date.UTC(year, m - 1, d, 20, 0, 0));
  if (candidate < now) year += 1;

  return new Date(Date.UTC(year, m - 1, d, 20, 0, 0)).toISOString();
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

function toSlug(s: string): string {
  return slugify(s, { lower: true, strict: true, locale: "es" });
}

async function loadKnownCitySlugs(): Promise<Set<string>> {
  const rows = await query<{ slug: string }>(`SELECT slug FROM cities`);
  return new Set(rows.map((r) => r.slug));
}

async function getCityId(slug: string): Promise<string | null> {
  const row = await queryOne<{ id: string }>(`SELECT id FROM cities WHERE slug = $1`, [slug]);
  return row?.id ?? null;
}

async function upsertArtist(name: string): Promise<string> {
  const slug = toSlug(name);
  const row = await queryOne<{ id: string }>(
    `INSERT INTO artists (name, slug)
     VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [name, slug]
  );
  return row!.id;
}

async function upsertVenue(name: string, cityId: string): Promise<string> {
  const slug = toSlug(name);
  const row = await queryOne<{ id: string }>(
    `INSERT INTO venues (name, slug, city_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (slug) DO UPDATE
       SET name    = EXCLUDED.name,
           city_id = EXCLUDED.city_id
     RETURNING id`,
    [name, slug, cityId]
  );
  return row!.id;
}

async function upsertEvent(params: {
  slug: string;
  title: string;
  artistId: string;
  venueId: string;
  cityId: string;
  date: string;
  imageUrl: string | null;
}): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO events
       (slug, title, artist_id, venue_id, city_id, date, status, tier, content_status, image_url)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', 'tier1', 'queued', $7)
     ON CONFLICT (slug) DO UPDATE
       SET title      = EXCLUDED.title,
           artist_id  = EXCLUDED.artist_id,
           venue_id   = EXCLUDED.venue_id,
           city_id    = EXCLUDED.city_id,
           date       = EXCLUDED.date,
           image_url  = COALESCE(EXCLUDED.image_url, events.image_url)
     RETURNING id`,
    [params.slug, params.title, params.artistId, params.venueId, params.cityId, params.date, params.imageUrl]
  );
  return row!.id;
}

async function upsertSource(eventId: string, sourceEventId: string, url: string): Promise<boolean> {
  const row = await queryOne<{ created: boolean }>(
    `INSERT INTO event_sources (event_id, platform, source_event_id, url, is_resale)
     VALUES ($1, 'boletia', $2, $3, false)
     ON CONFLICT (platform, source_event_id) DO UPDATE
       SET event_id = EXCLUDED.event_id,
           url      = EXCLUDED.url
     RETURNING (xmax = 0) AS created`,
    [eventId, sourceEventId, url]
  );
  return row?.created ?? false;
}

// ─── Scraping ─────────────────────────────────────────────────────────────────

interface ScrapedEvent {
  title: string;
  day: string;
  month: string;
  venueName: string;
  url: string;
  imageUrl: string | null;
  /** slug portion extracted from the URL for city detection */
  urlSlug: string;
}

async function scrapeBoletia(): Promise<ScrapedEvent[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "es-MX",
  });
  const page = await context.newPage();

  const PAGES = [
    "https://boletia.com/search?category=Conciertos",
    "https://boletia.com/search?category=Festivales",
  ];

  try {
    const allEvents: ScrapedEvent[] = [];
    const seenUrls = new Set<string>();

    for (const pageUrl of PAGES) {
      await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 30_000 });

      // Scroll through all carousel sections to render all cards
      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await page.waitForTimeout(800);
      }

      const pageEvents = await page.evaluate(() => {
        const results: Array<{
          title: string;
          day: string;
          month: string;
          venueName: string;
          url: string;
          imageUrl: string | null;
          urlSlug: string;
        }> = [];

        const seen = new Set<string>();

        // ── Grid cards (.o-event-card) ────────────────────────────────────────
        const cards = document.querySelectorAll<HTMLElement>(".o-event-card");
        for (const card of cards) {
          const linkEl = card.querySelector<HTMLAnchorElement>(
            "a.o-event-card__banner, .o-event-card__title a"
          );
          if (!linkEl?.href) continue;
          const url = linkEl.href;
          if (seen.has(url)) continue;
          seen.add(url);

          const title = card.querySelector(".o-event-card__title")?.textContent?.trim() ?? "";
          if (!title) continue;

          const day       = card.querySelector(".o-event-card__day")?.textContent?.trim()   ?? "";
          const month     = card.querySelector(".o-event-card__month")?.textContent?.trim() ?? "";
          const venueName = card.querySelector(".o-event-card__venue")?.textContent?.trim() ?? "Por confirmar";

          const fig      = card.querySelector<HTMLElement>("figure");
          const bgStyle  = fig?.style?.backgroundImage ?? "";
          const imgMatch = bgStyle.match(/url\(["']?([^"')]+)["']?\)/);
          const imageUrl = imgMatch?.[1] ?? null;

          // Inline slug extraction (avoid named arrow functions — tsx/esbuild wraps them with __name)
          const sub1 = url.match(/^https?:\/\/([^.]+)\.boletia\.com/);
          const bil1 = url.match(/boletia\.com\/billboards\/([^/?#]+)/);
          const urlSlug = sub1?.[1] ?? bil1?.[1] ?? "";

          results.push({ title, day, month, venueName, url, imageUrl, urlSlug });
        }

        // ── Hero banners (.c-top-events__info) ───────────────────────────────
        const heroes = document.querySelectorAll<HTMLElement>(".c-top-events__info");
        for (const hero of heroes) {
          const linkEl = hero.querySelector<HTMLAnchorElement>(".c-top-events__button");
          if (!linkEl?.href) continue;
          const url = linkEl.href;
          if (seen.has(url)) continue;
          seen.add(url);

          const title = hero.querySelector(".c-top-events__title")?.textContent?.trim() ?? "";
          if (!title) continue;

          const place = hero.querySelector(".c-top-events__place")?.textContent?.trim() ?? "";
          if (place.toLowerCase().includes("varias")) continue; // multi-city, skip

          const rawDate = hero.querySelector(".c-top-events__date")?.textContent?.trim() ?? "";

          const sub2 = url.match(/^https?:\/\/([^.]+)\.boletia\.com/);
          const bil2 = url.match(/boletia\.com\/billboards\/([^/?#]+)/);
          const urlSlug2 = sub2?.[1] ?? bil2?.[1] ?? "";

          results.push({
            title,
            day: "",
            month: rawDate,
            venueName: place || "Por confirmar",
            url,
            imageUrl: null,
            urlSlug: urlSlug2,
          });
        }

        return results;
      });

      // Deduplicate across pages
      for (const ev of pageEvents) {
        if (!seenUrls.has(ev.url)) {
          seenUrls.add(ev.url);
          allEvents.push(ev);
        }
      }
    }

    return allEvents;
  } finally {
    await browser.close();
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("[scrape-boletia] launching browser…");
  const scraped = await scrapeBoletia();
  console.log(`[scrape-boletia] raw cards found: ${scraped.length}`);

  const knownSlugs = await loadKnownCitySlugs();

  let processed = 0;
  let saved = 0;
  let skipped = 0;
  const skipReasons: Record<string, number> = {};

  for (const ev of scraped) {
    processed++;

    const citySlug = detectCity(ev.urlSlug, ev.venueName);
    if (!citySlug || !knownSlugs.has(citySlug)) {
      const reason = citySlug ? `unknown-city:${citySlug}` : "no-city";
      skipReasons[reason] = (skipReasons[reason] ?? 0) + 1;
      skipped++;
      continue;
    }

    const cityId = await getCityId(citySlug);
    if (!cityId) { skipped++; continue; }

    // Parse date
    let dateIso: string;
    if (ev.day && ev.month) {
      dateIso = buildDateIso(ev.day, ev.month);
    } else {
      // Hero banner: raw date string like "10-mayo-2026" or "Varias fechas"
      dateIso = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();
    }

    // Derive artist from title: "X en Venue" → "X"; "X - Venue" → "X"
    let artistName = ev.title;
    const enIdx = ev.title.toLowerCase().lastIndexOf(" en ");
    if (enIdx > 10) artistName = ev.title.slice(0, enIdx).trim();
    else {
      const dashIdx = ev.title.indexOf(" - ");
      if (dashIdx > 0) artistName = ev.title.slice(0, dashIdx).trim();
    }
    if (!artistName) artistName = ev.title;

    const slug = `${toSlug(ev.title)}-${dateIso.slice(0, 10)}`;
    const sourceEventId = `bl-${ev.urlSlug || toSlug(ev.title)}`;

    try {
      const artistId = await upsertArtist(artistName);
      const venueId  = await upsertVenue(ev.venueName, cityId);
      const eventId  = await upsertEvent({
        slug,
        title: ev.title,
        artistId,
        venueId,
        cityId,
        date: dateIso,
        imageUrl: ev.imageUrl,
      });
      const created = await upsertSource(eventId, sourceEventId, ev.url);
      if (created) saved++;
    } catch (err) {
      console.error(`  [error] "${ev.title}": ${(err as Error).message}`);
      skipped++;
    }
  }

  console.log(`\nProcesados: ${processed} | Guardados: ${saved} | Saltados: ${skipped}`);
  if (Object.keys(skipReasons).length) {
    console.log("Skip reasons:", skipReasons);
  }

  // Print total count + all saved events with URLs
  const all = await query<{ title: string; url: string }>(
    `SELECT e.title, es.url
     FROM events e
     JOIN event_sources es ON es.event_id = e.id
     WHERE es.platform = 'boletia'
     ORDER BY e.created_at DESC`
  );
  console.log(`\nTotal boletia events in DB: ${all.length}`);
  for (const row of all as any[]) console.log(`  ${row.title}\n    → ${row.url}`);
}

main().catch((err) => {
  console.error("[scrape-boletia] fatal:", err);
  process.exit(1);
});
