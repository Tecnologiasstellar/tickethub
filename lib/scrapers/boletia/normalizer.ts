import type { BoletiaRawEvent } from "./types";
import type { NormalizedEvent } from "../../types";

const CITY_MAP: Record<string, string> = {
  "Ciudad de México": "Ciudad de Mexico",
  "CDMX": "Ciudad de Mexico",
  "Mexico City": "Ciudad de Mexico",
  "Guadalajara": "Guadalajara",
  "Monterrey": "Monterrey",
  "Puebla": "Puebla",
  "Querétaro": "Queretaro",
  "Tijuana": "Tijuana",
  "León": "Leon",
};

function normalizeCity(raw?: string): string | null {
  if (!raw) return null;
  return CITY_MAP[raw] ?? null;
}

export function normalizeBoletiaEvent(
  raw: BoletiaRawEvent
): NormalizedEvent | null {
  if (!raw.title || !raw.dateIso) return null;

  const date = new Date(raw.dateIso);
  if (isNaN(date.getTime())) return null;

  const cityName = normalizeCity(raw.cityName);
  if (!cityName) return null;

  const artistName = raw.artistName?.trim() || raw.title;

  return {
    sourceId: raw.sourceId,
    sourcePlatform: "boletia",
    title: raw.title.trim(),
    artistName,
    venueName: raw.venueName?.trim() || "Por confirmar",
    cityName,
    date,
    url: raw.url,
    minPrice: raw.minPrice,
    maxPrice: raw.maxPrice,
    currency: raw.currency ?? "MXN",
    imageUrl: raw.imageUrl,
    isResale: false,
  };
}
