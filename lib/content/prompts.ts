// lib/content/prompts.ts

export const SYSTEM_PROMPT = `
You are a Mexican concert content writer. You produce JSON content for a live-event
aggregator website (tickethub.mx). Write exclusively in Mexican Spanish.

Rules you MUST follow:
- Only use facts present in the data provided. NEVER invent dates, prices, venue
  names, setlists, or any other detail not given to you.
- If a field is missing or null, acknowledge the gap naturally — do not fill it
  with generic filler.
- Keep all text concise and useful for fans searching for concert information.
- Return ONLY valid JSON that matches the requested schema. No prose outside the JSON.
`.trim();

// ─── Event ────────────────────────────────────────────────────────────────────

export interface EventData {
  title: string;
  artistName: string;
  venueName: string;
  cityName: string;
  dateIso: string;            // YYYY-MM-DD
  genres: string[] | null;
  minPrice: number | null;
  maxPrice: number | null;
  currency: string | null;
}

export function buildEventPrompt(d: EventData): string {
  const price =
    d.minPrice != null
      ? `Precio desde ${d.minPrice} ${d.currency ?? "MXN"}` +
        (d.maxPrice != null ? ` hasta ${d.maxPrice} ${d.currency ?? "MXN"}` : "")
      : "Precio no disponible";

  const genres =
    d.genres && d.genres.length > 0
      ? `Géneros: ${d.genres.join(", ")}`
      : "Género musical desconocido";

  return `
Genera contenido para este evento de concierto. Devuelve JSON con exactamente estos campos:
{
  "seo_title": string,       // max 60 chars, incluye artista + ciudad + año
  "seo_description": string, // max 160 chars, 1 oración persuasiva con datos reales
  "h1_title": string,        // max 100 chars, variación natural del seo_title para H1
  "context_text": string,    // 80–300 chars, párrafo de contexto para fans
  "faq": [                   // 3 preguntas frecuentes del fan, respondidas con los datos disponibles
    { "question": string, "answer": string },
    { "question": string, "answer": string },
    { "question": string, "answer": string }
  ]
}

Datos del evento:
- Título: ${d.title}
- Artista: ${d.artistName}
- ${genres}
- Fecha: ${d.dateIso}
- Recinto: ${d.venueName}
- Ciudad: ${d.cityName}
- ${price}
`.trim();
}

// ─── Artist ───────────────────────────────────────────────────────────────────

export interface ArtistData {
  name: string;
  genres: string[] | null;
  popularity: number | null;
  upcomingEventCount: number;
}

export function buildArtistPrompt(d: ArtistData): string {
  const genres =
    d.genres && d.genres.length > 0
      ? `Géneros: ${d.genres.join(", ")}`
      : "Género musical no especificado";

  const popularity =
    d.popularity != null
      ? `Popularidad en Spotify: ${d.popularity}/100`
      : "Popularidad no disponible";

  return `
Genera una biografía corta del artista en español mexicano. Devuelve JSON:
{
  "bio_es": string  // 80–300 chars, 2-3 oraciones. Solo datos reales, sin inventar.
}

Datos del artista:
- Nombre: ${d.name}
- ${genres}
- ${popularity}
- Conciertos próximos en México: ${d.upcomingEventCount}
`.trim();
}

// ─── Venue ────────────────────────────────────────────────────────────────────

export interface VenueData {
  name: string;
  cityName: string | null;
  capacity: number | null;
  address: string | null;
}

export function buildVenuePrompt(d: VenueData): string {
  const capacity =
    d.capacity != null ? `Capacidad: ${d.capacity} personas` : "Capacidad desconocida";
  const address = d.address ?? "Dirección no disponible";
  const city = d.cityName ?? "Ciudad desconocida";

  return `
Genera una descripción corta del recinto en español mexicano. Devuelve JSON:
{
  "description_es": string  // 50–200 chars, 1-2 oraciones. Solo datos reales.
}

Datos del recinto:
- Nombre: ${d.name}
- Ciudad: ${city}
- Dirección: ${address}
- ${capacity}
`.trim();
}
