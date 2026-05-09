import { fetchWithRetry, delay } from "../../utils/http";
import type { EBEvent } from "./types";

const BASE = "https://www.eventbrite.com.mx/d";

/**
 * Eventbrite city slugs for their public listing pages.
 * Format: /d/mexico--{city-slug}/music/
 */
const MX_CITY_SLUGS = [
  "ciudad-de-mexico",
  "guadalajara",
  "monterrey",
  "puebla",
  "queretaro",
  "tijuana",
];

const HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
};

/** Extract the first application/ld+json script block from an HTML string. */
function extractJsonLd(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(m[1]));
    } catch {
      // malformed block — skip
    }
  }
  return blocks;
}

/** Extract the highest page number linked from the HTML. */
function maxPageNumber(html: string): number {
  const nums = [...html.matchAll(/[?&]page=(\d+)/g)].map((m) =>
    parseInt(m[1], 10)
  );
  return nums.length > 0 ? Math.max(...nums) : 1;
}

/** Parse events from the first ItemList JSON-LD block. */
function parseEventsFromLd(html: string): EBEvent[] {
  const blocks = extractJsonLd(html);
  for (const block of blocks) {
    const b = block as Record<string, unknown>;
    if (!Array.isArray(b.itemListElement)) continue;
    const items = b.itemListElement as Array<{ item?: Record<string, unknown> }>;
    const events: EBEvent[] = [];
    for (const listItem of items) {
      const item = listItem.item;
      if (!item || typeof item.url !== "string") continue;

      // Extract numeric ID from URL: .../tickets-123456789
      const idMatch = item.url.match(/tickets-(\d+)/);
      if (!idMatch) continue;

      const location = item.location as Record<string, unknown> | undefined;
      const address = location?.address as Record<string, unknown> | undefined;
      const geo = location?.geo as Record<string, unknown> | undefined;

      events.push({
        id: idMatch[1],
        name: { text: String(item.name ?? ""), html: String(item.name ?? "") },
        url: item.url,
        start: {
          local: String(item.startDate ?? ""),
          utc: String(item.startDate ?? ""),
          timezone: "America/Mexico_City",
        },
        end: {
          local: String(item.endDate ?? item.startDate ?? ""),
          utc: String(item.endDate ?? item.startDate ?? ""),
          timezone: "America/Mexico_City",
        },
        status: "live",
        listed: true,
        logo: item.image
          ? { url: String(item.image), original: { url: String(item.image) } }
          : undefined,
        description: item.description
          ? { text: String(item.description), html: String(item.description) }
          : undefined,
        venue: location
          ? {
              id: "",
              name: String(location.name ?? address?.streetAddress ?? ""),
              address: {
                city: String(address?.addressLocality ?? ""),
                region: String(address?.addressRegion ?? ""),
                country: String(address?.addressCountry ?? ""),
                address_1: String(address?.streetAddress ?? ""),
              },
              geo: geo
                ? {
                    latitude: String(geo.latitude ?? ""),
                    longitude: String(geo.longitude ?? ""),
                  }
                : undefined,
            }
          : undefined,
      });
    }
    if (events.length > 0) return events;
  }
  return [];
}

export class EventbriteClient {
  // Token kept for compatibility; scraper doesn't need auth.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(token?: string) {}

  /** Fetch one page of music events for a city slug. */
  async scrapePage(citySlug: string, page: number): Promise<{ events: EBEvent[]; maxPage: number }> {
    const url =
      page === 1
        ? `${BASE}/mexico--${citySlug}/music/`
        : `${BASE}/mexico--${citySlug}/music/?page=${page}`;

    const res = await fetchWithRetry(url, { headers: HEADERS });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Eventbrite scrape failed ${res.status}: ${url}\n${body.slice(0, 200)}`);
    }

    const html = await res.text();
    const events = parseEventsFromLd(html);
    const maxPage = maxPageNumber(html);
    return { events, maxPage };
  }

  /** Yield all upcoming music events across Mexican metros. */
  async *allMexicoEvents(): AsyncGenerator<EBEvent> {
    for (const slug of MX_CITY_SLUGS) {
      let page = 1;
      let maxPage = 1;

      do {
        const { events, maxPage: mp } = await this.scrapePage(slug, page);
        maxPage = mp;
        console.log(
          `[eventbrite] ${slug} page ${page}/${maxPage}: ${events.length} events`
        );

        for (const ev of events) {
          yield ev;
        }

        page++;
        if (page <= maxPage) await delay(500);
      } while (page <= maxPage);
    }
  }
}
