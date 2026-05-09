import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EventCard } from "@/components/EventCard";
import { getCityBySlug } from "@/lib/queries/ciudad";
import { getAllCityMonthCombos, getCityMonthEvents } from "@/lib/queries/tier2";

export const revalidate = 1800;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string; mes: string }> };

function mesLabel(mes: string): string {
  const [year, month] = mes.split("-");
  return new Date(Number(year), Number(month) - 1).toLocaleString("es-MX", {
    month: "long",
    year: "numeric",
  });
}

export async function generateStaticParams() {
  if (!process.env.DATABASE_URL) return [];
  const combos = await getAllCityMonthCombos();
  return combos.map((c) => ({ slug: c.citySlug, mes: c.mes }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, mes } = await params;
  const city = await getCityBySlug(slug);
  if (!city) return {};

  const title = `Eventos en ${city.name} — ${mesLabel(mes)}`;
  const description = `Todos los conciertos y eventos en ${city.name} para ${mesLabel(mes)}. Compara precios y encuentra los mejores boletos.`;

  return {
    title,
    description,
    alternates: { canonical: `/ciudad/${slug}/mes/${mes}` },
  };
}

export default async function CiudadMesPage({ params }: Props) {
  const { slug, mes } = await params;

  // Validate mes format
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    notFound();
  }

  const [city, events] = await Promise.all([
    getCityBySlug(slug),
    getCityMonthEvents(slug, mes),
  ]);

  if (!city) notFound();

  const label = mesLabel(mes);

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
          <li>
            <a
              href={`/ciudad/${slug}`}
              className="hover:text-[var(--color-primary)]"
            >
              {city.name}
            </a>
          </li>
          <li aria-hidden>›</li>
          <li className="text-[var(--color-text)]" aria-current="page">
            {label}
          </li>
        </ol>
      </nav>

      {/* Header */}
      <section className="mb-8">
        <h1 className="font-display text-3xl font-bold text-[var(--color-text)] mb-2">
          Eventos en {city.name} — {label}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {events.length} evento{events.length !== 1 ? "s" : ""}
        </p>
      </section>

      {/* Events */}
      {events.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">
          No hay eventos para este mes en {city.name}.
        </p>
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
    </main>
  );
}
