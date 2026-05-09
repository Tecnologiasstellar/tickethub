const SYSTEM_NO_INVENT =
  "Eres un redactor SEO para TicketHub.mx. " +
  "REGLA CRÍTICA: Solo usa los datos proporcionados. " +
  "No inventes información que no esté en los datos. " +
  "Responde ÚNICAMENTE en el formato JSON especificado.";

export interface EventPromptData {
  title: string;
  date: string; // ISO string
  artistName: string | null;
  artistGenres: string[] | null;
  venueName: string | null;
  venueAddress: string | null;
  venueCapacity: number | null;
  cityName: string | null;
  minPrice: number | null;
  currency: string;
}

export interface ArtistPromptData {
  name: string;
  genres: string[] | null;
  popularity: number | null;
}

export interface VenuePromptData {
  name: string;
  cityName: string | null;
  address: string | null;
  capacity: number | null;
}

export function buildEventMessages(data: EventPromptData) {
  const dateStr = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  }).format(new Date(data.date));

  const priceStr =
    data.minPrice != null
      ? `Precio mínimo: ${new Intl.NumberFormat("es-MX", {
          style: "currency",
          currency: data.currency || "MXN",
          maximumFractionDigits: 0,
        }).format(data.minPrice)}`
      : "Precio: no disponible";

  const dataBlock = [
    `Título: ${data.title}`,
    `Fecha: ${dateStr}`,
    data.artistName ? `Artista: ${data.artistName}` : null,
    data.artistGenres?.length
      ? `Géneros: ${data.artistGenres.join(", ")}`
      : null,
    data.venueName ? `Venue: ${data.venueName}` : null,
    data.venueAddress ? `Dirección: ${data.venueAddress}` : null,
    data.venueCapacity ? `Capacidad: ${data.venueCapacity} personas` : null,
    data.cityName ? `Ciudad: ${data.cityName}` : null,
    priceStr,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    { role: "system" as const, content: SYSTEM_NO_INVENT },
    {
      role: "user" as const,
      content:
        `Genera contenido SEO para este evento de TicketHub.mx:\n\n${dataBlock}\n\n` +
        "Genera: seo_title (máx 70 chars), seo_description (máx 160 chars), " +
        "h1_title (máx 100 chars), context_text (2-3 oraciones, máx 600 chars), " +
        "faq (entre 2 y 5 preguntas con sus respuestas).",
    },
  ];
}

export function buildArtistMessages(data: ArtistPromptData) {
  const dataBlock = [
    `Artista: ${data.name}`,
    data.genres?.length ? `Géneros: ${data.genres.join(", ")}` : null,
    data.popularity != null ? `Popularidad Spotify: ${data.popularity}/100` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    { role: "system" as const, content: SYSTEM_NO_INVENT },
    {
      role: "user" as const,
      content:
        `Escribe una bio en español para el artista musical, máx 800 caracteres:\n\n${dataBlock}\n\n` +
        "Genera: bio_es (descripción del artista en español, objetiva, sin inventar logros ni premios).",
    },
  ];
}

export function buildVenueMessages(data: VenuePromptData) {
  const dataBlock = [
    `Venue: ${data.name}`,
    data.cityName ? `Ciudad: ${data.cityName}` : null,
    data.address ? `Dirección: ${data.address}` : null,
    data.capacity ? `Capacidad: ${data.capacity} personas` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    { role: "system" as const, content: SYSTEM_NO_INVENT },
    {
      role: "user" as const,
      content:
        `Escribe una descripción del venue para TicketHub.mx, máx 400 caracteres:\n\n${dataBlock}\n\n` +
        "Genera: description_es (descripción del recinto, objetiva, solo los datos disponibles).",
    },
  ];
}
