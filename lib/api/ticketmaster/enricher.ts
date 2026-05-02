import type { TMEvent } from "./types";
import type { NormalizedEvent } from "../../types";

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

export function tmEventToNormalized(ev: TMEvent): NormalizedEvent | null {
  const status = ev.dates.status.code;
  if (status === "cancelled") return null;

  const dateStr = ev.dates.start.dateTime ?? `${ev.dates.start.localDate}T21:00:00Z`;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  const venue = ev._embedded?.venues?.[0];
  const rawCity = venue?.city?.name ?? "";
  const cityName = CITY_MAP[rawCity] ?? null;
  if (!cityName) return null;

  const attraction = ev._embedded?.attractions?.[0];
  const artistName = attraction?.name ?? ev.name;

  const venueName = venue?.name?.trim() ?? "Por confirmar";

  const prices = ev.priceRanges?.find((p) => p.type === "standard") ?? ev.priceRanges?.[0];
  const minPrice = prices?.min;
  const maxPrice = prices?.max;
  const currency = prices?.currency ?? "MXN";

  const image =
    ev.images.find((i) => i.ratio === "16_9" && i.width >= 640) ??
    ev.images[0];

  return {
    sourceId: ev.id,
    sourcePlatform: "ticketmaster",
    title: ev.name.trim(),
    artistName: artistName.trim(),
    venueName,
    cityName,
    date,
    url: ev.url,
    minPrice,
    maxPrice,
    currency,
    imageUrl: image?.url,
    isResale: false,
  };
}
