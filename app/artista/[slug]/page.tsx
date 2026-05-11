import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EventCard } from "@/components/EventCard";
import { SetlistPreview } from "@/components/SetlistPreview";
import { Badge } from "@/components/ui/Badge";
import { DataPill } from "@/components/ui/DataPill";
import {
  getArtistBySlug,
  getArtistUpcomingEvents,
  getArtistSetlists,
  getSimilarArtists,
} from "@/lib/queries/artista";
import { getAllPublishedArtistSlugs } from "@/lib/queries/tier2";
import {
  buildMusicGroupSchema,
  buildBreadcrumbSchema,
} from "@/lib/seo/jsonld";

export const revalidate = 1800;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  if (!process.env.DATABASE_URL) return [];
  const artists = await getAllPublishedArtistSlugs();
  return artists.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtistBySlug(slug);
  if (!artist) return { title: "Artista no encontrado" };

  const title = `${artist.name} — Conciertos y Boletos`;
  const description = `Conciertos de ${artist.name} en México. Compara precios de boletos y encuentra las mejores ofertas.`;

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
  if (!artist) notFound();

  const [upcomingEvents, setlists, similarArtists] = await Promise.all([
    getArtistUpcomingEvents(artist.id),
    getArtistSetlists(artist.id, 5),
    getSimilarArtists(artist.id, artist.genres ?? [], 6),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tickethub.mx";

  const musicGroupSchema = buildMusicGroupSchema(
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(musicGroupSchema) }}
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
            <li
              className="text-[var(--color-text)]"
              aria-current="page"
            >
              {artist.name}
            </li>
          </ol>
        </nav>

        {/* Artist Header */}
        <section className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
          {artist.image_url && (
            <img
              src={artist.image_url}
              alt={artist.name}
              width={120}
              height={120}
              className="h-28 w-28 shrink-0 rounded-full object-cover border border-[var(--color-border)]"
            />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-3xl font-bold text-[var(--color-text)] mb-2">
              {artist.name}
            </h1>

            {artist.genres && artist.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {artist.genres.map((genre) => (
                  <Badge key={genre} tone="primary" variant="soft">
                    {genre}
                  </Badge>
                ))}
              </div>
            )}

            {artist.bio_es && (
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4 max-w-2xl">
                {artist.bio_es}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <DataPill
                label="Próximos conciertos"
                value={upcomingEvents.length}
                compact
              />
            </div>
          </div>
        </section>

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <section className="mb-8">
            <h2 className="font-display text-xl font-bold text-[var(--color-text)] mb-3">
              Próximos conciertos
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingEvents.map((event) => (
                <EventCard
                  key={event.id}
                  href={`/evento/${event.slug}`}
                  title={event.title}
                  artistName={artist.name}
                  venueName={event.venue_name ?? "Por confirmar"}
                  cityName={event.city_name ?? "México"}
                  date={event.date}
                  minPrice={event.min_price ?? undefined}
                  currency="MXN"
                  sourceCount={event.source_count}
                />
              ))}
            </div>
          </section>
        )}

        {/* Setlist Section */}
        {setlists.length > 0 && latestSetlist && (
          <section className="mb-8">
            <h2 className="font-display text-xl font-bold text-[var(--color-text)] mb-3">
              Setlist reciente
            </h2>
            {latestSetlist.venue_name && (
              <p className="text-sm text-[var(--color-text-muted)] mb-3">
                {latestSetlist.venue_name}
                {latestSetlist.city_name ? `, ${latestSetlist.city_name}` : ""}
                {latestSetlist.event_date
                  ? ` — ${new Date(latestSetlist.event_date).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })}`
                  : ""}
              </p>
            )}
            <SetlistPreview
              tracks={setlistTracks}
              sourceLabel={latestSetlist.source_url ? "setlist.fm" : undefined}
              sourceUrl={latestSetlist.source_url ?? undefined}
            />
          </section>
        )}

        {/* Similar Artists */}
        {similarArtists.length > 0 && (
          <section className="mb-8">
            <h2 className="font-display text-xl font-bold text-[var(--color-text)] mb-3">
              Artistas similares
            </h2>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              {similarArtists.map((similar) => (
                <a
                  key={similar.id}
                  href={`/artista/${similar.slug}`}
                  className="group flex flex-col items-center gap-2 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center hover:border-[var(--color-primary)] transition-colors"
                >
                  {similar.image_url ? (
                    <img
                      src={similar.image_url}
                      alt={similar.name}
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-2xl font-display font-bold text-[var(--color-text-muted)]">
                      {similar.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 w-full">
                    <p className="font-medium text-sm text-[var(--color-text)] truncate group-hover:text-[var(--color-primary)]">
                      {similar.name}
                    </p>
                    {similar.upcoming_count > 0 && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        {similar.upcoming_count} concierto{similar.upcoming_count !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
