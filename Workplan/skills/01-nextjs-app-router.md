# Next.js App Router Engineer

## Cuándo usarla

Usa esta skill al crear rutas, layouts, metadata, ISR, sitemap, robots, OG images o endpoints API.

## Objetivo

Construir una app Next.js 15 estable, indexable y compatible con Vercel.

## Reglas

- Usar App Router.
- Preferir server components para páginas SEO.
- Usar `generateMetadata` por entidad.
- Usar `revalidate` por tipo de página:
  - Homepage: 1800 segundos.
  - Evento hero: 3600 segundos.
  - Long-tail: 21600 segundos.
  - Ciudad hero: 1800 segundos.
- Usar `dynamicParams = true` para permitir nuevos slugs.
- No depender de client-side fetching para contenido indexable.

## Validación

- `npm run typecheck`
- `npm run build`
- Revisar que rutas dinámicas no fallen con datos faltantes.

