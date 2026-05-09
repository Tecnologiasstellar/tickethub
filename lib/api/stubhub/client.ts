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
