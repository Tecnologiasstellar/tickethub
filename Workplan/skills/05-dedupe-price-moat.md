# Dedupe and Price Moat Specialist

## Cuándo usarla

Usa esta skill antes de importar datos masivos y cada vez que se modifique `event_sources`, `price_snapshots` o matching.

## Objetivo

Detectar cuándo dos fuentes apuntan al mismo evento real y consolidarlas en una página con comparación de precios.

## Reglas

- Ciudad distinta casi siempre veta el merge.
- Fecha compatible no basta si el artista o venue no coincide.
- Tributos, covers y fiestas temáticas no deben fusionarse con artista original.
- Festivales deben matchear por título/festival, no por un artista secundario.
- Todo merge debe dejar snapshot de precio.

## Tests mínimos

- Mismo evento exacto debe hacer merge.
- Misma fecha con diferencia menor a 6 horas y mismo venue debe hacer merge.
- Ciudad distinta no debe hacer merge.
- Tributo con nombre similar no debe hacer merge.
- Festival con múltiples artistas debe matchear por festival.

## Validación

- `npm run test:dedupe`
- Revisar logs de casos ambiguos.

