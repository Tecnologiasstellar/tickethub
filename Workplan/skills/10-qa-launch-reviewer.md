# QA and Launch Reviewer

## Cuándo usarla

Usa esta skill al cerrar cada semana y antes de launch.

## Objetivo

Encontrar fallas de producción antes de publicar o indexar.

## Checklist

- Build pasa.
- Typecheck pasa.
- Sitemap responde.
- Robots correcto.
- Homepage renderiza con y sin eventos.
- Página evento renderiza con múltiples fuentes.
- Página evento renderiza con una sola fuente.
- Página evento agotado no se marca como cancelado.
- Páginas sin datos opcionales no muestran placeholders.
- No hay secrets reales.
- No hay páginas programáticas vacías en sitemap.
- Performance objetivo:
  - LCP menor a 2.5s.
  - CLS menor a 0.1.
  - INP menor a 200ms.

## Output esperado

- Lista de checks pasados.
- Bugs encontrados con archivo y acción recomendada.
- Go/no-go de launch.

