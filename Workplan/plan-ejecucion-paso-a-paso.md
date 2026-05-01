# Plan de ejecucion paso a paso para crear tickethub.mx

## Resumen ejecutivo

`tickethub.mx` sera un agregador SEO y comparador de boletos para eventos en Mexico. La ventaja principal es mostrar en una sola pagina el mismo evento con precios, disponibilidad y links de varias plataformas.

El plan original tenia buena direccion, pero para ejecutarlo mejor en Claude Code conviene ordenarlo por dependencias reales:

1. Base tecnica y UI.
2. Modelo de datos.
3. Dedupe y comparacion de precios.
4. Paginas SEO.
5. Ingesta progresiva.
6. Contenido AI data-anchored.
7. SEO tecnico.
8. Distribucion y monetizacion.
9. Launch con QA.

La meta de Phase 1 es lanzar un producto usable en 4 semanas con:

- 30 a 50 paginas hero cuidadas.
- 300 a 1,000 paginas long-tail generadas desde datos reales.
- Comparacion multi-plataforma funcionando.
- Sitemap, JSON-LD, Search Console y analytics.
- Primeros canales de monetizacion y audiencia propia.

## Mejoras clave al plan original

### 1. GitHub Actions como cron principal en Phase 1

Vercel Hobby limita crons frecuentes. Para evitar subir costos antes de validar, usa GitHub Actions para:

- Ejecutar scrapers diarios.
- Llamar endpoints cron cada 6 horas.
- Enviar newsletter semanal.

Vercel Cron queda como opcion si se usa Pro.

### 2. Dedupe antes de ingestion masiva

No escalar fuentes hasta tener `match-events.ts` probado. El valor del sitio depende de fusionar fuentes en una sola pagina de evento.

### 3. Publicar solo paginas utiles

No todo lo que exista en DB debe ir al sitemap. Para indexar, una pagina debe tener minimo:

- Evento futuro o estrategicamente relevante.
- Fuente de compra o tracking clara.
- Metadata unica.
- Ciudad, fecha y venue confiables.
- Contenido no vacio.

### 4. AI como capa editorial, no como cuerpo principal

El texto AI debe ser corto y validado. La pagina debe estar compuesta principalmente por datos: precio, fecha, venue, disponibilidad, fuentes, setlists, historia y FAQs reales.

### 5. Scraping con modo seguro

Los scrapers deben respetar robots.txt, tener user-agent identificable, delays y fallback. Si una fuente bloquea, la app debe seguir funcionando con APIs y seeds.

## Fase 0: Preparacion del repo

### Objetivo

Dejar Claude Code listo para ejecutar el proyecto de forma consistente.

### Pasos

1. Crear `Claude.md`.
2. Crear `skills.md` como indice maestro.
3. Crear directorio `skills/` con una skill detallada por area.
4. Crear `plan-ejecucion-paso-a-paso.md`.
5. Iniciar repo limpio o rama de trabajo.
6. Confirmar version de Node recomendada: Node 20 o superior.

### Definition of Done

- Los tres documentos base existen.
- `skills.md` apunta a skills especificas dentro de `skills/`.
- Claude Code tiene reglas de proyecto, skills modulares y plan secuenciado.

## Fase 1: Scaffold tecnico

### Objetivo

Crear la base Next.js lista para desarrollo.

### Prompt para Claude Code

```txt
Crea un proyecto Next.js 15 App Router con TypeScript para tickethub.mx.
Usa Tailwind CSS v4, strict TypeScript, paths "@/*": ["./*"], y prepara .env.local con placeholders.
Instala dependencias runtime: @neondatabase/serverless, openai, slugify, date-fns, string-similarity, zod.
Instala dependencias dev: @types/node, tsx, dotenv-cli.
Configura next.config.ts con remotePatterns para imagenes de Spotify, Eventbrite, Ticketmaster, Boletia y Songkick.
Crea lib/db.ts con Pool de @neondatabase/serverless, helper sql y helper query.
Agrega scripts base: dev, build, lint, typecheck.
```

### Archivos esperados

- `package.json`
- `next.config.ts`
- `tsconfig.json`
- `.env.local`
- `app/layout.tsx`
- `app/page.tsx`
- `app/globals.css`
- `lib/db.ts`

### Verificacion

```bash
npm run typecheck
npm run build
```

## Fase 2: Design system base

### Objetivo

