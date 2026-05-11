import { query } from "../lib/db";

type Result = "OK" | "FAIL" | "SKIP";

interface Check {
  service: string;
  result: Result;
  status: number | string;
  message: string;
}

const PLACEHOLDER_VALUES = new Set([
  "",
  "your-key-here",
  "your_key_here",
  "changeme",
  "TODO",
  "tbd",
]);

const PLACEHOLDER_SUBSTRINGS = [
  "user:password@host",
  "your-",
  "your_",
  "<your",
  "_here",
];

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (PLACEHOLDER_VALUES.has(trimmed)) return true;
  const lower = trimmed.toLowerCase();
  return PLACEHOLDER_SUBSTRINGS.some((s) => lower.includes(s));
}

function fmt(c: Check): string {
  return `[${c.result}] ${c.service.padEnd(13)} — ${String(c.status).padEnd(3)} ${c.message}`;
}

async function checkNeon(): Promise<Check> {
  const service = "Neon";
  if (isPlaceholder(process.env.DATABASE_URL)) {
    return { service, result: "SKIP", status: "—", message: "DATABASE_URL not set" };
  }
  try {
    const rows = await query<{ ok: number }>("SELECT 1 AS ok");
    if (rows[0]?.ok === 1) {
      return { service, result: "OK", status: 200, message: "SELECT 1 returned 1" };
    }
    return { service, result: "FAIL", status: 500, message: "unexpected result from SELECT 1" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { service, result: "FAIL", status: "ERR", message: msg };
  }
}

async function checkTicketmaster(): Promise<Check> {
  const service = "Ticketmaster";
  const key = process.env.TICKETMASTER_API_KEY;
  if (isPlaceholder(key)) {
    return { service, result: "SKIP", status: "—", message: "TICKETMASTER_API_KEY not set" };
  }
  const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${encodeURIComponent(key!)}&size=1`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      return { service, result: "OK", status: res.status, message: "discovery/v2/events reachable" };
    }
    return { service, result: "FAIL", status: res.status, message: res.statusText };
  } catch (err) {
    return { service, result: "FAIL", status: "ERR", message: err instanceof Error ? err.message : String(err) };
  }
}

async function checkEventbrite(): Promise<Check> {
  const service = "Eventbrite";
  // The current ingestion path scrapes the public listing pages; no API key is required.
  // Probe the same URL the scraper hits so a 200 here confirms the route works.
  const url = "https://www.eventbrite.com.mx/d/mexico--ciudad-de-mexico/music/";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
      },
    });
    if (res.ok) {
      return { service, result: "OK", status: res.status, message: "public listing reachable" };
    }
    return { service, result: "FAIL", status: res.status, message: res.statusText };
  } catch (err) {
    return { service, result: "FAIL", status: "ERR", message: err instanceof Error ? err.message : String(err) };
  }
}

async function checkSpotify(): Promise<Check> {
  const service = "Spotify";
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (isPlaceholder(id) || isPlaceholder(secret)) {
    return { service, result: "SKIP", status: "—", message: "SPOTIFY_CLIENT_ID/SECRET not set" };
  }
  try {
    const basic = Buffer.from(`${id}:${secret}`).toString("base64");
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (res.ok) {
      return { service, result: "OK", status: res.status, message: "client_credentials token issued" };
    }
    const text = await res.text();
    return { service, result: "FAIL", status: res.status, message: text.slice(0, 120) };
  } catch (err) {
    return { service, result: "FAIL", status: "ERR", message: err instanceof Error ? err.message : String(err) };
  }
}

async function checkSongkick(): Promise<Check> {
  const service = "Songkick";
  const key = process.env.SONGKICK_API_KEY;
  if (isPlaceholder(key)) {
    return { service, result: "SKIP", status: "—", message: "SONGKICK_API_KEY not set" };
  }
  const url = `https://api.songkick.com/api/3.0/search/locations.json?query=mexico&apikey=${encodeURIComponent(key!)}`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      return { service, result: "OK", status: res.status, message: "search/locations reachable" };
    }
    return { service, result: "FAIL", status: res.status, message: res.statusText };
  } catch (err) {
    return { service, result: "FAIL", status: "ERR", message: err instanceof Error ? err.message : String(err) };
  }
}

async function checkSetlistFm(): Promise<Check> {
  const service = "Setlist.fm";
  const key = process.env.SETLISTFM_API_KEY;
  if (isPlaceholder(key)) {
    return { service, result: "SKIP", status: "—", message: "SETLISTFM_API_KEY not set" };
  }
  const url = "https://api.setlist.fm/rest/1.0/search/artists?artistName=test&p=1&sort=relevance";
  try {
    const res = await fetch(url, {
      headers: { "x-api-key": key!, Accept: "application/json" },
    });
    if (res.ok) {
      return { service, result: "OK", status: res.status, message: "search/artists reachable" };
    }
    return { service, result: "FAIL", status: res.status, message: res.statusText };
  } catch (err) {
    return { service, result: "FAIL", status: "ERR", message: err instanceof Error ? err.message : String(err) };
  }
}

async function checkOpenAI(): Promise<Check> {
  const service = "OpenAI";
  const key = process.env.OPENAI_API_KEY;
  if (isPlaceholder(key)) {
    return { service, result: "SKIP", status: "—", message: "OPENAI_API_KEY not set" };
  }
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok) {
      return { service, result: "OK", status: res.status, message: "v1/models reachable" };
    }
    const text = await res.text();
    return { service, result: "FAIL", status: res.status, message: text.slice(0, 120) };
  } catch (err) {
    return { service, result: "FAIL", status: "ERR", message: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  console.log("[preflight] probing external credentials…\n");

  const checks = await Promise.all([
    checkNeon(),
    checkTicketmaster(),
    checkEventbrite(),
    checkSpotify(),
    checkSongkick(),
    checkSetlistFm(),
    checkOpenAI(),
  ]);

  for (const c of checks) console.log(fmt(c));

  const ok = checks.filter((c) => c.result === "OK").length;
  const fail = checks.filter((c) => c.result === "FAIL").length;
  const skip = checks.filter((c) => c.result === "SKIP").length;

  console.log(`\n[preflight] ${ok} ok · ${fail} fail · ${skip} skip`);

  if (fail > 0) {
    console.error("[preflight] one or more configured services FAILED — fix before running ingest");
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[preflight] fatal:", err);
  process.exit(1);
});
