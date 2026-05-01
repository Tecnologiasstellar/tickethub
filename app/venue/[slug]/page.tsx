import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EventCard } from "@/components/EventCard";
import { VenueMap } from "@/components/VenueMap";
import { DataPill } from "@/components/ui/DataPill";
import {
  getVenueBySlug,
  getVenueUpcomingEvents,
  getVenuePastEvents,
  getVenueSlugs,
} from "@/lib/queries/venue";
import { buildPlaceSchema, buildBreadcrumbSchema } from "@/lib/seo/jsonld";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const slugs = await getVenueSlugs();
  return slugs.map(slug => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const venue = await getVenueBySlug(slug);
  if (!venue) return { title: "Venue no encontrado" };

  const title = `${venue.name} — Eventos y boletos`;
  const description =
    venue.description_es ??
    `Próximos eventos en ${venue.name}, ${venue.city_name ?? "México"}. Compara precios de boletos.`;

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
    getVenuePastEvents(venue.id, 8),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tickethub.mx";

  const placeSchema = buildPlaceSchema(
    {
      name: venue.name,
      slug: venue.slug,
      address: venue.address,
      cityName: venue.city_name ?? "México",
      capacity: venue.capacity,
      lat: venue.lat,
      lng: venue.lng,
      imageUrl: venue.image_url,
    },
    siteUrl,
  );
  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: "Inicio", href: "/" },
      ...(venue.city_slug
        ? [{ name: venue.city_name ?? "Ciudad", href: `/ciudad/${venue.city_slug}` }]
        : []),
      { name: venue.name, href: `/venue/${slug}` },
    ],
    siteUrl,
  );

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

      <div className="mx-auto max-w-[var(--container-max)] px-4 py-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <li>
              <a href="/" className="hover:text-[var(--color-primary)]">Inicio</a>
            </li>
            {venue.city_slug && (
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
            <li aria-current="page" className="truncate text-[var(--color-text)]">
              {venue.name}
            </li>
          </ol>
        </nav>

        {/* Venue hero image */}
        {venue.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={venue.image_url}
            alt={venue.name}
            className="mb-6 h-52 w-full rounded-[var(--radius-xl)] object-cover"
          />
        )}

        <header className="mb-8">
          <h1 className="font-display text-4xl font-bold text-[var(--color-text)] md:text-5xl">
            {venue.name}
          </h1>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {venue.city_name && (
              <DataPill
                label="Ciudad"
                value={
                  venue.city_slug ? (
                    <a
                      href={`/ciudad/${venue.city_slug}`}
                      className="hover:text-[var(--color-primary)]"
                    >
                      {venue.city_name}
                    </a>
                  ) : (
                    venue.city_name
                  )
                }
              />
            )}
            {venue.capacity && (
              <DataPill
                label="Capacidad"
                value={venue.capacity.toLocaleString("es-MX")}
              />
            )}
            {venue.address && (
              <DataPill label="Dirección" value={venue.address} />
            )}
          </div>
          {venue.description_es && (
            <p className="mt-4 max-w-prose leading-[var(--leading-relaxed)] text-[var(--color-text-muted)]">
              {venue.description_es}
            </p>
          )}
        </header>

        <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
          {/* Upcoming events */}
          <div className="space-y-10">
            <section aria-labelledby="upcoming-heading">
              <h2
                id="upcoming-heading"
                className="font-display mb-5 text-2xl font-bold text-[var(--color-text)]"
              >
                Próximos eventos
              </h2>
              {upcomingEvents.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {upcomingEvents.map(ev => (
                    <EventCard
                      key={ev.id}
                      href={`/evento/${ev.slug}`}
                      title={ev.title}
                      artistName={ev.artist_name ?? undefined}
                      venueName={venue.name}
                      cityName={venue.city_name ?? ""}
                      date={ev.date}
                      imageUrl={ev.image_url ?? undefined}
                      minPrice={ev.min_price ?? undefined}
                      sourceCount={ev.source_count}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-[var(--color-text-muted)]">
                  No hay eventos próximos en este venue.
                </p>
              )}
            </section>

            {/* Past events — collapsible */}
            {pastEvents.length > 0 && (
              <section>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3">
                    <h2 className="font-display text-2xl font-bold text-[var(--color-text)]">
                      Eventos pasados
                    </h2>
                    <span className="text-xs text-[var(--color-text-muted)] transition-transform group-open:rotate-180">
                      ▾
                    </span>
                  </summary>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {pastEvents.map(ev => (
                      <EventCard
                        key={ev.id}
                        href={`/evento/${ev.slug}`}
                        title={ev.title}
                        artistName={ev.artist_name ?? undefined}
                        venueName={venue.name}
                        cityName={venue.city_name ?? ""}
                        date={ev.date}
                        imageUrl={ev.image_url ?? undefined}
                        availability="past"
                      />
                    ))}
                  </div>
                </details>
              </section>
            )}
          </div>

          {/* Map sidebar */}
          {venue.lat != null && venue.lng != null && (
            <aside>
              <h2 className="font-display mb-3 text-lg font-bold text-[var(--color-text)]">
                Ubicación
              </h2>
              <VenueMap
                lat={venue.lat}
                lng={venue.lng}
                name={venue.name}
                address={venue.address}
              />
            </aside>
          )}
        </div>
      </div>
    </>
  );
}
