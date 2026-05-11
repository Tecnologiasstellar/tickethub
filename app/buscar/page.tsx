import type { Metadata } from "next";
import Link from "next/link";
import { SearchBar } from "@/components/SearchBar";
import { EventCard } from "@/components/EventCard";
import { searchEvents } from "@/lib/queries/search";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q = "" } = await searchParams;
  const title = q
    ? `Resultados para "${q}" — TicketHub.mx`
    : "Buscar eventos — TicketHub.mx";
  return { title, robots: { index: false } };
}

export default async function BuscarPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const trimmed = q.trim();
  const events = trimmed.length >= 2 ? await searchEvents(trimmed) : [];

  return (
    <main className="mx-auto max-w-[var(--container-max)] px-4 py-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <li>
            <Link href="/" className="hover:text-[var(--color-primary)]">
              Inicio
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li className="text-[var(--color-text)]" aria-current="page">
            Buscar
          </li>
        </ol>
      </nav>

      {/* Search input */}
      <div className="mb-8">
        <SearchBar placeholder="Busca artistas, eventos o ciudades…" />
      </div>

      {/* Results header */}
      {trimmed.length >= 2 && (
        <h1 className="font-display mb-6 text-2xl font-bold text-[var(--color-text)]">
          {events.length > 0
            ? `${events.length} resultado${events.length !== 1 ? "s" : ""} para "${trimmed}"`
            : `Sin resultados para "${trimmed}"`}
        </h1>
      )}

      {/* Event grid */}
      {events.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {events.map((ev) => (
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

      {/* Empty state */}
      {trimmed.length >= 2 && events.length === 0 && (
        <div className="py-16 text-center text-[var(--color-text-muted)]">
          <p className="text-lg">No encontramos eventos para &ldquo;{trimmed}&rdquo;.</p>
          <p className="mt-2 text-sm">Intenta con otro artista, ciudad o venue.</p>
        </div>
      )}

      {/* Prompt when no query */}
      {trimmed.length < 2 && (
        <p className="text-center text-[var(--color-text-muted)]">
          Escribe al menos 2 caracteres para buscar.
        </p>
      )}
    </main>
  );
}
