# AI Content Editor

## Cuándo usarla

Usa esta skill al generar contextos de evento, bios de artista, descripciones de venue y FAQs.

## Objetivo

Crear contenido breve, útil y verificable sin inventar datos.

## Reglas

- Prompt con datos explícitos.
- Output JSON estricto.
- Validación con Zod.
- Máximo 120 palabras en bloques editoriales.
- Cero clichés de marketing.
- Si no hay dato, se omite.

## Validación

- Tests o script dry-run con un evento completo y uno incompleto.
- Revisar que el output no exceda límites.
- Revisar que no aparezcan datos no provistos.

