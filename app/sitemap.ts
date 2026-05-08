import type { MetadataRoute } from "next";
import {
  getActiveGenres,
  getPublishedCityMonthCombos,
  getSitemapArtistRows,
  getSitemapCityRows,
  getSitemapEventRows,
  getSitemapVenueRows,
} from "@/lib/queries/tier2";

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://tickethub.mx"
).replace(/\/$/, "");

function uniqueEntries(entries: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  const byUrl = new Map<string, MetadataRoute.Sitemap[number]>();
  for (const entry of entries) {
    byUrl.set(entry.url, entry);
  }
  return Array.from(byUrl.values());
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [events, artists, cities, venues, cityMonths, genres] =
    await Promise.all([
      getSitemapEventRows(),
      getSitemapArtistRows(),
      getSitemapCityRows(),
      getSitemapVenueRows(),
      getPublishedCityMonthCombos(),
      getActiveGenres(),
    ]);

  return uniqueEntries([
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...events.map((event) => ({
      url: `${siteUrl}/evento/${event.slug}`,
      lastModified: new Date(event.updated_at),
      changeFrequency: "daily" as const,
      priority: 0.85,
    })),
    ...artists.map((artist) => ({
      url: `${siteUrl}/artista/${artist.slug}`,
      lastModified: new Date(artist.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...cities.map((city) => ({
      url: `${siteUrl}/ciudad/${city.slug}`,
      lastModified: new Date(city.updated_at),
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...venues.map((venue) => ({
      url: `${siteUrl}/venue/${venue.slug}`,
      lastModified: new Date(venue.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...cityMonths.map((combo) => ({
      url: `${siteUrl}/ciudad/${combo.slug}/${combo.mes}`,
      lastModified: new Date(combo.updated_at),
      changeFrequency: "daily" as const,
      priority: 0.55,
    })),
    ...genres.map((genre) => ({
      url: `${siteUrl}/genero/${genre.slug}`,
      lastModified: new Date(genre.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ]);
}
