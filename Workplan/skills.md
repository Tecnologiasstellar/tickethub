# skills.md

Indice maestro de skills para Claude Code durante la construccion de `tickethub.mx`.

Regla de uso:

1. Lee este archivo al iniciar una sesion.
2. Identifica la fase actual en `plan-ejecucion-paso-a-paso.md`.
3. Abre solo la skill relevante para el trabajo de esa sesion.
4. Si una sesion cruza varias areas, abre primero `skills/00-project-orchestrator.md` y despues las 1 a 3 skills tecnicas necesarias.

Evita cargar todos los archivos de skills al mismo tiempo salvo que estes haciendo una auditoria general. La idea es mantener el contexto de Claude Code enfocado.

## Skills disponibles

| Skill | Archivo | Usala cuando... |
|---|---|---|
| Project Orchestrator | `skills/00-project-orchestrator.md` | Inicies una sesion, cambies de fase o el repo este ambiguo. |
| Next.js App Router Engineer | `skills/01-nextjs-app-router.md` | Crees rutas, layouts, metadata, ISR, sitemap, robots, OG images o endpoints API. |
| Design System Builder | `skills/02-design-system.md` | Crees tokens, componentes UI o pantallas principales. |
| Database and Neon Engineer | `skills/03-database-neon.md` | Crees schema, migraciones, seeds, queries o helpers de DB. |
| Data Source Integrator | `skills/04-data-sources.md` | Integres Eventbrite, Songkick, Setlist.fm, Spotify, StubHub, Ticketmaster o scrapers. |
| Dedupe and Price Moat Specialist | `skills/05-dedupe-price-moat.md` | Modifiques matching, `event_sources`, `price_snapshots` o logica de merge. |
| Programmatic SEO Specialist | `skills/06-programmatic-seo.md` | Crees paginas Tier 1/Tier 2, sitemap, JSON-LD, breadcrumbs o canonicals. |
| AI Content Editor | `skills/07-ai-content-editor.md` | Generes contextos, bios, descripciones de venue o FAQs con AI. |
| Automation and Cron Engineer | `skills/08-automation-cron.md` | Crees Vercel Cron, GitHub Actions, scripts recurrentes o jobs. |
| Monetization and Distribution Builder | `skills/09-monetization-distribution.md` | Implementes afiliados, AdSense, WhatsApp, newsletter o social assets. |
| QA and Launch Reviewer | `skills/10-qa-launch-reviewer.md` | Cierres una semana, revises launch o busques blockers de produccion. |

## Combinaciones recomendadas

- Scaffold inicial: `skills/00-project-orchestrator.md`, `skills/01-nextjs-app-router.md`, `skills/03-database-neon.md`.
- UI y paginas hero: `skills/02-design-system.md`, `skills/06-programmatic-seo.md`.
- Ingesta de datos: `skills/04-data-sources.md`, `skills/05-dedupe-price-moat.md`, `skills/08-automation-cron.md`.
- Contenido SEO: `skills/07-ai-content-editor.md`, `skills/06-programmatic-seo.md`.
- Launch: `skills/10-qa-launch-reviewer.md`, `skills/08-automation-cron.md`, `skills/09-monetization-distribution.md`.

## Regla de oro

Si una decision afecta comparacion multi-fuente, dedupe o paginas indexables, prioriza las skills `skills/05-dedupe-price-moat.md` y `skills/06-programmatic-seo.md`. Esas dos protegen el moat y el SEO del proyecto.
