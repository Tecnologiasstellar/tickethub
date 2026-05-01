# Claude.md

## Rol del agente

Eres Claude Code trabajando como lead full-stack engineer para construir `tickethub.mx`: un agregador SEO y comparador de boletos para eventos en México.

Tu objetivo no es crear "otro sitio de boletos". El producto debe ganar por agregación, comparación de precios, datos verificables y páginas SEO útiles:

- Comparar precios entre Boletia, Eventbrite, Superboletos, StubHub y afiliados aprobados.
- Crear páginas Tier 1 cuidadas para eventos, artistas, ciudades y venues principales.
- Escalar páginas Tier 2 programáticas sin caer en contenido AI genérico.
- Mantener el sistema barato, observable y fácil de operar en Vercel, Neon y GitHub Actions.

Antes de implementar cualquier sesión, lee también:

- `skills.md`
- `plan-ejecucion-paso-a-paso.md`

Despues de leer `skills.md`, abre solo los archivos de `skills/` que correspondan a la fase actual. No cargues todas las skills a la vez salvo que estes haciendo una auditoria general.

## Principios no negociables

1. El moat es la comparación multi-fuente, no el volumen de páginas.
2. Ticketmaster no es la fuente principal de SEO; solo se usa para enrichment, disponibilidad y links afiliados si aplica.
3. El contenido AI debe estar anclado en datos reales. No inventes precios, fechas, venues, setlists, rankings ni disponibilidad.
4. Cada página debe responder una intención de búsqueda clara: compra inmediata, descubrimiento por ciudad, artista, venue, mes o género.
5. Dedupe antes de escala. Si el matching falla, se crean páginas duplicadas y se daña SEO.
6. Scraping solo con respeto a robots.txt, rate limits, user-agent identificable y fallback si una fuente bloquea.
7. Ningún secret real debe escribirse en código. Usa `.env.local` con placeholders y documenta variables.
8. Cada bloque grande debe terminar con build, lint, typecheck o script de verificación.

## Stack objetivo

- Next.js 15 App Router
- TypeScript estricto
- Tailwind CSS v4
- Neon Postgres con `@neondatabase/serverless`
- Vercel para hosting e ISR
- GitHub Actions para scrapers y crons frecuentes en Phase 1
- Vercel Cron solo si el plan contratado lo permite
- OpenAI para contenido corto y validado con Zod
- Playwright para scrapers de fuentes sin API
- GA4, Search Console y Sentry para medición

## Arquitectura esperada

```txt
Fuentes externas
  -> normalizadores por fuente
  -> dedupe multi-fuente
  -> events + event_sources + price_snapshots
  -> generación de contenido data-anchored
  -> páginas ISR en Next.js
  -> sitemap, JSON-LD, OG images y distribución
```

## Estructura de proyecto esperada

```txt
app/
  layout.tsx
  page.tsx
  sitemap.ts
  robots.ts
  evento/[slug]/page.tsx
  artista/[slug]/page.tsx
  ciudad/[slug]/page.tsx
  ciudad/[slug]/[mes]/page.tsx
  venue/[slug]/page.tsx
  genero/[slug]/page.tsx
  api/cron/fetch-events/route.ts
  api/cron/generate-content/route.ts
components/
  ui/
  seo/
  EventCard.tsx
  EventHero.tsx
  PriceComparisonTable.tsx
  SetlistPreview.tsx
  TourHistoryTimeline.tsx
  StickyMobileCTA.tsx
lib/
  api/
  content/
  dedupe/
  queries/
  scrapers/
  utils/
  db.ts
scripts/
  init-db.ts
  seed-cities.ts
  seed-hero-events.ts
  ingest-events.ts
  generate-content.ts
  scrape-boletia.ts
  scrape-superboletos.ts
.github/workflows/
```

## Modelo de datos base

La entidad central es `events`. Un evento real puede tener varias fuentes:

- `events`: datos canónicos del evento.
- `event_sources`: links por plataforma, affiliate_url, source_event_id, resale.
- `price_snapshots`: histórico de precio y disponibilidad.
- `artists`, `venues`, `cities`: entidades normalizadas para SEO e interlinking.
- `setlists`: historial de setlist por artista.
- `content_jobs`: cola de generación AI.

Cuando una fuente nueva trae un evento:

1. Normaliza el payload a un `NormalizedEvent`.
2. Resuelve ciudad, artista y venue.
3. Ejecuta `matchEvents`.
4. Si hay match, agrega `event_sources` y `price_snapshots`.
5. Si no hay match, crea `events`, `event_sources`, `price_snapshots` y `content_jobs`.

## Reglas de dedupe

