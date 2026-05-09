import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { EventCard } from "@/components/EventCard";
import { getCityBySlug } from "@/lib/queries/ciudad";
import {
  getCityMonthEvents,
  getAllCityMonthCombos,
} from "@/lib/queries/tier2";
import { buildBreadcrumbSchema } from "@/lib/seo/jsonld";

export const revalidate = 1800;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string; mes: string }> };

function parseMes(mes: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;

  return { year, month };
}

function mesLabel(mes: string): string {
  const parsed = parseMes(mes);
  if (!parsed) return mes;

  return new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: "numeric",
  }).format(new Date(parsed.year, parsed.month - 1, 1));
}

export async function generateStaticParams() {
  const combos = await getAllCityMonthCombos();
  return combos.map((combo) => ({ slug: combo.citySlug, mes: combo.mes }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, mes } = await params;
  if (!parseMes(mes)) return { title: "Eventos no encontrados" };

  const city = await getCityBySlug(slug);
  if (!city) return { title: "Ciudad no encontrada" };

  const label = mesLabel(mes);
  const title = `Eventos en ${city.name} - ${label}`;
  const description = `Conciertos y eventos publicados en ${city.name} durante ${label}. Compara precios y encuentra boletos disponibles.`;

  return {
    title,
    description,
    alternates: { canonical: `/ciudad/${slug}/${mes}` },
  };
}

export default async function CiudadMesPage({ params }: Props) {
  const { slug, mes } = await params;
  if (!parseMes(mes)) notFound();

  const [city, events] = await Promise.all([
    getCityBySlug(slug),
    getCityMonthEvents(slug, mes),
  ]);

  if (!city || events.length === 0) notFound();

  const label = mesLabel(mes);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tickethub.mx";
  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: "Inicio", href: "/" },
      { name: city.name, href: `/ciudad/${slug}` },
      { name: label, href: `/ciudad/${slug}/${mes}` },
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
            <li>
              <Link
                href={`/ciudad/${slug}`}
                className="hover:text-[var(--color-primary)]"
              >
                {city.name}
              </Link>
            </li>
            <li aria-hidden>›</li>
            <li aria-current="page" className="text-[var(--color-text)]">
              {label}
            </li>
          </ol>
        </nav>

        <header className="mb-8">
          <h1 className="font-display text-3xl font-bold text-[var(--color-text)] md:text-4xl">
            Eventos en {city.name} en {label}
          </h1>
          <p className="mt-3 text-[var(--color-text-muted)]">
            {events.length} evento{events.length !== 1 ? "s" : ""} con boletos
            disponibles o publicados.
          </p>
        </header>

        <section aria-labelledby="city-month-events-heading">
          <h2
            id="city-month-events-heading"
            className="font-display mb-5 text-2xl font-bold text-[var(--color-text)]"
          >
            Cartelera del mes
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard
                key={event.id}
                href={`/evento/${event.slug}`}
                title={event.title}
                artistName={event.artist_name ?? undefined}
                venueName={event.venue_name ?? ""}
                cityName={event.city_name ?? city.name}
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
