import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { EventCard } from "@/components/EventCard";
import { SetlistPreview } from "@/components/SetlistPreview";
import { TourHistoryTimeline } from "@/components/TourHistoryTimeline";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils/format";
import {
  getArtistBySlug,
  getArtistUpcomingEvents,
  getArtistSetlists,
  getSimilarArtists,
} from "@/lib/queries/artista";
import { getPublishedArtistSlugs } from "@/lib/queries/tier2";
import { buildMusicGroupSchema, buildBreadcrumbSchema } from "@/lib/seo/jsonld";

export const revalidate = 3600;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const slugs = await getPublishedArtistSlugs();
  return slugs.map(row => ({ slug: row.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtistBySlug(slug);
  if (!artist || artist.content_status !== "published") {
    return { title: "Artista no encontrado" };
  }

  const title = `${artist.name} en México — Fechas y boletos`;
  const description =
    artist.bio_es ??
    `Próximas fechas de ${artist.name} en México. Compara precios de boletos en todas las plataformas.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: artist.image_url ? [{ url: artist.image_url }] : [],
    },
    alternates: { canonical: `/artista/${slug}` },
  };
}

export default async function ArtistaPage({ params }: Props) {
  const { slug } = await params;
  const artist = await getArtistBySlug(slug);
  if (!artist || artist.content_status !== "published") notFound();

  const [upcomingEvents, setlists, similarArtists] = await Promise.all([
    getArtistUpcomingEvents(artist.id),
    getArtistSetlists(artist.id, 3),
    getSimilarArtists(artist.id, artist.genres ?? [], 6),
  ]);
  if (upcomingEvents.length === 0) notFound();

  const tourStops = [
    ...upcomingEvents.map(e => ({
      id: e.id,
      date: e.date,
      venueName: e.venue_name ?? "Por confirmar",
      cityName: e.city_name ?? "",
      upcoming: true,
      href: `/evento/${e.slug}`,
    })),
    ...setlists.map(s => ({
      id: s.id,
      date: s.event_date ?? "",
      venueName: s.venue_name ?? "Venue",
      cityName: `${s.city_name ?? ""}${s.country ? `, ${s.country}` : ""}`,
      upcoming: false,
    })),
  ].filter(s => s.date);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tickethub.mx";

  const artistSchema = buildMusicGroupSchema(
    {
      name: artist.name,
      slug: artist.slug,
      imageUrl: artist.image_url,
      genres: artist.genres,
    },
    siteUrl,
  );
  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: "Inicio", href: "/" },
      { name: artist.name, href: `/artista/${slug}` },
    ],
    siteUrl,
  );

  const latestSetlist = setlists[0];
  const setlistTracks =
    latestSetlist?.songs?.map(
      (s: { name: string; position?: number }, i: number) => ({
        position: s.position ?? i + 1,
        title: s.name,
      }),
    ) ?? [];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(artistSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="mx-auto max-w-[var(--container-max)] px-4 py-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <li>
              <Link href="/" className="hover:text-[var(--color-primary)]">Inicio</Link>
            </li>
            <li aria-hidden>›</li>
            <li aria-current="page" className="text-[var(--color-text)]">
              {artist.name}
            </li>
          </ol>
        </nav>

        {/* Artist header */}
        <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-start">
          {artist.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={artist.image_url}
              alt={artist.name}
              className="h-36 w-36 shrink-0 rounded-full object-cover ring-2 ring-[var(--color-border)]"
            />
          ) : (
            <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-2)] ring-2 ring-[var(--color-border)]">
              <span className="font-display text-4xl font-bold text-[var(--color-primary)]">
                {artist.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-display text-4xl font-bold text-[var(--color-text)] md:text-5xl">
              {artist.name}
            </h1>
            {artist.genres?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {artist.genres.map(g => (
                  <Badge key={g} tone="primary" variant="soft">
                    {g}
                  </Badge>
                ))}
              </div>
            ) : null}
            {artist.popularity != null && (
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                Popularidad:{" "}
                <span className="font-semibold text-[var(--color-text)]">
                  {artist.popularity}/100
                </span>
              </p>
            )}
            {artist.bio_es && (
              <p className="mt-4 max-w-prose leading-[var(--leading-relaxed)] text-[var(--color-text-muted)]">
                {artist.bio_es}
              </p>
            )}
          </div>
        </header>

        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          {/* Main column */}
          <div className="space-y-10">
            {upcomingEvents.length > 0 && (
              <section aria-labelledby="upcoming-heading">
                <h2
                  id="upcoming-heading"
                  className="font-display mb-5 text-2xl font-bold text-[var(--color-text)]"
                >
                  Próximas fechas en México
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {upcomingEvents.map(ev => (
                    <EventCard
                      key={ev.id}
                      href={`/evento/${ev.slug}`}
                      title={ev.title}
                      venueName={ev.venue_name ?? ""}
                      cityName={ev.city_name ?? ""}
                      date={ev.date}
                      minPrice={ev.min_price ?? undefined}
                      sourceCount={ev.source_count}
                    />
                  ))}
                </div>
              </section>
            )}

            {setlistTracks.length > 0 && (
              <section aria-labelledby="setlist-heading">
                <h2
                  id="setlist-heading"
                  className="font-display mb-4 text-2xl font-bold text-[var(--color-text)]"
                >
                  Setlist reciente
                </h2>
                <SetlistPreview
                  title={
                    latestSetlist.event_date
                      ? `Setlist del ${formatDate(latestSetlist.event_date)}`
                      : "Setlist reciente"
                  }
                  tracks={setlistTracks}
                  sourceLabel="Setlist.fm"
                  sourceUrl={latestSetlist.source_url ?? undefined}
                />
              </section>
            )}

            {similarArtists.length > 0 && (
              <section aria-labelledby="similar-heading">
                <h2
                  id="similar-heading"
                  className="font-display mb-4 text-2xl font-bold text-[var(--color-text)]"
                >
                  Artistas similares
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {similarArtists.map(a => (
                    <a
                      key={a.id}
                      href={`/artista/${a.slug}`}
                      className="group flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-2)]"
                    >
                      {a.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={a.image_url}
                          alt={a.name}
                          className="h-12 w-12 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-2)]">
                          <span className="font-display text-xl font-bold text-[var(--color-primary)]">
                            {a.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)]">
                          {a.name}
                        </p>
                        {a.upcoming_count > 0 && (
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {a.upcoming_count} fecha{a.upcoming_count !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar — tour history */}
          {tourStops.length > 0 && (
            <aside>
              <TourHistoryTimeline
                title="Tour history"
                stops={tourStops}
                maxVisible={10}
              />
            </aside>
          )}
        </div>
      </div>
    </>
  );
}
