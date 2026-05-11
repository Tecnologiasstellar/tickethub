import slugify from "slugify";
import { query, queryOne } from "../lib/db";
import { buildAffiliateUrl } from "../lib/affiliate";
import type { SourcePlatform } from "../lib/types";

interface HeroSource {
  platform: SourcePlatform;
  sourceEventId: string;
  url: string;
  affiliateUrl?: string;
  isResale?: boolean;
  minPrice: number;
  maxPrice: number;
  currency?: string;
  isSoldOut?: boolean;
}

interface HeroEvent {
  cityName: string;
  artist: { name: string; genres?: string[]; popularity?: number };
  venue: { name: string; address?: string; capacity?: number };
  title: string;
  date: string;
  imageUrl?: string;
  sources: HeroSource[];
}

const HERO_EVENTS: HeroEvent[] = [
  {
    cityName: "Ciudad de Mexico",
    artist: { name: "Caifanes", genres: ["rock en espanol", "rock alternativo"], popularity: 78 },
    venue: { name: "Auditorio Nacional", address: "Paseo de la Reforma 50, Bosque de Chapultepec", capacity: 9683 },
    title: "Caifanes en el Auditorio Nacional",
    date: "2026-08-15T03:00:00Z",
    sources: [
      {
        platform: "ticketmaster",
        sourceEventId: "tm-caifanes-auditorio-2026-08",
        url: "https://www.ticketmaster.com.mx/caifanes-tickets/artist/example",
        minPrice: 950, maxPrice: 3800,
      },
      {
        platform: "stubhub",
        sourceEventId: "sh-caifanes-auditorio-2026-08",
        url: "https://www.stubhub.com.mx/caifanes-tickets/example",
        isResale: true, minPrice: 1100, maxPrice: 5200,
      },
    ],
  },
  {
    cityName: "Ciudad de Mexico",
    artist: { name: "Bad Bunny", genres: ["reggaeton", "latin trap"], popularity: 96 },
    venue: { name: "Estadio GNP Seguros", address: "Av. Viaducto Rio de la Piedad, Granjas Mexico", capacity: 65000 },
    title: "Bad Bunny en el Estadio GNP Seguros",
    date: "2026-09-20T03:00:00Z",
    sources: [
      {
        platform: "ticketmaster",
        sourceEventId: "tm-badbunny-gnp-2026-09",
        url: "https://www.ticketmaster.com.mx/bad-bunny-tickets/example",
        minPrice: 1500, maxPrice: 8500,
      },
    ],
  },
  {
    cityName: "Guadalajara",
    artist: { name: "Cafe Tacvba", genres: ["rock en espanol", "alternativo"], popularity: 72 },
    venue: { name: "Auditorio Telmex", address: "Av. Adolfo Lopez Mateos Sur 2375, Zapopan", capacity: 11000 },
    title: "Cafe Tacvba en el Auditorio Telmex",
    date: "2026-07-12T02:00:00Z",
    sources: [
      {
        platform: "boletia",
        sourceEventId: "bl-cafetacvba-telmex-2026-07",
        url: "https://boletia.com/eventos/cafe-tacvba-gdl-example",
        minPrice: 750, maxPrice: 2400,
      },
      {
        platform: "eventbrite",
        sourceEventId: "eb-cafetacvba-telmex-2026-07",
        url: "https://www.eventbrite.com.mx/e/cafe-tacvba-gdl-example",
        minPrice: 780, maxPrice: 2500,
      },
    ],
  },
  {
    cityName: "Monterrey",
    artist: { name: "Molotov", genres: ["rock", "rap rock"], popularity: 68 },
    venue: { name: "Arena Monterrey", address: "Av. Francisco I. Madero 2500, Centro", capacity: 17500 },
    title: "Molotov en la Arena Monterrey",
    date: "2026-08-02T02:00:00Z",
    sources: [
      {
        platform: "superboletos",
        sourceEventId: "sb-molotov-arena-2026-08",
        url: "https://www.superboletos.com/comprar/molotov-mty-example",
        minPrice: 600, maxPrice: 2200,
      },
    ],
  },
  {
    cityName: "Monterrey",
    artist: { name: "Mana", genres: ["rock en espanol", "pop rock"], popularity: 82 },
    venue: { name: "Estadio BBVA", address: "Av. Pablo Livas 2011, Guadalupe", capacity: 53500 },
    title: "Mana en el Estadio BBVA",
    date: "2026-10-05T02:00:00Z",
    sources: [
      {
        platform: "ticketmaster",
        sourceEventId: "tm-mana-bbva-2026-10",
        url: "https://www.ticketmaster.com.mx/mana-tickets/example",
        minPrice: 1200, maxPrice: 6500,
      },
      {
        platform: "stubhub",
        sourceEventId: "sh-mana-bbva-2026-10",
        url: "https://www.stubhub.com.mx/mana-tickets/example",
        isResale: true, minPrice: 1450, maxPrice: 9000,
      },
    ],
  },
  {
    cityName: "Puebla",
    artist: { name: "Zoe", genres: ["rock alternativo", "indie"], popularity: 70 },
    venue: { name: "Auditorio Metropolitano", address: "Blvd. Esteban de Antunano s/n, San Baltazar Campeche", capacity: 7800 },
    title: "Zoe en el Auditorio Metropolitano",
    date: "2026-09-12T02:00:00Z",
    sources: [
      {
        platform: "boletia",
        sourceEventId: "bl-zoe-metro-2026-09",
        url: "https://boletia.com/eventos/zoe-puebla-example",
        minPrice: 850, maxPrice: 2700,
      },
    ],
  },
  {
    cityName: "Queretaro",
    artist: { name: "Carla Morrison", genres: ["indie pop", "pop alternativo"], popularity: 64 },
    venue: { name: "Centro de Congresos Queretaro", address: "Blvd. Bernardo Quintana 100, Carretas", capacity: 4200 },
    title: "Carla Morrison en el Centro de Congresos",
    date: "2026-07-25T02:00:00Z",
    sources: [
      {
        platform: "eventbrite",
        sourceEventId: "eb-carlamorrison-qro-2026-07",
        url: "https://www.eventbrite.com.mx/e/carla-morrison-qro-example",
        minPrice: 700, maxPrice: 1900,
      },
    ],
  },
  {
    cityName: "Ciudad de Mexico",
    artist: { name: "Kany Garcia", genres: ["pop latino", "balada"], popularity: 67 },
    venue: { name: "Pepsi Center WTC", address: "Dakota s/n, Napoles", capacity: 8500 },
    title: "Kany Garcia en el Pepsi Center WTC",
    date: "2026-06-18T03:00:00Z",
    sources: [
      {
        platform: "ticketmaster",
        sourceEventId: "tm-kanygarcia-pepsi-2026-06",
        url: "https://www.ticketmaster.com.mx/kany-garcia-tickets/example",
        minPrice: 850, maxPrice: 3200,
      },
    ],
  },
];

