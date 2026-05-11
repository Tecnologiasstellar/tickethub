import type { Metadata } from "next";
import { EventCard } from "@/components/EventCard";
import { SearchBar } from "@/components/SearchBar";
import { searchEvents } from "@/lib/queries/search";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  const term = (q ?? "").trim();
  if (!term) {
    return {
      title: { absolute: "Buscar eventos | TicketHub.mx" },
      description: "Busca conciertos, festivales y eventos en México.",
      robots: { index: false, follow: true },
    };
  }
  return {
    title: { absolute: `Resultados para "${term}" | TicketHub.mx` },
    description: `Resultados de búsqueda para "${term}" en TicketHub.mx.`,
    robots: { index: false, follow: true },
  };
}

export default async function BuscarPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const term = (q ?? "").trim();
  const results = term ? await searchEvents(term) : [];

  return (
    <div className="mx-auto max-w-[var(--container-max)] px-4 py-10">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold text-[var(--color-text)] md:text-4xl">
          {term ? <>Resultados para &ldquo;{term}&rdquo;</> : "Buscar eventos"}
        </h1>
        {term && (
          <p className="mt-2 text-[var(--color-text-muted)]">
            {results.length === 0
              ? "Sin resultados"
              : `${results.length} ${results.length === 1 ? "evento encontrado" : "eventos encontrados"}`}
          </p>
        )}
        <div className="mt-6">
          <SearchBar />
        </div>
      </header>

      {term && results.length === 0 && (
        <p className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-[var(--color-text-muted)]">
          No encontramos eventos para &ldquo;{term}&rdquo;. Intenta con otro
          artista o ciudad.
        </p>
      )}

      {results.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.map(ev => (
            <EventCard
              key={ev.id}
              href={`/evento/${ev.slug}`}
              title={ev.title}
              artistName={ev.artist_name ?? undefined}
              venueName={ev.venue_name ?? ""}
              cityName={ev.city_name ?? ""}
              date={ev.date}
              imageUrl={ev.image_url ?? undefined}
              minPrice={ev.min_price ?? undefined}
              sourceCount={ev.source_count}
            />
          ))}
        </div>
      )}
    </div>
  );
}
