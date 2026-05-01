import slugify from "slugify";

function toSlug(g: string) {
  return slugify(g, { lower: true, strict: true, locale: "es" });
}

const GENRE_DISPLAY: Record<string, string> = {
  "rock en espanol":   "Rock en español",
  "rock alternativo":  "Rock alternativo",
  "reggaeton":         "Reggaetón",
  "latin trap":        "Latin trap",
  "pop latino":        "Pop latino",
  "pop rock":          "Pop rock",
  "balada":            "Balada",
  "indie pop":         "Indie pop",
  "alternativo":       "Alternativo",
  "rap rock":          "Rap rock",
  "pop alternativo":   "Pop alternativo",
  "indie":             "Indie",
};

export function GenreChips({ genres }: { genres: string[] }) {
  if (!genres.length) return null;
  return (
    <nav aria-label="Géneros" className="flex flex-wrap gap-2">
      {genres.map(genre => (
        <a
          key={genre}
          href={`/genero/${toSlug(genre)}`}
          className="rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-1.5 text-sm text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
        >
          {GENRE_DISPLAY[genre] ?? genre}
        </a>
      ))}
    </nav>
  );
}
