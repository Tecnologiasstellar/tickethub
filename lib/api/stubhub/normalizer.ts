import type { SHEvent } from "./types";
import type { NormalizedEvent } from "../../types";

const CITY_MAP: Record<string, string> = {
  "Mexico City": "Ciudad de Mexico",
  "Ciudad de Mexico": "Ciudad de Mexico",
  "Guadalajara": "Guadalajara",
  "Monterrey": "Monterrey",
  "Puebla": "Puebla",
  "Queretaro": "Queretaro",
  "Tijuana": "Tijuana",
  "Leon": "Leon",
};

export function normalizeStubHubEvent(ev: SHEvent): NormalizedEvent | null {
  if (ev.status !== "Active") return null;

  const date = new Date(ev.dateLocal);
  if (isNaN(date.getTime())) return null;

  const cityName = CITY_MAP[ev.venue.city] ?? null;
  if (!cityName) return null;

  const headliner =
    ev.performers.find((p) => p.primaryAct)?.name ??
    ev.performers[0]?.name ??
    ev.name;

  return {
    sourceId: String(ev.id),
    sourcePlatform: "stubhub",
    title: ev.name.trim(),
    artistName: headliner.trim(),
    venueName: ev.venue.name.trim() || "Por confirmar",
    cityName,
    date,
    url: ev.eventUrl,
    minPrice: ev.ticketInfo?.minPrice,
    maxPrice: ev.ticketInfo?.maxPrice,
    currency: ev.ticketInfo?.currency ?? "MXN",
    imageUrl: ev.imageUrl,
    isResale: true,
  };
}