Crear una identidad visual consistente y componentes reutilizables.

### Pasos

1. Crear `design-tokens.css`.
2. Importar Syne e Inter con `next/font/google`.
3. Configurar estilos globales.
4. Crear primitivos UI.
5. Crear componentes de producto.

### Tokens principales

- Background: `#0d0c0b`
- Surface: `#131210`
- Text: `#e8e4dd`
- Muted: `#8a857c`
- Primary amber: `#f5a623`
- Success: `#4caf74`
- Error: `#e05555`

### Componentes esperados

- `components/ui/Button.tsx`
- `components/ui/Badge.tsx`
- `components/ui/DataPill.tsx`
- `components/ui/Card.tsx`
- `components/EventCard.tsx`
- `components/EventHero.tsx`
- `components/PriceComparisonTable.tsx`
- `components/SetlistPreview.tsx`
- `components/TourHistoryTimeline.tsx`
- `components/StickyMobileCTA.tsx`

### Definition of Done

- Componentes tipados sin `any`.
- Estados visuales para disponibilidad.
- `PriceComparisonTable` destaca el precio mas bajo.
- Mobile CTA funciona sin tapar contenido.

## Fase 3: Base de datos y seeds

### Objetivo

Crear schema relacional para eventos, fuentes y snapshots.

### Pasos

1. Crear `lib/db/schema.sql`.
2. Crear `scripts/init-db.ts`.
3. Crear `scripts/seed-cities.ts`.
4. Crear `scripts/seed-hero-events.ts`.
5. Agregar scripts npm de DB.

### Tablas core

- `cities`
- `artists`
- `venues`
- `events`
- `event_sources`
- `price_snapshots`
- `setlists`
- `content_jobs`

### Ciudades hero iniciales

- Ciudad de Mexico
- Guadalajara
- Monterrey
- Puebla
- Queretaro

### Definition of Done

- Schema ejecuta contra Neon.
- Seeds son idempotentes.
- Hay indices para fechas, ciudad, artista, tier y content_status.
- Los eventos hero crean fuentes y snapshot inicial.

## Fase 4: Dedupe multi-fuente

### Objetivo

Fusionar datos de distintas fuentes en un unico evento canonico.

### Pasos

1. Definir `NormalizedEvent`.
2. Crear `lib/dedupe/match-events.ts`.
3. Crear `ingestNormalizedEvent`.
4. Crear `scripts/test-dedupe.ts`.
5. Probar casos positivos y negativos.

### Algoritmo base

1. Buscar candidatos en misma ciudad y ventana de fecha de +/- 1 dia.
2. Calcular score:
   - Fecha dentro de 6 horas: +40.
   - Mismo venue: +30.
   - Similaridad de artista mayor a 0.85: +30.
3. Si score es 80 o mayor, merge.
4. Si score es 60 o mayor con artista exacto y venue compatible, merge.
5. Si ciudad es distinta, no merge.
6. Si es tributo o cover band, no merge.

### Tests minimos

- Evento exacto debe fusionarse.
- Mismo artista y venue con una hora de diferencia debe fusionarse.
- Misma fecha y nombre en ciudad distinta no debe fusionarse.
- Tributo con nombre similar no debe fusionarse.
- Festival debe matchear por titulo del festival.

### Definition of Done

- `npm run test:dedupe` pasa.
- Casos ambiguos se loguean sin fusionar automaticamente.

## Fase 5: Paginas Tier 1

### Objetivo

Construir las paginas que pueden traer la mayor parte del trafico inicial.

### Paginas

- `/`
- `/evento/[slug]`
- `/artista/[slug]`
- `/ciudad/[slug]`
- `/venue/[slug]`

### Homepage

Debe incluir:

- Hero con search.
- Eventos Tier 1 proximos.
- Ciudades principales.
- Eventos de esta semana.
- Chips por genero.
- Footer con disclaimer: agregador independiente, no vende boletos directamente.

### Evento

Debe incluir:

- EventHero.
- PriceComparisonTable cerca del hero.
- Contexto editorial breve.
- Setlist si existe.
- Detalles de fecha y venue.
- FAQ.
- Otras fechas del artista.
- StickyMobileCTA.
- JSON-LD Event, FAQ y Breadcrumb.

### Artista

Debe incluir:

- Header con imagen Spotify, generos y popularidad.
- Proximas fechas en Mexico.
- Tour history.
- Setlists recientes.
- Recomendaciones por generos similares.
- JSON-LD MusicGroup.

