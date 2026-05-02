// scripts/generate-content.ts
import { query } from "../lib/db";
import { generateEventContext } from "../lib/content/generate-event-context";
import { generateArtistBio } from "../lib/content/generate-artist-bio";
import { generateVenueDescription } from "../lib/content/generate-venue-description";

const LIMIT = parseInt(
  process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "20",
  10
) || 20;

interface ContentJob {
  id: string;
  entity_type: string;
  entity_id: string;
  job_type: string;
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[generate-content] OPENAI_API_KEY not set — exiting");
    process.exit(1);
  }

  console.log(`[generate-content] processing up to ${LIMIT} queued jobs`);

  const jobs = await query<ContentJob>(
    `SELECT id, entity_type, entity_id, job_type
     FROM content_jobs
     WHERE status = 'queued'
     ORDER BY created_at
     LIMIT $1`,
    [LIMIT]
  );

  console.log(`[generate-content] found ${jobs.length} queued jobs`);

  const stats = { processed: 0, done: 0, failed: 0 };

  for (const job of jobs) {
    stats.processed++;
    console.log(
      `[generate-content] processing ${job.entity_type}:${job.entity_id} (${job.job_type})`
    );

    try {
      if (job.entity_type === "event") {
        await generateEventContext(job.entity_id);
      } else if (job.entity_type === "artist") {
        await generateArtistBio(job.entity_id);
      } else if (job.entity_type === "venue") {
        await generateVenueDescription(job.entity_id);
      } else {
        console.warn(`[generate-content] unknown entity_type: ${job.entity_type} — skipping`);
        stats.failed++;
        continue;
      }
      stats.done++;
      console.log(`[generate-content] done: ${job.entity_type}:${job.entity_id}`);
    } catch (err) {
      stats.failed++;
      console.error(
        `[generate-content] failed: ${job.entity_type}:${job.entity_id}: ` +
        `${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.log(
    `[generate-content] done. processed=${stats.processed} done=${stats.done} failed=${stats.failed}`
  );
}

main().catch((err) => {
  console.error("[generate-content] fatal:", err);
  process.exit(1);
});
