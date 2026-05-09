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
