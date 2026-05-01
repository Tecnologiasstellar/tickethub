# Automation and Cron Engineer

## Cuándo usarla

Usa esta skill al crear Vercel Cron, GitHub Actions, scripts recurrentes o jobs de contenido.

## Objetivo

Operar ingesta, scrapers y contenido sin servidores dedicados.

## Reglas

- En Phase 1, preferir GitHub Actions para frecuencia mayor a diaria.
- Proteger endpoints cron con `Authorization: Bearer ${CRON_SECRET}`.
- Mantener endpoints Vercel dentro de timeouts.
- Separar API fetch frecuente de scrapers Playwright diarios.
- Cada workflow debe tener logs claros.

## Validación

- Ejecutar scripts localmente en modo dry-run.
- Confirmar que workflows no requieren secrets no documentados.

