import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EventCard } from "@/components/EventCard";
import {
  getCityBySlug,
  getCityUpcomingEvents,
  getCityVenues,
} from "@/lib/queries/ciudad";
import { getAllCitySlugsWithEvents } from "@/lib/queries/tier2";
import { buildBreadcrumbSchema } from "@/lib/seo/jsonld";

export const revalidate = 1800;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const cities = await getAllCitySlugsWithEvents();
  return cities.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const city = await getCityBySlug(slug);
  if (!city) return { title: "Ciudad no encontrada" };

  const title = `Conciertos en ${city.name} — Boletos y Fechas`;
  const description = `Descubre los próximos conciertos en ${city.name}. Compara precios de boletos entre todas las plataformas y encuentra las mejores ofertas.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
    alternates: { canonical: `/ciudad/${slug}` },
  };
}

export default async function CiudadPage({ params }: Props) {
  const { slug } = await params;
  const city = await getCityBySlug(slug);
  if (!city) notFound();

  const [upcomingEvents, venues] = await Promise.all([
    getCityUpcomingEvents(city.id),
    getCityVenues(city.id),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tickethub.mx";

  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: "Inicio", href: "/" },
      { name: city.name, href: `/ciudad/${slug}` },
    ],
    siteUrl,
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <main className="mx-auto max-w-[var(--container-max)] px-4 py-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <li>
              <a href="/" className="hover:text-[var(--color-primary)]">
                Inicio
              </a>
            </li>
            <li aria-hidden>›</li>
            <li className="text-[var(--color-text)]" aria-current="page">
              {city.name}
            </li>
          </ol>
        </nav>

        {/* City Header */}
        <section className="mb-8">
          <h1 className="font-display text-3xl font-bold text-[var(--color-text)] mb-2">
            Conciertos en {city.name}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {city.country}
          </p>
          <div className="flex flex-wrap gap-3 mt-3">
            {upcomingEvents.length > 0 && (
              <span className="text-sm text-[var(--color-text-muted)]">
                {upcomingEvents.length} evento{upcomingEvents.length !== 1 ? "s" : ""} próximos
              </span>
            )}
            {venues.length > 0 && (
              <span className="text-sm text-[var(--color-text-muted)]">
                {venues.length} venue{venues.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </section>

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
                  venueName={e.venue_name ?? ""}
                  cityName={city.name}
                  date={e.date}
                  imageUrl={e.image_url ?? undefined}
                  minPrice={e.min_price ?? undefined}
                  sourceCount={e.source_count}
                />
              ))}
            </div>
          </section>
        )}

        {/* Venues */}
        {venues.length > 0 && (
          <section className="mb-8">
            <h2 className="font-display text-xl font-bold text-[var(--color-text)] mb-3">
              Venues
            </h2>
            <ul className="flex flex-col gap-3">
              {venues.map((v) => (
                <li
                  key={v.id}
                  className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
                >
                  <a
                    href={`/venue/${v.slug}`}
                    className="font-medium text-[var(--color-text)] hover:text-[var(--color-primary)]"
                  >
                    {v.name}
                  </a>
                  {v.address && (
                    <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                      {v.address}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3 mt-2">
                    {v.capacity != null && (
                      <span className="text-xs text-[var(--color-text-muted)]">
                        Capacidad: {v.capacity.toLocaleString("es-MX")}
                      </span>
                    )}
                    {v.upcoming_count > 0 && (
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {v.upcoming_count} evento{v.upcoming_count !== 1 ? "s" : ""} próximos
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
