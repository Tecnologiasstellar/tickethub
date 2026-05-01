import type { MetadataRoute } from "next";

// Phase 10 will replace this stub with real queries against the DB.
// The stub exists so the /sitemap.xml URL is live from day 1.
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://tickethub.mx";

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
