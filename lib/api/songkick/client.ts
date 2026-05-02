import { fetchWithRetry, delay } from "../../utils/http";
import type { SKEventsResponse, SKEvent } from "./types";

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
   * Yield all upcoming Concert/Festival events for known Mexican metro areas.
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
