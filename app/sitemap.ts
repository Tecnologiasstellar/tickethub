import type { MetadataRoute } from "next";
import {
  getAllActiveGenres,
  getAllCityMonthCombos,
  getSitemapArtistRows,
  getSitemapCityRows,
  getSitemapEventRows,
  getSitemapVenueRows,
} from "@/lib/queries/tier2";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://tickethub.mx";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [events, artists, cities, venues, cityMonths, genres] =
    await Promise.all([
      getSitemapEventRows(),
      getSitemapArtistRows(),
      getSitemapCityRows(),
      getSitemapVenueRows(),
      getAllCityMonthCombos(),
      getAllActiveGenres(),
    ]);

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...events.map((e) => ({
      url: `${siteUrl}/evento/${e.slug}`,
      lastModified: new Date(e.updated_at),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...artists.map((a) => ({
      url: `${siteUrl}/artista/${a.slug}`,
      lastModified: new Date(a.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...cities.map((c) => ({
      url: `${siteUrl}/ciudad/${c.slug}`,
      lastModified: new Date(c.updated_at),
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...venues.map((v) => ({
      url: `${siteUrl}/venue/${v.slug}`,
      lastModified: new Date(v.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...cityMonths.map((cm) => ({
      url: `${siteUrl}/ciudad/${cm.citySlug}/mes/${cm.mes}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
    ...genres.map((g) => ({
      url: `${siteUrl}/genero/${g.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