function toSlug(s: string): string {
  return slugify(s, { lower: true, strict: true, locale: "es" });
}

function eventSlug(artistName: string, venueName: string, isoDate: string): string {
  const day = isoDate.slice(0, 10);
  return `${toSlug(artistName)}-${toSlug(venueName)}-${day}`;
}

async function getCityIdByName(name: string): Promise<string> {
  const slug = toSlug(name);
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM cities WHERE slug = $1`,
    [slug]
  );
  if (!row) {
    throw new Error(
      `city "${name}" (slug=${slug}) not found. Run npm run db:seed-cities first.`
    );
  }
  return row.id;
}

async function upsertArtist(a: HeroEvent["artist"]): Promise<string> {
  const slug = toSlug(a.name);
  const row = await queryOne<{ id: string }>(
    `INSERT INTO artists (name, slug, genres, popularity)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (slug) DO UPDATE
       SET name       = EXCLUDED.name,
           genres     = COALESCE(EXCLUDED.genres, artists.genres),
           popularity = COALESCE(EXCLUDED.popularity, artists.popularity)
     RETURNING id`,
    [a.name, slug, a.genres ?? null, a.popularity ?? null]
  );
  return row!.id;
}

async function upsertVenue(
  v: HeroEvent["venue"],
  cityId: string
): Promise<string> {
  const slug = toSlug(v.name);
  const row = await queryOne<{ id: string }>(
    `INSERT INTO venues (name, slug, city_id, address, capacity)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (slug) DO UPDATE
       SET name     = EXCLUDED.name,
           city_id  = EXCLUDED.city_id,
           address  = COALESCE(EXCLUDED.address, venues.address),
           capacity = COALESCE(EXCLUDED.capacity, venues.capacity)
     RETURNING id`,
    [v.name, slug, cityId, v.address ?? null, v.capacity ?? null]
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
  imageUrl?: string;
}): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO events
       (slug, title, artist_id, venue_id, city_id, date, status, tier, content_status, image_url)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', 'tier1', 'queued', $7)
     ON CONFLICT (slug) DO UPDATE
       SET title     = EXCLUDED.title,
           artist_id = EXCLUDED.artist_id,
           venue_id  = EXCLUDED.venue_id,
           city_id   = EXCLUDED.city_id,
           date      = EXCLUDED.date,
           tier      = 'tier1',
           image_url = COALESCE(EXCLUDED.image_url, events.image_url)
     RETURNING id`,
    [
      params.slug,
      params.title,
      params.artistId,
      params.venueId,
      params.cityId,
      params.date,
      params.imageUrl ?? null,
    ]
  );
  return row!.id;
}

