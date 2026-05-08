import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { EventsByMonth } from "@/components/EventsByMonth";
import { Badge } from "@/components/ui/Badge";
import {
  getCityBySlug,
  getCityUpcomingEvents,
  getCityVenues,
} from "@/lib/queries/ciudad";
import { getPublishedCitySlugs } from "@/lib/queries/tier2";
import { buildBreadcrumbSchema } from "@/lib/seo/jsonld";

export const revalidate = 3600;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const slugs = await getPublishedCitySlugs();
  return slugs.map(row => ({ slug: row.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const city = await getCityBySlug(slug);
  if (!city) return { title: "Ciudad no encontrada" };

  const title = `Conciertos en ${city.name} — Boletos y eventos`;
  const description = `Próximos conciertos y eventos en ${city.name}, México. Compara precios de boletos en todas las plataformas.`;

  return {
    title,
    description,
    alternates: { canonical: `/ciudad/${slug}` },
  };
}

export default async function CiudadPage({ params }: Props) {
  const { slug } = await params;
  const city = await getCityBySlug(slug);
  if (!city) notFound();

  const [events, venues] = await Promise.all([
    getCityUpcomingEvents(city.id),
    getCityVenues(city.id),
  ]);
  if (events.length === 0) notFound();

  const genreSet = new Set<string>();
  for (const ev of events) {
    for (const g of ev.artist_genres ?? []) {
      genreSet.add(g);
    }
  }
  const genres = Array.from(genreSet).slice(0, 12);

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

      <div className="mx-auto max-w-[var(--container-max)] px-4 py-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <li>
              <Link href="/" className="hover:text-[var(--color-primary)]">Inicio</Link>
            </li>
            <li aria-hidden>›</li>
            <li aria-current="page" className="text-[var(--color-text)]">
              {city.name}
            </li>
          </ol>
        </nav>

        {/* City hero */}
        <header className="mb-10">
          <h1 className="font-display text-4xl font-bold text-[var(--color-text)] md:text-5xl">
            Conciertos en {city.name}
          </h1>
          <p className="mt-3 text-lg text-[var(--color-text-muted)]">
            {events.length > 0
              ? `${events.length} evento${events.length !== 1 ? "s" : ""} próximo${events.length !== 1 ? "s" : ""}`
              : "Sin eventos próximos"}
          </p>
        </header>

        <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
          {/* Events */}
          <section aria-labelledby="events-heading">
            <h2
              id="events-heading"
              className="font-display mb-6 text-2xl font-bold text-[var(--color-text)]"
            >
              Próximos eventos
            </h2>
            {events.length > 0 ? (
              <EventsByMonth events={events} genres={genres} />
            ) : (
              <p className="text-[var(--color-text-muted)]">
                No hay eventos próximos registrados para {city.name}.
              </p>
            )}
          </section>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* City map */}
            {city.lat != null && city.lng != null && (
              <section aria-labelledby="map-heading">
                <h2
                  id="map-heading"
                  className="font-display mb-3 text-lg font-bold text-[var(--color-text)]"
                >
                  Venues en {city.name}
                </h2>
                <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
                  <iframe
                    title={`Mapa de venues en ${city.name}`}
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${city.lng - 0.08}%2C${city.lat - 0.05}%2C${city.lng + 0.08}%2C${city.lat + 0.05}&layer=mapnik`}
                    width="100%"
                    height="220"
                    style={{ border: "none", display: "block" }}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </section>
            )}

            {/* Venues list */}
            {venues.length > 0 && (
              <section aria-labelledby="venues-heading">
                <h2
                  id="venues-heading"
                  className="font-display mb-3 text-lg font-bold text-[var(--color-text)]"
                >
                  Principales venues
                </h2>
                <ul className="space-y-2">
                  {venues.slice(0, 8).map(v => (
                    <li key={v.id}>
                      <a
                        href={`/venue/${v.slug}`}
                        className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-2)]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--color-text)]">
                            {v.name}
                          </p>
                          {v.capacity && (
                            <p className="text-xs text-[var(--color-text-muted)]">
                              Cap. {v.capacity.toLocaleString("es-MX")}
                            </p>
                          )}
                        </div>
                        {v.upcoming_count > 0 && (
                          <Badge tone="primary" variant="soft" className="ml-3 shrink-0">
                            {v.upcoming_count}
                          </Badge>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
