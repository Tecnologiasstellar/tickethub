import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EventCard } from "@/components/EventCard";
import {
  getAllActiveGenres,
  getGenreBySlug,
  getGenreEvents,
} from "@/lib/queries/tier2";

export const revalidate = 1800;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  if (!process.env.DATABASE_URL) return [];
  const genres = await getAllActiveGenres();
  return genres.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const genre = await getGenreBySlug(slug);
  if (!genre) return {};

  const title = `Conciertos de ${genre.name} en México`;
  const description = `Próximos conciertos y eventos de ${genre.name} en México. Compara precios entre Boletia, Eventbrite, Superboletos y más.`;

  return {
    title,
    description,
    alternates: { canonical: `/genero/${slug}` },
  };
}

export default async function GeneroPage({ params }: Props) {
  const { slug } = await params;

  const [genre, events] = await Promise.all([
    getGenreBySlug(slug),
    getGenreEvents(slug),
  ]);

  if (!genre) notFound();

  return (
    <main>
      <section className="mx-auto max-w-[var(--container-max)] px-4 py-8">
        <h1 className="font-display text-3xl font-bold text-[var(--color-text)] mb-2">
          Conciertos de {genre.name}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {events.length} evento{events.length !== 1 ? "s" : ""} próximo{events.length !== 1 ? "s" : ""}
        </p>
      </section>

      <section className="mx-auto max-w-[var(--container-max)] px-4 pb-8">
        {events.length === 0 ? (
          <p className="text-[var(--color-text-muted)]">No hay eventos</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard
                key={event.id}
                href={`/evento/${event.slug}`}
                title={event.title}
                artistName={event.artist_name ?? undefined}
                venueName={event.venue_name ?? ""}
                cityName={event.city_name ?? ""}
                date={event.date}
                imageUrl={event.image_url ?? undefined}
                minPrice={event.min_price ?? undefined}
                sourceCount={event.source_count}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
