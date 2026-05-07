import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EventCard } from "@/components/EventCard";
import { DataPill } from "@/components/ui/DataPill";
import {
  getVenueBySlug,
  getVenueUpcomingEvents,
  getVenuePastEvents,
} from "@/lib/queries/venue";
import { getAllVenueSlugsWithEvents } from "@/lib/queries/tier2";
import { buildBreadcrumbSchema, buildPlaceSchema } from "@/lib/seo/jsonld";

export const revalidate = 1800;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  if (!process.env.DATABASE_URL) return [];
  const venues = await getAllVenueSlugsWithEvents();
  return venues.map((v) => ({ slug: v.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const venue = await getVenueBySlug(slug);
  if (!venue) return { title: "Venue no encontrado" };

  const title = `${venue.name} — Conciertos y Boletos`;
  const description = `Próximos conciertos en ${venue.name}${venue.city_name ? ` en ${venue.city_name}` : ""}. Compara precios de boletos entre todas las plataformas.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: venue.image_url ? [{ url: venue.image_url }] : [],
    },
    alternates: { canonical: `/venue/${slug}` },
  };
}

export default async function VenuePage({ params }: Props) {
  const { slug } = await params;
  const venue = await getVenueBySlug(slug);
  if (!venue) notFound();

  const [upcomingEvents, pastEvents] = await Promise.all([
    getVenueUpcomingEvents(venue.id),
    getVenuePastEvents(venue.id),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tickethub.mx";

  const placeSchema = buildPlaceSchema(
    {
      name: venue.name,
      slug: venue.slug,
      address: venue.address,
      cityName: venue.city_name ?? "",
      capacity: venue.capacity,
      lat: venue.lat,
      lng: venue.lng,
      imageUrl: venue.image_url,
    },
    siteUrl,
  );

  const breadcrumbItems: Array<{ name: string; href: string }> = [
    { name: "Inicio", href: "/" },
  ];
  if (venue.city_name && venue.city_slug) {
    breadcrumbItems.push({
      name: venue.city_name,
      href: `/ciudad/${venue.city_slug}`,
    });
  }
  breadcrumbItems.push({ name: venue.name, href: `/venue/${slug}` });

  const breadcrumbSchema = buildBreadcrumbSchema(breadcrumbItems, siteUrl);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <main className="mx-auto max-w-[var(--container-max)] px-4 py-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <li>
              <Link href="/" className="hover:text-[var(--color-primary)]">
                Inicio
              </Link>
            </li>
            {venue.city_name && venue.city_slug && (
              <>
                <li aria-hidden>›</li>
                <li>
                  <a
                    href={`/ciudad/${venue.city_slug}`}
                    className="hover:text-[var(--color-primary)]"
                  >
                    {venue.city_name}
                  </a>
                </li>
              </>
            )}
            <li aria-hidden>›</li>
            <li className="text-[var(--color-text)]" aria-current="page">
              {venue.name}
            </li>
          </ol>
        </nav>

        {/* Venue Header */}
        <section className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
          {venue.image_url && (
            <img
              src={venue.image_url}
              alt={venue.name}
              width={120}
              height={120}
              className="h-28 w-28 shrink-0 rounded-[var(--radius-xl)] object-cover border border-[var(--color-border)]"
            />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-3xl font-bold text-[var(--color-text)] mb-2">
              {venue.name}
            </h1>

            {(venue.city_name || venue.address) && (
              <p className="text-sm text-[var(--color-text-muted)] mb-3">
                {[venue.address, venue.city_name].filter(Boolean).join(", ")}
              </p>
            )}

            <div className="flex flex-wrap gap-3 mb-4">
              {venue.capacity && (
                <DataPill
                  label="Capacidad"
                  value={venue.capacity.toLocaleString("es-MX")}
                />
              )}
              <DataPill
                label="Próximos eventos"
                value={upcomingEvents.length}
              />
            </div>

            {venue.description_es && (
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed max-w-2xl">
                {venue.description_es}
              </p>
            )}
          </div>
        </section>

        {/* Google Maps link */}
        {venue.lat && venue.lng && (
          <div className="mt-6 mb-8">
            <a
              href={`https://maps.google.com/?q=${venue.lat},${venue.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-primary)] hover:underline text-sm"
            >
              Ver en Google Maps
            </a>
          </div>
        )}

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <section className="mb-8">
            <h2 className="font-display text-xl font-bold text-[var(--color-text)] mb-3">
              Próximos conciertos
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingEvents.map((e) => (
                <EventCard
                  key={e.id}
                  href={`/evento/${e.slug}`}
                  title={e.title}
                  artistName={e.artist_name ?? undefined}
                  venueName={venue.name}
                  cityName={venue.city_name ?? ""}
                  date={e.date}
                  imageUrl={e.image_url ?? undefined}
                  minPrice={e.min_price ?? undefined}
                  sourceCount={e.source_count}
                />
              ))}
            </div>
          </section>
        )}

        {/* Past Events */}
        {pastEvents.length > 0 && (
          <section className="mb-8">
            <h2 className="font-display text-xl font-bold text-[var(--color-text)] mb-3">
              Eventos anteriores
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pastEvents.map((e) => (
                <EventCard
                  key={e.id}
                  href={`/evento/${e.slug}`}
                  title={e.title}
                  artistName={e.artist_name ?? undefined}
                  venueName={venue.name}
                  cityName={venue.city_name ?? ""}
                  date={e.date}
                  imageUrl={e.image_url ?? undefined}
                  minPrice={e.min_price ?? undefined}
                  sourceCount={e.source_count}
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
