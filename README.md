# TicketHub.mx

Next.js 15 (App Router) + Neon Postgres + multi-source event ingestion (Eventbrite, Boletia, Superboletos, Ticketmaster, Songkick, Spotify, Setlist.fm) and OpenAI-powered content generation.

## Running locally

1. `cp .env.local.example .env.local` and fill in the credentials you have.
2. `npm install`
3. `npm run preflight` — probes every external credential and reports `[OK|FAIL|SKIP]` per service. **Run this first before any ingest/scrape job** so you don't burn a long run on a bad key.
4. `npm run dev` to start the Next.js dev server.

Common ingest scripts (see `package.json` for the full list):

- `npm run ingest:ticketmaster` / `:dry`
- `npm run ingest:eventbrite` / `:dry`
- `npm run scrape:boletia` / `:dry`
- `npm run enrich:spotify` / `:dry`
- `npm run content:generate`
