-- tickethub.mx schema
-- All tables use gen_random_uuid() (built into Postgres 13+, available on Neon).
-- Re-running this file is safe: every CREATE uses IF NOT EXISTS.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── cities ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  country     TEXT NOT NULL DEFAULT 'MX',
  tier        INTEGER NOT NULL DEFAULT 2,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cities_tier_idx ON cities (tier);

-- ─── artists ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  spotify_id      TEXT UNIQUE,
  mbid            TEXT UNIQUE,
  image_url       TEXT,
  genres          TEXT[],
  popularity      INTEGER,
  bio_es          TEXT,
  content_status  TEXT NOT NULL DEFAULT 'queued'
                   CHECK (content_status IN ('queued','processing','published','failed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS artists_content_status_idx ON artists (content_status);
CREATE INDEX IF NOT EXISTS artists_popularity_idx ON artists (popularity DESC NULLS LAST);

-- ─── venues ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS venues (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  city_id     UUID REFERENCES cities(id) ON DELETE SET NULL,
  address     TEXT,
  capacity    INTEGER,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  image_url   TEXT,
  description_es TEXT,
  content_status TEXT NOT NULL DEFAULT 'queued'
                  CHECK (content_status IN ('queued','processing','published','failed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS venues_city_idx ON venues (city_id);
CREATE INDEX IF NOT EXISTS venues_content_status_idx ON venues (content_status);

-- ─── events ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  artist_id       UUID REFERENCES artists(id) ON DELETE SET NULL,
  venue_id        UUID REFERENCES venues(id) ON DELETE SET NULL,
  city_id         UUID REFERENCES cities(id) ON DELETE SET NULL,
  date            TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','cancelled','sold_out','past')),
  tier            TEXT NOT NULL DEFAULT 'tier2'
                   CHECK (tier IN ('tier1','tier2')),
  content_status  TEXT NOT NULL DEFAULT 'queued'
                   CHECK (content_status IN ('queued','processing','published','failed')),
  seo_title       TEXT,
  seo_description TEXT,
  description_es  TEXT,
  context_text    TEXT,
  h1_title        TEXT,
  faq_json        JSONB,
  image_url       TEXT,
  h1_title        TEXT,
  faq_json        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS events_date_idx ON events (date);
CREATE INDEX IF NOT EXISTS events_city_idx ON events (city_id);
CREATE INDEX IF NOT EXISTS events_artist_idx ON events (artist_id);
CREATE INDEX IF NOT EXISTS events_venue_idx ON events (venue_id);
CREATE INDEX IF NOT EXISTS events_tier_idx ON events (tier);
CREATE INDEX IF NOT EXISTS events_content_status_idx ON events (content_status);
CREATE INDEX IF NOT EXISTS events_status_idx ON events (status);
CREATE INDEX IF NOT EXISTS events_city_date_idx ON events (city_id, date);

-- ─── event_sources ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_sources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL
                   CHECK (platform IN ('eventbrite','boletia','superboletos','stubhub','ticketmaster','songkick','manual')),
  source_event_id TEXT NOT NULL,
  url             TEXT NOT NULL,
  affiliate_url   TEXT,
  is_resale       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (platform, source_event_id)
);

CREATE INDEX IF NOT EXISTS event_sources_event_idx ON event_sources (event_id);
CREATE INDEX IF NOT EXISTS event_sources_platform_idx ON event_sources (platform);

-- ─── price_snapshots ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS price_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_source_id UUID NOT NULL REFERENCES event_sources(id) ON DELETE CASCADE,
  min_price       NUMERIC(12,2),
  max_price       NUMERIC(12,2),
  currency        TEXT NOT NULL DEFAULT 'MXN',
  is_sold_out     BOOLEAN NOT NULL DEFAULT FALSE,
  snapped_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS price_snapshots_source_idx ON price_snapshots (event_source_id);
CREATE INDEX IF NOT EXISTS price_snapshots_snapped_at_idx ON price_snapshots (snapped_at DESC);

-- ─── setlists ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS setlists (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id     UUID REFERENCES artists(id) ON DELETE CASCADE,
  setlistfm_id  TEXT UNIQUE,
  event_date    DATE,
  venue_name    TEXT,
  city_name     TEXT,
  country       TEXT,
  songs         JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS setlists_artist_idx ON setlists (artist_id);
CREATE INDEX IF NOT EXISTS setlists_event_date_idx ON setlists (event_date DESC);

-- ─── content_jobs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  TEXT NOT NULL CHECK (entity_type IN ('event','artist','venue','city')),
  entity_id    UUID NOT NULL,
  job_type     TEXT NOT NULL CHECK (job_type IN ('event_context','artist_bio','venue_description','seo_metadata','faq')),
  status       TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','processing','done','failed')),
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT,
  payload      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, entity_id, job_type)
);

CREATE INDEX IF NOT EXISTS content_jobs_status_idx ON content_jobs (status);
CREATE INDEX IF NOT EXISTS content_jobs_entity_idx ON content_jobs (entity_type, entity_id);

-- ─── updated_at triggers ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'cities_set_updated_at') THEN
    CREATE TRIGGER cities_set_updated_at BEFORE UPDATE ON cities
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'artists_set_updated_at') THEN
    CREATE TRIGGER artists_set_updated_at BEFORE UPDATE ON artists
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'venues_set_updated_at') THEN
    CREATE TRIGGER venues_set_updated_at BEFORE UPDATE ON venues
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'events_set_updated_at') THEN
    CREATE TRIGGER events_set_updated_at BEFORE UPDATE ON events
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'content_jobs_set_updated_at') THEN
    CREATE TRIGGER content_jobs_set_updated_at BEFORE UPDATE ON content_jobs
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
