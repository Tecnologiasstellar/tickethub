import type { EBEvent } from "./types";
import type { NormalizedEvent } from "../../types";

/**
 * Heuristic: extract headliner from titles like
 * "Caifanes en el Auditorio Nacional" → "Caifanes"
 * "Bad Bunny - Mexico City Tour"      → "Bad Bunny"
 */
function extractArtist(title: string): string {
  // Match text before: " en ", " en el ", " at ", " at the ", " - ", " – ", " — ", " @ "
  const match = title.match(
    /^(.+?)(?:\s+(?:en\s+el|en\s+la|en|at\s+the|at|in)\s+|\s*[-–—@]\s*).*/i
  );
  if (match) return match[1].trim();
  // Fallback: everything before the first dash
  const dashIdx = title.search(/[-–—]/);
  return dashIdx > 0 ? title.slice(0, dashIdx).trim() : title.trim();
}

/** Map Eventbrite city names to the slugified city names in our cities table. */
const CITY_MAP: Record<string, string> = {
  "Mexico City": "Ciudad de Mexico",
  "Ciudad de México": "Ciudad de Mexico",
  "Guadalajara": "Guadalajara",
  "Monterrey": "Monterrey",
  "Puebla": "Puebla",
  "Querétaro": "Queretaro",
  "Tijuana": "Tijuana",
  "León": "Leon",
};

function normalizeCity(raw?: string): string | null {
  if (!raw) return null;
  return CITY_MAP[raw] ?? raw;
}

export function normalizeEventbriteEvent(
  ev: EBEvent
): NormalizedEvent | null {
  // Skip unlisted, non-live, or draft events
  if (!ev.listed || ev.status === "draft" || ev.status === "completed") return null;

  const title = ev.name.text.trim();
  const artistName = extractArtist(title);

  const venueName = ev.venue?.name?.trim() ?? "Por confirmar";
  const rawCity = ev.venue?.address?.city;
  const cityName = normalizeCity(rawCity);
  if (!cityName) return null;

  const date = new Date(ev.start.utc);
  if (isNaN(date.getTime())) return null;

  const avail = ev.ticket_availability;
  const minPrice = avail?.minimum_ticket_price?.value;
  const maxPrice = avail?.maximum_ticket_price?.value;
  const currency = avail?.minimum_ticket_price?.currency ?? "MXN";
  const imageUrl = ev.logo?.original?.url ?? ev.logo?.url;

  return {
    sourceId: ev.id,
    sourcePlatform: "eventbrite",
    title,
    artistName,
    venueName,
    cityName,
    date,
    url: ev.url,
    minPrice,
    maxPrice,
    currency,
    imageUrl,
    isResale: false,
  };
}
