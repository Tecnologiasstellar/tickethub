// app/api/cron/generate-content/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/utils/cron";
import { query, queryOne } from "@/lib/db";
import { generateEventContext } from "@/lib/content/generate-event-context";
import { generateArtistBio } from "@/lib/content/generate-artist-bio";
import { generateVenueDescription } from "@/lib/content/generate-venue-description";

const JOBS_PER_RUN = parseInt(process.env.CONTENT_JOBS_PER_RUN ?? "10", 10) || 10;

interface ContentJob {
  id: string;
  entity_type: string;
  entity_id: string;
  job_type: string;
}

export async function POST(req: NextRequest) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  try {
    const jobs = await query<ContentJob>(
      `SELECT id, entity_type, entity_id, job_type
       FROM content_jobs
       WHERE status = 'queued'
       ORDER BY created_at
       LIMIT $1`,
      [JOBS_PER_RUN]
    );

    const stats = { processed: 0, done: 0, failed: 0 };

    for (const job of jobs) {
      stats.processed++;
      try {
        if (job.entity_type === "event") {
          await generateEventContext(job.entity_id);
        } else if (job.entity_type === "artist") {
          await generateArtistBio(job.entity_id);
        } else if (job.entity_type === "venue") {
          await generateVenueDescription(job.entity_id);
        } else {
          await queryOne(
            `UPDATE content_jobs SET status='failed', last_error=$1, updated_at=NOW() WHERE id=$2`,
            [`unknown entity_type: ${job.entity_type}`, job.id]
          );
          stats.failed++;
          continue;
        }
        stats.done++;
      } catch (err) {
        stats.failed++;
        console.error(`[generate-content] job ${job.id} failed:`, err);
      }
    }

    return NextResponse.json({ ok: true, jobsPerRun: JOBS_PER_RUN, stats });
  } catch (err) {
    console.error("[generate-content] unhandled error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
