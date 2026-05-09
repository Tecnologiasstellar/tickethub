import type { SKEvent } from "./types";
import type { NormalizedEvent } from "../../types";

const CITY_MAP: Record<string, string> = {
  "Mexico City": "Ciudad de Mexico",
  "Mexico": "Ciudad de Mexico",
  "Guadalajara": "Guadalajara",
  "Monterrey": "Monterrey",
  "Puebla": "Puebla",
  "Querétaro": "Queretaro",
  "Tijuana": "Tijuana",
};

function resolveCity(ev: SKEvent): string | null {
  const city =
    ev.venue?.city?.displayName ??
    ev.venue?.metroArea?.displayName ??
    null;
  if (!city) return null;
  return CITY_MAP[city] ?? null;
}

function headliner(ev: SKEvent): string | null {
  if (ev.performance.length === 0) return null;
  const hl = ev.performance.find((p) => p.billing === "headline");
  return hl?.artist.displayName ?? ev.performance[0]?.artist.displayName ?? null;
}

export function normalizeSongkickEvent(ev: SKEvent): NormalizedEvent | null {
  if (ev.status === "cancelled") return null;

  const datetime = ev.start.datetime ?? (ev.start.date ? `${ev.start.date}T21:00:00` : null);
  if (!datetime) return null;
  const date = new Date(datetime);
  if (isNaN(date.getTime())) return null;

  const artistName = headliner(ev);
  if (!artistName) return null;

  const cityName = resolveCity(ev);
  if (!cityName) return null;

  const venueName = ev.venue.displayName.trim() || "Por confirmar";

  return {
    sourceId: String(ev.id),
    sourcePlatform: "songkick",
    title: ev.displayName.trim(),
    artistName,
    venueName,
    cityName,
    date,
    url: ev.uri,
    isResale: false,
  };
}
