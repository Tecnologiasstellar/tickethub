/**
 * Seed isolated test data for the event page (Paso 9).
 * All slugs prefixed `__test-` so cleanup is trivial.
 * Idempotent: re-running upserts the same rows.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed-test-evento.ts
 *   npx tsx --env-file=.env.local scripts/seed-test-evento.ts --cleanup
 */
import { query, queryOne } from "../lib/db";

const PREFIX = "__test-";

const CITY = {
  slug: `${PREFIX}cdmx`,
  name: "Ciudad de México (test)",
  tier: 1,
  lat: 19.4326,
  lng: -99.1332,
};
const VENUE = {
  slug: `${PREFIX}foro-sol`,
  name: "Foro Sol (test)",
  address: "Av. Viaducto Río de la Piedad s/n, CDMX",
  capacity: 65000,
  lat: 19.4046,
  lng: -99.0973,
};
const ARTIST = {
  slug: `${PREFIX}taylor-swift`,
  name: "Taylor Swift (test)",
  spotify_id: "06HL4z0CvFAxyc27GXpf02",
  image_url:
    "https://i.scdn.co/image/ab6761610000e5eb859e4c14fa59296c8649e0e4",
  genres: ["pop"],
  popularity: 100,
};
const TODAY = new Date();
const futureDate = (days: number) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + days);
  d.setHours(20, 0, 0, 0);
  return d.toISOString();
};

const MAIN_EVENT = {
  slug: `${PREFIX}eras-tour-cdmx`,
  title: "The Eras Tour — Ciudad de México (test)",
  date: futureDate(60),
  status: "active",
  tier: "tier1",
  context_text:
    "Evento de prueba para validar el paso 9: hero con imagen, Spotify embed, comparador de precios y eventos relacionados.",
  image_url:
    "https://i.scdn.co/image/ab6761610000e5eb859e4c14fa59296c8649e0e4",
  h1_title: "Taylor Swift en CDMX — The Eras Tour",
  seo_title: "Taylor Swift CDMX 2026 — Boletos y Precios",
  seo_description:
    "Compara precios para The Eras Tour en CDMX. Encuentra el mejor precio entre todas las plataformas.",
};
const RELATED_EVENTS = [
  {
    slug: `${PREFIX}eras-tour-gdl`,
    title: "The Eras Tour — Guadalajara (test)",
    date: futureDate(75),
  },
  {
    slug: `${PREFIX}eras-tour-mty`,
    title: "The Eras Tour — Monterrey (test)",
    date: futureDate(90),
  },
];

async function upsertCity() {
  await query(
    `INSERT INTO cities (slug, name, country, tier, lat, lng)
     VALUES ($1,$2,'MX',$3,$4,$5)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, tier = EXCLUDED.tier`,
    [CITY.slug, CITY.name, CITY.tier, CITY.lat, CITY.lng],
  );
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM cities WHERE slug = $1`,
    [CITY.slug],
  );
  return row!.id;
}

async function upsertVenue(cityId: string) {
  await query(
    `INSERT INTO venues (slug, name, city_id, address, capacity, lat, lng, content_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'published')
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name, city_id = EXCLUDED.city_id,
       address = EXCLUDED.address, capacity = EXCLUDED.capacity,
       lat = EXCLUDED.lat, lng = EXCLUDED.lng, content_status = 'published'`,
    [VENUE.slug, VENUE.name, cityId, VENUE.address, VENUE.capacity, VENUE.lat, VENUE.lng],
  );
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM venues WHERE slug = $1`,
    [VENUE.slug],
  );
  return row!.id;
}

async function upsertArtist() {
  await query(
    `INSERT INTO artists (slug, name, spotify_id, image_url, genres, popularity, content_status)
     VALUES ($1,$2,$3,$4,$5,$6,'published')
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name, spotify_id = EXCLUDED.spotify_id,
       image_url = EXCLUDED.image_url, genres = EXCLUDED.genres,
       popularity = EXCLUDED.popularity, content_status = 'published'`,
    [
      ARTIST.slug,
      ARTIST.name,
      ARTIST.spotify_id,
      ARTIST.image_url,
      ARTIST.genres,
      ARTIST.popularity,
    ],
  );
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM artists WHERE slug = $1`,
    [ARTIST.slug],
  );
  return row!.id;
}

async function upsertEvent(
  ev: { slug: string; title: string; date: string },
  artistId: string,
  venueId: string,
  cityId: string,
  opts: {
    status?: string;
    tier?: string;
    content_status?: string;
    context_text?: string | null;
    image_url?: string | null;
    h1_title?: string | null;
    seo_title?: string | null;
    seo_description?: string | null;
  } = {},
) {
  await query(
    `INSERT INTO events (
      slug, title, artist_id, venue_id, city_id, date,
      status, tier, content_status,
      context_text, image_url, h1_title, seo_title, seo_description
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title, artist_id = EXCLUDED.artist_id,
      venue_id = EXCLUDED.venue_id, city_id = EXCLUDED.city_id,
      date = EXCLUDED.date, status = EXCLUDED.status, tier = EXCLUDED.tier,
      content_status = EXCLUDED.content_status,
      context_text = EXCLUDED.context_text, image_url = EXCLUDED.image_url,
      h1_title = EXCLUDED.h1_title, seo_title = EXCLUDED.seo_title,
      seo_description = EXCLUDED.seo_description`,
    [
      ev.slug,
      ev.title,
      artistId,
      venueId,
      cityId,
      ev.date,
      opts.status ?? "active",
      opts.tier ?? "tier1",
      opts.content_status ?? "published",
      opts.context_text ?? null,
      opts.image_url ?? null,
      opts.h1_title ?? null,
      opts.seo_title ?? null,
      opts.seo_description ?? null,
    ],
  );
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM events WHERE slug = $1`,
    [ev.slug],
  );
  return row!.id;
}

