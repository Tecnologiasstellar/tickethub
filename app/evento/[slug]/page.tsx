import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EventHero } from "@/components/EventHero";
import { PriceComparisonTable } from "@/components/PriceComparisonTable";
import { StickyMobileCTA } from "@/components/StickyMobileCTA";
import { SetlistPreview } from "@/components/SetlistPreview";
import { TourHistoryTimeline } from "@/components/TourHistoryTimeline";
import { FaqAccordion } from "@/components/FaqAccordion";
import { DataPill } from "@/components/ui/DataPill";
import { formatDateTime } from "@/lib/utils/format";
import {
  getEventBySlug,
  getEventSources,
  getArtistOtherDates,
} from "@/lib/queries/evento";
import { getArtistSetlists } from "@/lib/queries/artista";
import { getAllPublishedEventSlugs } from "@/lib/queries/tier2";
import {
  buildEventSchema,
  buildFaqSchema,
  buildBreadcrumbSchema,
} from "@/lib/seo/jsonld";
import { buildEventFaqs } from "@/lib/seo/faq";
import type { SourcePlatform } from "@/lib/types";

export const revalidate = 1800;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  if (!process.env.DATABASE_URL) return [];
  const events = await getAllPublishedEventSlugs();
  return events.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return { title: "Evento no encontrado" };

  const title = event.seo_title ?? `${event.title} — Boletos y Precios`;
  const description =
    event.seo_description ??
    `Compara precios de boletos para ${event.title} en ${event.venue_name ?? ""}, ${event.city_name ?? "México"}. Encuentra el mejor precio entre todas las plataformas.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: event.image_url ? [{ url: event.image_url }] : [],
    },
    alternates: { canonical: `/evento/${slug}` },
  };
}

export default async function EventoPage({ params }: Props) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const isTier2 = event.tier === "tier2";

  const [sources, otherDates, setlists] = await Promise.all([
    getEventSources(event.id),
    event.artist_id
      ? getArtistOtherDates(event.artist_id, slug)
      : Promise.resolve([]),
    event.artist_id
      ? getArtistSetlists(event.artist_id, 1)
      : Promise.resolve([]),
  ]);

  const availablePrices = sources
    .filter((s) => !s.is_sold_out && s.min_price != null)
    .map((s) => s.min_price as number);
  const bestPrice =
    availablePrices.length > 0 ? Math.min(...availablePrices) : undefined;

  const faqs = buildEventFaqs({
    title: event.title,
    artistName: event.artist_name,
    date: event.date,
    venueName: event.venue_name,
    cityName: event.city_name,
    minPrice: bestPrice,
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tickethub.mx";

  const eventSchema = buildEventSchema(
    {
      slug: event.slug,
      title: event.title,
      date: event.date,
      venueName: event.venue_name ?? "",
      venueAddress: event.venue_address,
      venueLat: event.venue_lat,
      venueLng: event.venue_lng,
      cityName: event.city_name ?? "",
      artistName: event.artist_name,
      imageUrl: event.image_url,
      minPrice: bestPrice,
      eventStatus: event.status,
    },
    siteUrl,
  );
  const faqSchema = buildFaqSchema(faqs);
  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: "Inicio", href: "/" },
      {
        name: event.city_name ?? "México",
        href: event.city_slug ? `/ciudad/${event.city_slug}` : "/",
      },
      { name: event.title, href: `/evento/${slug}` },
    ],
    siteUrl,
  );

  const priceRows = sources.map((s) => ({
    id: s.id,
    platform: s.platform as SourcePlatform,
    url: s.affiliate_url ?? s.url,
    isResale: s.is_resale,
    isSoldOut: s.is_sold_out,
    minPrice: s.min_price ?? undefined,
    maxPrice: s.max_price ?? undefined,
    currency: s.currency ?? "MXN",
    updatedAt: s.snapped_at ? new Date(s.snapped_at) : undefined,
  }));

  const latestSetlist = setlists[0];
  const setlistTracks =
    latestSetlist?.songs?.map(
      (s: { name: string; position?: number }, i: number) => ({
        position: s.position ?? i + 1,
        title: s.name,
      }),
    ) ?? [];

  const tourStops = otherDates.map((d) => ({
    id: d.id,
    date: d.date,
    venueName: d.venue_name ?? "Por confirmar",
    cityName: d.city_name ?? "",
    upcoming: true,
    href: `/evento/${d.slug}`,
  }));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

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
            {event.city_slug && (
              <>
                <li>
                  <a
                    href={`/ciudad/${event.city_slug}`}
                    className="hover:text-[var(--color-primary)]"
                  >
                    {event.city_name}
                  </a>
                </li>
                <li aria-hidden>›</li>
              </>
            )}
            <li aria-current="page" className="truncate text-[var(--color-text)]">
              {event.title}
            </li>
          </ol>
        </nav>

        {/* Hero — compact for tier2 */}
        <EventHero
          variant={event.tier as "tier1" | "tier2"}
          title={event.title}
          artistName={event.artist_name ?? undefined}
          venueName={event.venue_name ?? ""}
          cityName={event.city_name ?? ""}
          date={event.date}
          imageUrl={event.image_url ?? undefined}
          minPrice={bestPrice}
          primaryCtaHref="#precios"
          className="mb-6"
        />

        {/* Price comparison */}
        {priceRows.length > 0 && (
          <section id="precios" aria-labelledby="precios-heading" className="mb-8">
            <h2
              id="precios-heading"
              className="font-display mb-3 text-xl font-bold text-[var(--color-text)]"
            >
              Compara precios
            </h2>
            <PriceComparisonTable rows={priceRows} />
          </section>
        )}

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          {/* Main column */}
          <div className="space-y-8">
            {(event.context_text || event.description_es) && (
              <section aria-labelledby="context-heading">
                <h2
                  id="context-heading"
                  className="font-display mb-3 text-xl font-bold text-[var(--color-text)]"
                >
                  Sobre el evento
                </h2>
                <p className="leading-[var(--leading-relaxed)] text-[var(--color-text-muted)]">
                  {event.context_text ?? event.description_es}
                </p>
              </section>
            )}

            {/* Setlist — tier1 only, only if data exists */}
            {!isTier2 && setlistTracks.length > 0 && (
              <section aria-labelledby="setlist-heading">
                <h2
                  id="setlist-heading"
                  className="font-display mb-3 text-xl font-bold text-[var(--color-text)]"
                >
                  Probable setlist
                </h2>
                <SetlistPreview
                  tracks={setlistTracks}
                  sourceLabel="Setlist.fm"
                  sourceUrl={latestSetlist.source_url ?? undefined}
                />
              </section>
            )}

            <FaqAccordion faqs={faqs} />
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            <section aria-labelledby="details-heading">
              <h2
                id="details-heading"
                className="font-display mb-3 text-lg font-bold text-[var(--color-text)]"
              >
                Detalles
              </h2>
              <div className="space-y-3">
                <DataPill label="Fecha" value={formatDateTime(event.date)} />
                {event.venue_name && (
                  <DataPill
                    label="Venue"
                    value={
                      event.venue_slug ? (
                        <a
                          href={`/venue/${event.venue_slug}`}
                          className="hover:text-[var(--color-primary)]"
                        >
                          {event.venue_name}
                        </a>
                      ) : (
                        event.venue_name
                      )
                    }
                    hint={event.venue_address ?? undefined}
                  />
                )}
                {event.city_name && (
                  <DataPill
                    label="Ciudad"
                    value={
                      event.city_slug ? (
                        <a
                          href={`/ciudad/${event.city_slug}`}
                          className="hover:text-[var(--color-primary)]"
                        >
                          {event.city_name}
                        </a>
                      ) : (
                        event.city_name
                      )
                    }
                  />
                )}
              </div>
            </section>

            {/* Tour history — tier1 only, only if data exists */}
            {!isTier2 && tourStops.length > 0 && (
              <section aria-labelledby="other-dates-heading">
                <h2
                  id="other-dates-heading"
                  className="font-display mb-3 text-lg font-bold text-[var(--color-text)]"
                >
                  Otras fechas
                </h2>
                <TourHistoryTimeline title="" stops={tourStops} />
              </section>
            )}
          </aside>
        </div>
      </main>

      {priceRows.length > 0 && (
        <StickyMobileCTA
          href="#precios"
          label="Ver precios"
          minPrice={bestPrice}
          caption="Desde"
        />
      )}
    </>
  );
}
