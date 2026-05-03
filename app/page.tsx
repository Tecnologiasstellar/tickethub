import type { Metadata } from "next";
import { EventCard } from "@/components/EventCard";
import { SearchBar } from "@/components/SearchBar";
import { GenreChips } from "@/components/GenreChips";
import { CityCard } from "@/components/CityCard";
import { getTier1UpcomingEvents, getThisWeekEvents, getTier1Cities, getTopGenres } from "@/lib/queries/home";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "TicketHub.mx — Compara boletos para conciertos en México",
  description: "Compara precios de boletos en Boletia, Eventbrite, Superboletos, StubHub y más. Encuentra el mejor precio para conciertos y festivales en México.",
};

export default async function HomePage() {
  const [tier1Events, thisWeekEvents, cities, genres] = await Promise.all([
    getTier1UpcomingEvents(8), getThisWeekEvents(6), getTier1Cities(), getTopGenres(12),
  ]);

  return (
    <main>
      <section className="border-b border-[var(--color-border)] bg-gradient-to-b from-[var(--color-surface)] to-[var(--color-background)] py-16 md:py-24">
        <div className="mx-auto max-w-[var(--container-max)] px-4 text-center">
          <h1 className="font-display text-4xl font-bold leading-[var(--leading-tight)] text-[var(--color-text)] md:text-6xl">
            Compara boletos en <span className="text-[var(--color-primary)]">un solo lugar</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-[var(--color-text-muted)] md:text-xl">
            Conciertos, festivales y eventos en México. Encuentra el precio más bajo entre Boletia, Eventbrite, Superboletos y más.
          </p>
          <div className="mt-8 flex justify-center"><SearchBar /></div>
        </div>
      </section>

      {tier1Events.length > 0 && (
        <section aria-labelledby="tier1-title" className="mx-auto max-w-[var(--container-max)] px-4 py-12">
          <h2 id="tier1-title" className="font-display mb-6 text-2xl font-bold text-[var(--color-text)]">Próximos eventos destacados</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {tier1Events.map(ev => (
              <EventCard key={ev.id} href={`/evento/${ev.slug}`} title={ev.title}
                artistName={ev.artist_name ?? undefined} venueName={ev.venue_name ?? ""}
                cityName={ev.city_name ?? ""} date={ev.date} imageUrl={ev.image_url ?? undefined}
                minPrice={ev.min_price ?? undefined} sourceCount={ev.source_count} />
            ))}
          </div>
        </section>
      )}

      {thisWeekEvents.length > 0 && (
        <section aria-labelledby="week-title" className="border-t border-[var(--color-border-subtle)] bg-[var(--color-surface)] py-12">
          <div className="mx-auto max-w-[var(--container-max)] px-4">
            <h2 id="week-title" className="font-display mb-6 text-2xl font-bold text-[var(--color-text)]">Esta semana</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {thisWeekEvents.map(ev => (
                <EventCard key={ev.id} href={`/evento/${ev.slug}`} title={ev.title}
                  artistName={ev.artist_name ?? undefined} venueName={ev.venue_name ?? ""}
                  cityName={ev.city_name ?? ""} date={ev.date} imageUrl={ev.image_url ?? undefined}
                  minPrice={ev.min_price ?? undefined} sourceCount={ev.source_count} />
              ))}
            </div>
          </div>
        </section>
      )}

      {cities.length > 0 && (
        <section aria-labelledby="cities-title" className="mx-auto max-w-[var(--container-max)] px-4 py-12">
          <h2 id="cities-title" className="font-display mb-6 text-2xl font-bold text-[var(--color-text)]">Ciudades principales</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map(city => <CityCard key={city.id} name={city.name} slug={city.slug} eventCount={city.event_count} />)}
          </div>
        </section>
      )}

      {genres.length > 0 && (
        <section aria-labelledby="genres-title" className="border-t border-[var(--color-border-subtle)] bg-[var(--color-surface)] py-10">
          <div className="mx-auto max-w-[var(--container-max)] px-4">
            <h2 id="genres-title" className="font-display mb-4 text-xl font-bold text-[var(--color-text)]">Explorar por género</h2>
            <GenreChips genres={genres} />
          </div>
        </section>
      )}
    </main>
  );
}