### Ciudad

Debe incluir:

- Hero por ciudad.
- Filtros de periodo, genero y precio.
- Mapa de venues.
- Eventos agrupados por mes.
- Venues principales.

### Venue

Debe incluir:

- Hero con imagen, capacidad y direccion.
- Mapa.
- Eventos proximos.
- Eventos pasados colapsados.
- JSON-LD Place.

### Definition of Done

- Todas las paginas renderizan con datos reales o seeds.
- No hay placeholders visibles.
- ISR configurado.
- Metadata unica por entidad.

## Fase 6: Integracion de fuentes de datos

### Objetivo

Traer eventos, enriquecer artistas y crear snapshots de precios.

### Orden recomendado

1. Eventbrite API.
2. Spotify enrichment.
3. Songkick API.
4. Setlist.fm.
5. Boletia scraper.
6. Superboletos scraper.
7. StubHub partner.
8. Ticketmaster enrichment.

### Por cada fuente

Crear:

- Cliente en `lib/api` o scraper en `lib/scrapers`.
- Tipos del payload.
- Normalizador a `NormalizedEvent`.
- Script de ingesta o enrichment.
- Logs de stats.
- Retries y delays.

### Definition of Done

- Eventbrite y Songkick pueden poblar eventos sin romper.
- Spotify enriquece artistas con imagen, generos y popularidad.
- Setlist.fm guarda setlists por MBID.
- Scrapers tienen dry-run y respetan delays.
- Cada evento nuevo pasa por dedupe.

## Fase 7: Pipeline de ingesta

### Objetivo

Orquestar fuentes y jobs recurrentes.

### Pasos

1. Crear `scripts/ingest-events.ts`.
2. Crear `app/api/cron/fetch-events/route.ts`.
3. Crear `app/api/cron/generate-content/route.ts`.
4. Crear workflow GitHub Actions para llamar cron cada 6 horas.
5. Crear workflow diario para scrapers Playwright.

### Reglas

- Endpoint cron verifica `Authorization: Bearer ${CRON_SECRET}`.
- En Vercel, limitar eventos por run para evitar timeout.
- GitHub Actions puede hacer trabajos mas largos.
- Los scripts deben imprimir stats finales.

### Definition of Done

- Ingesta local procesa una muestra.
- Endpoint cron responde JSON con stats.
- Workflow documenta secrets requeridos.

## Fase 8: Contenido AI data-anchored

### Objetivo

Generar metadata, contexto y FAQs sin contenido generico.

### Pasos

1. Crear `lib/content/prompts.ts`.
2. Crear `generateEventContext(eventId)`.
3. Crear `generateArtistBio(artistId)`.
4. Crear `generateVenueDescription(venueId)`.
5. Crear `scripts/generate-content.ts`.

### Reglas

- Usar OpenAI con JSON estricto.
- Validar con Zod.
- Actualizar `content_status = 'published'` solo si pasa validacion.
- Marcar jobs fallidos con `last_error`.

### Definition of Done

- Un evento completo genera SEO title, description, h1, context_text y FAQ.
- Un evento incompleto no inventa datos.
- Jobs pasan por estados `queued`, `processing`, `done` o `failed`.

## Fase 9: Paginas Tier 2

### Objetivo

Escalar long-tail sin crear paginas vacias.

### Paginas

- Eventos estandar.
- Artistas medianos.
- Ciudad + mes.
- Venues secundarios.
- Generos.
- Ciudades secundarias.

### Reglas

- Reusar componentes Tier 1.
- `EventHero` acepta `variant = 'tier1' | 'tier2'`.
- Tier 2 oculta secciones sin datos.
- `generateStaticParams` incluye paginas publicadas.
- `dynamicParams = true`.

### Definition of Done

- 300+ paginas pueden generarse desde DB.
- Sitemap solo incluye paginas publicadas y utiles.
- No hay contenido duplicado obvio.

## Fase 10: SEO tecnico

### Objetivo

Preparar indexacion y rich results.

### Pasos

1. Crear `app/sitemap.ts`.
2. Crear `app/robots.ts`.
3. Crear schemas:
   - `EventSchema`
   - `MusicGroupSchema`
   - `PlaceSchema`
   - `FAQSchema`
   - `BreadcrumbSchema`
4. Crear OG images dinamicas.
5. Crear canonical URLs.

