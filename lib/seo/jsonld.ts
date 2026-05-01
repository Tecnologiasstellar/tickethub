export function buildEventSchema(data: {
  slug: string;
  title: string;
  date: string;
  venueName: string;
  venueAddress?: string | null;
  venueLat?: number | null;
  venueLng?: number | null;
  cityName: string;
  artistName?: string | null;
  imageUrl?: string | null;
  minPrice?: number;
  currency?: string;
  eventStatus?: string;
}, siteUrl: string): object {
  const eventStatus =
    data.eventStatus === "cancelled"
      ? "https://schema.org/EventCancelled"
      : data.eventStatus === "sold_out"
      ? "https://schema.org/EventSoldOut"
      : "https://schema.org/EventScheduled";

  return {
    "@context": "https://schema.org",
    "@type": "MusicEvent",
    name: data.title,
    startDate: new Date(data.date).toISOString(),
    eventStatus,
    url: `${siteUrl}/evento/${data.slug}`,
    location: {
      "@type": "Place",
      name: data.venueName,
      address: {
        "@type": "PostalAddress",
        addressLocality: data.cityName,
        addressCountry: "MX",
        ...(data.venueAddress && { streetAddress: data.venueAddress }),
      },
      ...(data.venueLat != null && data.venueLng != null && {
        geo: {
          "@type": "GeoCoordinates",
          latitude: data.venueLat,
          longitude: data.venueLng,
        },
      }),
    },
    ...(data.artistName && {
      performer: { "@type": "MusicGroup", name: data.artistName },
    }),
    ...(data.imageUrl && { image: data.imageUrl }),
    ...(data.minPrice != null && {
      offers: {
        "@type": "AggregateOffer",
        lowPrice: data.minPrice,
        priceCurrency: data.currency ?? "MXN",
        availability:
          data.eventStatus === "sold_out"
            ? "https://schema.org/SoldOut"
            : "https://schema.org/InStock",
      },
    }),
  };
}

export function buildFaqSchema(
  faqs: Array<{ question: string; answer: string }>,
): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(faq => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

export function buildBreadcrumbSchema(
  items: Array<{ name: string; href: string }>,
  siteUrl: string,
): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${siteUrl}${item.href}`,
    })),
  };
}

export function buildMusicGroupSchema(data: {
  name: string;
  slug: string;
  imageUrl?: string | null;
  genres?: string[] | null;
  sameAs?: string[];
}, siteUrl: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "MusicGroup",
    name: data.name,
    url: `${siteUrl}/artista/${data.slug}`,
    ...(data.imageUrl && { image: data.imageUrl }),
    ...(data.genres?.length && { genre: data.genres }),
    ...(data.sameAs?.length && { sameAs: data.sameAs }),
  };
}

export function buildPlaceSchema(data: {
  name: string;
  slug: string;
  address?: string | null;
  cityName: string;
  capacity?: number | null;
  lat?: number | null;
  lng?: number | null;
  imageUrl?: string | null;
}, siteUrl: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "Place",
    name: data.name,
    url: `${siteUrl}/venue/${data.slug}`,
    address: {
      "@type": "PostalAddress",
      addressLocality: data.cityName,
      addressCountry: "MX",
      ...(data.address && { streetAddress: data.address }),
    },
    ...(data.lat != null && data.lng != null && {
      geo: {
        "@type": "GeoCoordinates",
        latitude: data.lat,
        longitude: data.lng,
      },
    }),
    ...(data.capacity && { maximumAttendeeCapacity: data.capacity }),
    ...(data.imageUrl && { image: data.imageUrl }),
  };
}