async function upsertSource(
  eventId: string,
  platform: string,
  sourceEventId: string,
  url: string,
  isResale: boolean,
) {
  await query(
    `INSERT INTO event_sources (event_id, platform, source_event_id, url, affiliate_url, is_resale)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (platform, source_event_id) DO UPDATE SET
       event_id = EXCLUDED.event_id, url = EXCLUDED.url,
       affiliate_url = EXCLUDED.affiliate_url, is_resale = EXCLUDED.is_resale`,
    [eventId, platform, sourceEventId, url, url, isResale],
  );
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM event_sources WHERE platform = $1 AND source_event_id = $2`,
    [platform, sourceEventId],
  );
  return row!.id;
}

async function insertSnapshot(
  sourceId: string,
  minPrice: number | null,
  maxPrice: number | null,
  isSoldOut: boolean,
) {
  await query(
    `INSERT INTO price_snapshots (event_source_id, min_price, max_price, currency, is_sold_out, snapped_at)
     VALUES ($1,$2,$3,'MXN',$4, NOW() - INTERVAL '15 minutes')`,
    [sourceId, minPrice, maxPrice, isSoldOut],
  );
}

async function cleanup() {
  console.log("[cleanup] removing __test-* data");
  // Cascade through event_sources via FK; price_snapshots cascade with event_sources.
  await query(`DELETE FROM events  WHERE slug LIKE '__test-%'`);
  await query(`DELETE FROM venues  WHERE slug LIKE '__test-%'`);
  await query(`DELETE FROM artists WHERE slug LIKE '__test-%'`);
  await query(`DELETE FROM cities  WHERE slug LIKE '__test-%'`);
  console.log("[cleanup] done");
}

async function seed() {
  console.log("[seed] starting");
  const cityId = await upsertCity();
  const venueId = await upsertVenue(cityId);
  const artistId = await upsertArtist();

  const mainEventId = await upsertEvent(
    {
      slug: MAIN_EVENT.slug,
      title: MAIN_EVENT.title,
      date: MAIN_EVENT.date,
    },
    artistId,
    venueId,
    cityId,
    {
      tier: MAIN_EVENT.tier,
      context_text: MAIN_EVENT.context_text,
      image_url: MAIN_EVENT.image_url,
      h1_title: MAIN_EVENT.h1_title,
      seo_title: MAIN_EVENT.seo_title,
      seo_description: MAIN_EVENT.seo_description,
    },
  );

  // 3 sources: ticketmaster cheapest, eventbrite mid, stubhub sold out (resale)
  const src1 = await upsertSource(
    mainEventId,
    "ticketmaster",
    `${PREFIX}tm-1`,
    "https://www.ticketmaster.com.mx/test-event",
    false,
  );
  const src2 = await upsertSource(
    mainEventId,
    "eventbrite",
    `${PREFIX}eb-1`,
    "https://www.eventbrite.com.mx/e/test-event",
    false,
  );
  const src3 = await upsertSource(
    mainEventId,
    "stubhub",
    `${PREFIX}sh-1`,
    "https://www.stubhub.com.mx/test-event",
    true,
  );

  await insertSnapshot(src1, 1850, 8500, false); // cheapest -> "Mejor precio"
  await insertSnapshot(src2, 2400, 9200, false);
  await insertSnapshot(src3, null, null, true); // sold out

  for (const r of RELATED_EVENTS) {
    const id = await upsertEvent(r, artistId, venueId, cityId, {
      tier: "tier1",
      image_url: ARTIST.image_url,
    });
    const s = await upsertSource(
      id,
      "ticketmaster",
      `${PREFIX}tm-${r.slug}`,
      `https://www.ticketmaster.com.mx/${r.slug}`,
      false,
    );
    await insertSnapshot(s, 1950, 7800, false);
  }

  console.log(`[seed] done — main slug: ${MAIN_EVENT.slug}`);
  console.log(`[seed] visit: /evento/${MAIN_EVENT.slug}`);
}

(async () => {
  try {
    if (process.argv.includes("--cleanup")) {
      await cleanup();
    } else {
      await seed();
    }
    process.exit(0);
  } catch (err) {
    console.error("[seed] fatal:", err);
    process.exit(1);
  }
})();