async function upsertSource(
  eventId: string,
  s: HeroSource
): Promise<{ id: string; created: boolean }> {
  const affiliateUrl = s.affiliateUrl ?? buildAffiliateUrl(s.url, s.platform);
  const row = await queryOne<{ id: string; created: boolean }>(
    `INSERT INTO event_sources
       (event_id, platform, source_event_id, url, affiliate_url, is_resale)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (platform, source_event_id) DO UPDATE
       SET event_id      = EXCLUDED.event_id,
           url           = EXCLUDED.url,
           affiliate_url = EXCLUDED.affiliate_url,
           is_resale     = EXCLUDED.is_resale
     RETURNING id, (xmax = 0) AS created`,
    [
      eventId,
      s.platform,
      s.sourceEventId,
      s.url,
      affiliateUrl,
      s.isResale ?? false,
    ]
  );
  return row!;
}

async function ensureInitialSnapshot(
  eventSourceId: string,
  s: HeroSource
): Promise<boolean> {
  // Idempotent: only insert a baseline snapshot if this source has none.
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM price_snapshots WHERE event_source_id = $1 LIMIT 1`,
    [eventSourceId]
  );
  if (existing) return false;

  await query(
    `INSERT INTO price_snapshots
       (event_source_id, min_price, max_price, currency, is_sold_out)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      eventSourceId,
      s.minPrice,
      s.maxPrice,
      s.currency ?? "MXN",
      s.isSoldOut ?? false,
    ]
  );
  return true;
}

async function main() {
  console.log(`[seed-hero] upserting ${HERO_EVENTS.length} hero events`);

  let eventsInserted = 0;
  let sourcesInserted = 0;
  let snapshotsInserted = 0;

  for (const ev of HERO_EVENTS) {
    const cityId = await getCityIdByName(ev.cityName);
    const artistId = await upsertArtist(ev.artist);
    const venueId = await upsertVenue(ev.venue, cityId);

    const slug = eventSlug(ev.artist.name, ev.venue.name, ev.date);
    const before = await queryOne<{ id: string }>(
      `SELECT id FROM events WHERE slug = $1`,
      [slug]
    );
    const eventId = await upsertEvent({
      slug,
      title: ev.title,
      artistId,
      venueId,
      cityId,
      date: ev.date,
      imageUrl: ev.imageUrl,
    });
    if (!before) eventsInserted++;

    for (const s of ev.sources) {
      const { id: sourceId, created } = await upsertSource(eventId, s);
      if (created) sourcesInserted++;
      const wroteSnapshot = await ensureInitialSnapshot(sourceId, s);
      if (wroteSnapshot) snapshotsInserted++;
    }
  }

  const totals = await queryOne<{
    events: string;
    sources: string;
    snapshots: string;
    artists: string;
    venues: string;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM events)::text          AS events,
       (SELECT COUNT(*) FROM event_sources)::text   AS sources,
       (SELECT COUNT(*) FROM price_snapshots)::text AS snapshots,
       (SELECT COUNT(*) FROM artists)::text         AS artists,
       (SELECT COUNT(*) FROM venues)::text          AS venues`
  );

  console.log(
    `[seed-hero] done. new events=${eventsInserted} new sources=${sourcesInserted} new snapshots=${snapshotsInserted}`
  );
  console.log(`[seed-hero] totals:`, totals);
}

main().catch((err) => {
  console.error("[seed-hero] failed:", err);
  process.exit(1);
});
