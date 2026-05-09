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
