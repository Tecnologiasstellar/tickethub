import { fetchWithRetry, delay } from "../../utils/http";
import type {
  SpotifyTokenResponse,
  SpotifyArtist,
  SpotifyArtistSearchResponse,
} from "./types";

const ACCOUNTS = "https://accounts.spotify.com";
const API = "https://api.spotify.com/v1";

export class SpotifyClient {
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

    const res = await fetchWithRetry(`${ACCOUNTS}/api/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Spotify token request failed ${res.status}: ${body}`);
    }

    const data = (await res.json()) as SpotifyTokenResponse;
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
  }

  private async get<T>(path: string, qs?: Record<string, string>): Promise<T> {
    await this.ensureToken();
    const url = `${API}${path}${qs ? "?" + new URLSearchParams(qs) : ""}`;
    const res = await fetchWithRetry(url, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Spotify GET ${path} failed ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  /**
   * Search for an artist by name. Returns the best match or null.
   * Compares the top result name case-insensitively.
   */
  async searchArtist(name: string): Promise<SpotifyArtist | null> {
    const data = await this.get<SpotifyArtistSearchResponse>("/search", {
      q: name,
      type: "artist",
      limit: "3",
    });
    const items = data.artists.items;
    if (items.length === 0) return null;

    const normalizedQuery = name.toLowerCase().trim();
    const exact = items.find(
      (a) => a.name.toLowerCase().trim() === normalizedQuery
    );
    return exact ?? items[0];
  }

  /** Small delay helper for callers. */
  wait(ms: number) {
    return delay(ms);
  }
}
