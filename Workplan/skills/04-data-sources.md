# Data Source Integrator

## Cuándo usarla

Usa esta skill al integrar Eventbrite, Songkick, Setlist.fm, Spotify, StubHub, Ticketmaster o fuentes scrapeadas.

## Objetivo

Convertir datos externos desordenados en eventos normalizados y confiables.

## Contrato NormalizedEvent

Debe incluir cuando sea posible:

- `title`
- `slug`
- `artist_name`
- `venue_name`
- `city_name`
- `event_date`
- `image_url`
- `source`
- `source_event_id`
- `source_url`
- `price_min`
- `price_max`
- `currency`
- `availability`
- `is_resale`

## Reglas

- Cada fuente tiene cliente propio en `lib/api` o `lib/scrapers`.
- Cada fuente tiene normalizador propio.
- Retries con exponential backoff en 429 y 5xx.
- Rate limits explícitos.
- Logs agregados por fuente.
- Si una fuente no trae artista confiable, se permite `artist_name = null` y el pipeline decide si se omite.

## Validación

- Scripts dry-run por fuente.
- Mostrar conteo de procesados, omitidos, nuevos, merged y errores.

