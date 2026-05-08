import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { EventCard } from "@/components/EventCard";
import {
  getActiveGenres,
  getGenreBySlug,
  getGenreEventsByName,
} from "@/lib/queries/tier2";
import { buildBreadcrumbSchema } from "@/lib/seo/jsonld";

export const revalidate = 1800;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const genres = await getActiveGenres();
  return genres.map((genre) => ({ slug: genre.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const genre = await getGenreBySlug(slug);
  if (!genre) return { title: "Género no encontrado" };

  const title = `Conciertos de ${genre.name} en México`;
  const description = `Eventos publicados de ${genre.name} en México. Compara precios de boletos y explora fechas disponibles.`;

  return {
    title,
    description,
    alternates: { canonical: `/genero/${slug}` },
  };
}

export default async function GeneroPage({ params }: Props) {
  const { slug } = await params;
  const genre = await getGenreBySlug(slug);
  if (!genre) notFound();

  const events = await getGenreEventsByName(genre.name);
  if (events.length === 0) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tickethub.mx";
  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: "Inicio", href: "/" },
      { name: genre.name, href: `/genero/${slug}` },
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
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <li>
              <Link href="/" className="hover:text-[var(--color-primary)]">
                Inicio
              </Link>
            </li>
            <li aria-hidden>›</li>
            <li aria-current="page" className="text-[var(--color-text)]">
              {genre.name}
            </li>
          </ol>
        </nav>

        <header className="mb-8">
          <h1 className="font-display text-3xl font-bold text-[var(--color-text)] md:text-4xl">
            Conciertos de {genre.name} en México
          </h1>
          <p className="mt-3 text-[var(--color-text-muted)]">
            {events.length} evento{events.length !== 1 ? "s" : ""} publicado
            {events.length !== 1 ? "s" : ""} para explorar.
          </p>
        </header>

        <section aria-labelledby="genre-events-heading">
          <h2
            id="genre-events-heading"
            className="font-display mb-5 text-2xl font-bold text-[var(--color-text)]"
          >
            Próximas fechas
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard
                key={event.id}
                href={`/evento/${event.slug}`}
                title={event.title}
                artistName={event.artist_name ?? undefined}
                venueName={event.venue_name ?? ""}
                cityName={event.city_name ?? "México"}
                date={event.date}
                imageUrl={event.image_url ?? undefined}
                minPrice={event.min_price ?? undefined}
                sourceCount={event.source_count}
              />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
