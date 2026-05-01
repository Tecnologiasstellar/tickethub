"use client";

import { useState, useMemo } from "react";
import { EventCard } from "@/components/EventCard";
import type { CityEvent } from "@/lib/queries/ciudad";

type Period = "all" | "week" | "month" | "3months";

function groupByMonth(events: CityEvent[]): Map<string, CityEvent[]> {
  const map = new Map<string, CityEvent[]>();
  for (const ev of events) {
    const key = new Intl.DateTimeFormat("es-MX", {
      month: "long",
      year: "numeric",
    }).format(new Date(ev.date));
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return map;
}

export function EventsByMonth({
  events,
  genres,
}: {
  events: CityEvent[];
  genres: string[];
}) {
  const [genreFilter, setGenreFilter] = useState("all");
  const [period, setPeriod] = useState<Period>("all");
  const [maxPrice, setMaxPrice] = useState("");

  const filtered = useMemo(() => {
    const now = Date.now();
    let result = events;

    if (genreFilter !== "all") {
      result = result.filter(e => e.artist_genres?.includes(genreFilter));
    }

    if (period === "week") {
      const end = now + 7 * 86_400_000;
      result = result.filter(e => new Date(e.date).getTime() <= end);
    } else if (period === "month") {
      const end = now + 30 * 86_400_000;
      result = result.filter(e => new Date(e.date).getTime() <= end);
    } else if (period === "3months") {
      const end = now + 90 * 86_400_000;
      result = result.filter(e => new Date(e.date).getTime() <= end);
    }

    const mp = Number(maxPrice);
    if (mp > 0) {
      result = result.filter(
        e => e.min_price == null || e.min_price <= mp,
      );
    }

    return result;
  }, [events, genreFilter, period, maxPrice]);

  const byMonth = useMemo(() => Array.from(groupByMonth(filtered).entries()), [filtered]);

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label
            htmlFor="period-filter"
            className="text-sm text-[var(--color-text-muted)]"
          >
            Periodo
          </label>
          <select
            id="period-filter"
            value={period}
            onChange={e => setPeriod(e.target.value as Period)}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-text)]"
          >
            <option value="all">Todos</option>
            <option value="week">Esta semana</option>
            <option value="month">Este mes</option>
            <option value="3months">Próximos 3 meses</option>
          </select>
        </div>

        {genres.length > 0 && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="genre-filter"
              className="text-sm text-[var(--color-text-muted)]"
            >
              Género
            </label>
            <select
              id="genre-filter"
              value={genreFilter}
              onChange={e => setGenreFilter(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-text)]"
            >
              <option value="all">Todos</option>
              {genres.map(g => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <label
            htmlFor="price-filter"
            className="text-sm text-[var(--color-text-muted)]"
          >
            Precio máx.
          </label>
          <select
            id="price-filter"
            value={maxPrice}
            onChange={e => setMaxPrice(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-text)]"
          >
            <option value="">Sin límite</option>
            {[1000, 2000, 3000, 5000].map(p => (
              <option key={p} value={String(p)}>
                Hasta ${p.toLocaleString("es-MX")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {byMonth.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
          No hay eventos con estos filtros.
        </p>
      ) : (
        <div className="space-y-10">
          {byMonth.map(([month, monthEvents]) => (
            <section key={month}>
              <h2 className="font-display mb-4 text-xl font-semibold capitalize text-[var(--color-text)]">
                {month}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {monthEvents.map(ev => (
                  <EventCard
                    key={ev.id}
                    href={`/evento/${ev.slug}`}
                    title={ev.title}
                    artistName={ev.artist_name ?? undefined}
                    venueName={ev.venue_name ?? ""}
                    cityName=""
                    date={ev.date}
                    imageUrl={ev.image_url ?? undefined}
                    minPrice={ev.min_price ?? undefined}
                    sourceCount={ev.source_count}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