### Reglas criticas

- `sold_out` usa `EventScheduled` con `SoldOut`, no `EventCancelled`.
- `cancelled` solo si el evento realmente fue cancelado.
- Offers deben apuntar a affiliate_url o source_url.
- Si no hay precio, no inventar offer price.

### Definition of Done

- Sitemap accesible.
- Robots bloquea `/api/` y `/admin/`.
- JSON-LD pasa validacion manual en ejemplos.
- OG image renderiza para evento y artista.

## Fase 11: Performance y observabilidad

### Objetivo

Evitar que el sitio SEO sea lento o invisible ante fallas.

### Pasos

1. Optimizar `next/image`.
2. Lazy load de mapa.
3. Skeletons para secciones pesadas.
4. Preconnect a dominios de imagen.
5. Configurar Sentry.
6. Configurar GA4.
7. Crear eventos analiticos.

### Eventos GA4

- `buy_click`
- `price_compare_view`
- `search`
- `whatsapp_subscribe`
- `newsletter_subscribe`

### Definition of Done

- Build pasa.
- Lighthouse en mobile tiene LCP menor a 2.5s, CLS menor a 0.1.
- Sentry captura errores de ingesta.
- Buy clicks se trackean.

## Fase 12: Monetizacion

### Objetivo

Activar revenue sin bloquear launch.

### Pasos

1. Crear `lib/utils/affiliate-urls.ts`.
2. Agregar UTMs fallback a todas las fuentes.
3. Aplicar a programas afiliados:
   - Boletia.
   - StubHub.
   - Ticketmaster Affiliates.
   - Amazon Associates Mexico.
4. Preparar AdSense.
5. Crear `AdSlot` solo cuando AdSense este aprobado.

### Reglas

- Maximo 2 ads por pagina al inicio.
- Nunca ocultar PriceComparisonTable debajo de exceso de ads.
- Links afiliados deben abrir en nueva pestaña con tracking.

### Definition of Done

- Todas las fuentes tienen `affiliate_url` o UTM fallback.
- Buy button usa URL trackeada.
- AdSense esta preparado pero no rompe si falta client id.

## Fase 13: Audiencia propia

### Objetivo

Crear canales que sean mas defendibles que SEO puro.

### WhatsApp

Pasos:

1. Crear tabla `whatsapp_subscribers`.
2. Crear form con telefono y opt-in.
3. Crear endpoint `/api/whatsapp/subscribe`.
4. Preparar Twilio WhatsApp template.
5. Crear script de broadcast con dry-run.

### Newsletter

Pasos:

1. Crear tabla `newsletter_subscribers`.
2. Crear form de suscripcion.
3. Crear endpoint `/api/newsletter/subscribe`.
4. Crear template semanal con React Email.
5. Crear workflow semanal.

### Social hand-off

Pasos:

1. Crear `scripts/social-post.ts`.
2. Generar caption.
3. Generar imagen vertical 1080x1920.
4. Guardar assets para posteo manual.

### Definition of Done

- Opt-in guardado.
- Unsubscribe existe para email.
- Broadcast tiene dry-run.
- Social assets se generan sin publicar automaticamente.

## Fase 14: Deployment

### Objetivo

Publicar en Vercel con dominio y secrets correctos.

### Pasos manuales

1. Crear proyecto en Vercel.
2. Conectar repo GitHub.
3. Crear Neon Postgres.
4. Configurar variables de entorno en Vercel.
5. Configurar mismas variables en GitHub Actions.
6. Asociar `tickethub.mx`.
7. Configurar DNS:
   - `A @ -> 76.76.21.21`
   - `CNAME www -> cname.vercel-dns.com`
8. Crear propiedad en Google Search Console.
9. Enviar sitemap.
10. Configurar GA4.

### Variables minimas

```txt
DATABASE_URL=
EVENTBRITE_TOKEN=
SONGKICK_API_KEY=
SETLISTFM_API_KEY=
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
STUBHUB_API_KEY=
TICKETMASTER_API_KEY=
OPENAI_API_KEY=
REVALIDATE_SECRET=
CRON_SECRET=
MAPBOX_TOKEN=
NEXT_PUBLIC_SITE_URL=https://tickethub.mx
NEXT_PUBLIC_GA_ID=
SENTRY_DSN=
```

Variables posteriores:

```txt
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
RESEND_API_KEY=
NEXT_PUBLIC_ADSENSE_CLIENT=
```

