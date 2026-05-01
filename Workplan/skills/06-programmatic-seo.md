# Programmatic SEO Specialist

## Cuándo usarla

Usa esta skill al crear páginas Tier 1, Tier 2, sitemap, metadata, JSON-LD, breadcrumbs y canonical URLs.

## Objetivo

Publicar páginas indexables que sean útiles, únicas y resistentes a updates de Google.

## Reglas

- No publicar páginas sin contenido mínimo útil.
- No indexar entidades sin eventos futuros, salvo páginas hero justificadas.
- Usar templates distintos para:
  - Evento
  - Artista
  - Ciudad
  - Ciudad + mes
  - Venue
  - Género
- Schema correcto:
  - Evento: `MusicEvent` o `Event`.
  - Artista: `MusicGroup`.
  - Venue: `Place`.
  - FAQ: `FAQPage` solo si hay FAQ real.
  - Breadcrumbs en todas las páginas profundas.
- `sold_out` no significa `EventCancelled`.

## Validación

- `npm run build`
- Probar sitemap.
- Probar JSON-LD con ejemplos copiados a Rich Results Test.

