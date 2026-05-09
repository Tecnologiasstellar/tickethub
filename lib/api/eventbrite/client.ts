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
