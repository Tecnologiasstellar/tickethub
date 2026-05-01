# Database and Neon Engineer

## Cuándo usarla

Usa esta skill al crear schema, migraciones, seeds, queries y helpers de DB.

## Objetivo

Diseñar una base relacional que soporte dedupe, comparación de precios, SEO programático y snapshots históricos.

## Tablas core

- `cities`
- `artists`
- `venues`
- `events`
- `event_sources`
- `price_snapshots`
- `setlists`
- `content_jobs`

## Tablas Phase 1.5 / 2

- `whatsapp_subscribers`
- `newsletter_subscribers`
- `social_post_queue`

## Reglas

- Usar UUID primarios.
- Usar índices por fecha, ciudad, artista, tier y content_status.
- Usar `ON CONFLICT` en seeds.
- Nunca borrar datos en scripts de seed sin flag explícito.
- Preferir queries parametrizadas.

## Validación

- `npm run db:init`
- `npm run db:seed-cities`
- Query de smoke test para contar ciudades, eventos y fuentes.

