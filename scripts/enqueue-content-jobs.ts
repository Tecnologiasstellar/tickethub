/**
 * Enqueue content_jobs for the 5 target events to publish via content:generate.
 * Idempotent: ON CONFLICT DO NOTHING.
 */
import { query } from "../lib/db";

const TARGET_SLUGS = [
  "undrworld-presenta-i-see-stars-en-cdmx-2027-05-08",
  "the-bouncing-souls-the-menzingers-y-pup-2027-05-07",
  "ambkor-en-cdmx-los-ultimos-vivos-tour-l-2026-10-24",
  "alan-arrieta-2026-06-06",
  "erik-canales-jose-meyer-ibarra-andres-c-2026-05-23",
];

(async () => {
  const events = await query<{ id: string; slug: string; title: string }>(
    `SELECT id, slug, title FROM events WHERE slug = ANY($1::text[])`,
    [TARGET_SLUGS],
  );
  console.log(`Found ${events.length} / ${TARGET_SLUGS.length} target events`);

  for (const e of events) {
    await query(
      `INSERT INTO content_jobs (entity_type, entity_id, job_type, status)
       VALUES ('event', $1, 'event_context', 'queued')
       ON CONFLICT (entity_type, entity_id, job_type)
       DO UPDATE SET status = 'queued', last_error = NULL, updated_at = NOW()`,
      [e.id],
    );
    console.log(`  enqueued: ${e.slug}`);
  }

  const missing = TARGET_SLUGS.filter(
    (s) => !events.find((e) => e.slug === s),
  );
  if (missing.length > 0) {
    console.warn("Missing slugs:", missing);
  }
  process.exit(0);
})();