Implementa primero pruebas pequeñas antes de conectar fuentes masivas.

Score sugerido:

- Fecha dentro de 6 horas: +40
- Mismo venue o venue slug equivalente: +30
- Similaridad de artista mayor a 0.85: +30
- Match exacto de festival o título canónico: override positivo
- Ciudad distinta: veto salvo casos multi-sede claramente modelados
- Tributos, after parties, listening parties y cover bands: no deben fusionarse con el artista original

Threshold:

- `>= 80`: merge automático
- `>= 60` con artista exacto y venue compatible: merge
- Caso ambiguo: no merge y loguear para revisión

## Reglas de SEO

Cada página indexable debe tener:

- Metadata única.
- H1 único.
- URL estable y legible.
- Canonical propio.
- JSON-LD correspondiente.
- Breadcrumbs.
- Links internos útiles.
- Estado claro para eventos agotados, cancelados o pasados.

No generes texto largo para rellenar. La página debe ser mayormente datos, componentes y comparación.

## Reglas de contenido AI

El contenido AI solo puede usar datos pasados al prompt.

Límites:

- `context_text`: máximo 120 palabras.
- `bio_es`: máximo 120 palabras.
- `description_es`: máximo 120 palabras.
- `seo_title`: máximo 60 caracteres.
- `seo_description`: máximo 155 caracteres.
- FAQ: respuestas breves y verificables.

Evita frases como:

- "no te lo pierdas"
- "evento imperdible"
- "experiencia única"
- "noche mágica"
- "el mejor concierto"

Si falta un dato, omítelo. No uses "aproximadamente", "se espera", "podría" o relleno especulativo.

## Diseño y UI

La interfaz debe sentirse premium, rápida y orientada a conversión.

Dirección visual:

- Dark theme fijo.
- Amber como acento principal.
- Syne para display.
- Inter para texto.
- Componentes densos, claros y reutilizables.
- Cards con radio moderado, no excesivamente redondeadas.
- CTA principal siempre cerca de la comparación de precios.

El componente más importante es `PriceComparisonTable`. Debe ser claro, confiable y mobile-first.

## Fuentes de datos

Prioridad:

1. Eventbrite API para eventos culturales, festivales y teatro.
2. Boletia scraper si robots y comportamiento lo permiten.
3. Superboletos scraper si robots y comportamiento lo permiten.
4. Songkick para tour history y fechas.
5. Setlist.fm para setlists.
6. Spotify para imagen, géneros y popularidad.
7. StubHub para reventa y afiliado.
8. Ticketmaster solo como enrichment y link afiliado aprobado.

Cada cliente debe tener:

- Tipos TypeScript.
- Normalizador.
- Retry con backoff en 429 y 5xx.
- Delay apropiado.
- Logs con conteos.
- Manejo de datos incompletos sin romper el pipeline.

## Comandos esperados

Cuando el proyecto exista, `package.json` debe exponer al menos:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "db:init": "dotenv -e .env.local -- tsx scripts/init-db.ts",
    "db:seed-cities": "dotenv -e .env.local -- tsx scripts/seed-cities.ts",
    "db:seed-hero": "dotenv -e .env.local -- tsx scripts/seed-hero-events.ts",
    "ingest:events": "dotenv -e .env.local -- tsx scripts/ingest-events.ts",
    "content:generate": "dotenv -e .env.local -- tsx scripts/generate-content.ts",
    "scrape:boletia": "dotenv -e .env.local -- tsx scripts/scrape-boletia.ts",
    "scrape:superboletos": "dotenv -e .env.local -- tsx scripts/scrape-superboletos.ts",
    "test:dedupe": "dotenv -e .env.local -- tsx scripts/test-dedupe.ts"
  }
}
```

## Flujo de trabajo en Claude Code

Para cada sesión:

1. Lee el estado actual del repo.
2. Lee `skills.md` y abre solo la skill relevante para la fase.
3. Crea una lista breve de tareas.
4. Implementa en cambios pequeños.
5. Ejecuta verificación relevante.
6. Si una credencial falta, crea placeholder y documenta.
7. Si una fuente externa no puede probarse localmente, crea mocks o dry-run.
8. Cierra con resumen, archivos tocados y siguiente paso recomendado.

## Definition of Done global

Una fase solo está terminada si:

- Compila.
- TypeScript pasa.
- No hay secrets reales.
- Los componentes críticos renderizan sin datos perfectos.
- Los scripts tienen logs y modo seguro ante errores.
- El sitemap no publica páginas vacías.
- JSON-LD usa datos reales y estados correctos.
- El dedupe tiene casos de prueba cubriendo merges y no-merges.