### Definition of Done

- Preview deployment funciona.
- Produccion responde con dominio final.
- Sitemap se puede abrir.
- Cron endpoint rechaza requests sin secret.
- Search Console recibe sitemap.

## Fase 15: Launch checklist

### Pre-launch

- Schema creado.
- 30 eventos hero cargados.
- 5 ciudades hero funcionales.
- 4 templates principales listas.
- Eventbrite y Songkick funcionando.
- Dedupe probado.
- Top 200 eventos con contenido publicado.
- Sitemap y robots listos.
- JSON-LD validado.
- OG images funcionan.
- Performance mobile aceptable.
- Affiliate URLs con UTM fallback.

### Launch

- Dominio activo.
- Search Console verificada.
- Sitemap enviado.
- GA4 activo.
- Sentry activo.
- Crons o workflows corriendo.
- Primeras paginas indexables disponibles.

### Post-launch

- Revisar Search Console cada 48 horas.
- Corregir paginas descubiertas no indexadas.
- Revisar errores Sentry.
- Monitorear buy clicks por fuente.
- Enviar primer newsletter cuando haya lista.
- Probar primer broadcast WhatsApp en dry-run.

## Roadmap de 4 semanas

### Semana 1: Foundation

- Scaffold Next.js.
- Design system.
- Schema DB.
- Seeds de ciudades y eventos hero.
- Homepage.
- Paginas Tier 1.

### Semana 2: Data pipeline

- Eventbrite.
- Spotify.
- Songkick.
- Setlist.fm.
- Scrapers seguros.
- Dedupe.
- Ingesta completa.
- AI content.
- Primeras Tier 2.

### Semana 3: SEO y calidad

- Sitemap.
- Robots.
- JSON-LD.
- OG images.
- Performance.
- GA4.
- Sentry.
- Search Console prep.

### Semana 4: Launch y monetizacion

- Affiliate URLs.
- AdSense prep.
- WhatsApp opt-in.
- Newsletter.
- Social assets.
- Deploy final.
- Submission a Search Console.

## Riesgos y mitigaciones

### Riesgo: datos duplicados

Mitigacion:

- Dedupe con tests antes de escala.
- Logs de casos ambiguos.
- Revision manual para eventos top.

### Riesgo: fuentes bloquean scraping

Mitigacion:

- APIs primero.
- Scraping con rate limit.
- No depender de una sola fuente.
- Seeds hero manuales.

### Riesgo: contenido AI penalizado

Mitigacion:

- Maximo 120 palabras.
- Validacion con Zod.
- No publicar sin datos.
- Paginas dominadas por datos estructurados.

### Riesgo: Vercel Hobby no soporta crons frecuentes

Mitigacion:

- GitHub Actions llama endpoints cron.
- Vercel Pro solo cuando haya traccion.

### Riesgo: monetizacion tarda

Mitigacion:

- UTMs fallback desde dia 1.
- Aplicar afiliados temprano.
- Capturar WhatsApp/newsletter desde el lanzamiento.

## Secuencia recomendada para Claude Code

Ejecutar en sesiones pequenas:

1. "Lee Claude.md, skills.md, la skill relevante en skills/ y plan-ejecucion-paso-a-paso.md. Ejecuta Fase 1."
2. "Ejecuta Fase 2 con componentes UI y verifica build."
3. "Ejecuta Fase 3 con schema y seeds idempotentes."
4. "Ejecuta Fase 4 con tests de dedupe antes de integrar fuentes."
5. "Ejecuta Fase 5 y crea paginas Tier 1."
6. "Ejecuta Fase 6 solo con Eventbrite, Spotify y Songkick primero."
7. "Ejecuta Fase 7 con pipeline y workflows."
8. "Ejecuta Fase 8 con generacion AI validada."
9. "Ejecuta Fase 9 y 10 para escala SEO."
10. "Ejecuta QA de launch y corrige blockers."

## Criterio final de exito

El proyecto esta listo para launch cuando:

- Hay paginas reales con eventos reales o seeds completos.
- La comparacion de precios funciona.
- El sitemap publica solo paginas utiles.
- Los datos externos pueden actualizarse sin romper la app.
- Google puede entender el sitio con metadata y JSON-LD.
- El usuario puede llegar, comparar y salir a comprar con tracking.
- El equipo puede operar el sistema con scripts y workflows claros.
