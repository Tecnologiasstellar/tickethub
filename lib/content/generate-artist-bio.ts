// lib/content/generate-artist-bio.ts
import OpenAI from "openai";
import { z } from "zod";
import { query, queryOne } from "../db";
import { SYSTEM_PROMPT, buildArtistPrompt, type ArtistData } from "./prompts";

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

const ArtistBioSchema = z.object({
  bio_es: z.string().min(50).max(300),
});

async function markJobStatus(
  artistId: string,
  status: "processing" | "done" | "failed",
  lastError?: string
) {
  await query(
    `UPDATE content_jobs
     SET status=$1, last_error=$2,
         attempts = CASE WHEN $1 = 'processing' THEN attempts+1 ELSE attempts END,
         updated_at=NOW()
     WHERE entity_type='artist' AND entity_id=$3 AND job_type='artist_bio'`,
    [status, lastError ?? null, artistId]
  );
}

export async function generateArtistBio(artistId: string): Promise<string> {
  await markJobStatus(artistId, "processing");

  const row = await queryOne<{
    name: string;
    genres: string[] | null;
    popularity: number | null;
    event_count: string;
  }>(
    `SELECT
       a.name,
       a.genres,
       a.popularity,
       COUNT(e.id) AS event_count
     FROM artists a
     LEFT JOIN events e ON e.artist_id = a.id AND e.date > NOW() AND e.status = 'active'
     WHERE a.id = $1
     GROUP BY a.id`,
    [artistId]
  );

  if (!row) {
    const err = `artist ${artistId} not found`;
    await markJobStatus(artistId, "failed", err);
    throw new Error(err);
  }

  const artistData: ArtistData = {
    name:               row.name,
    genres:             row.genres,
    popularity:         row.popularity,
    upcomingEventCount: Number(row.event_count),
  };

  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: buildArtistPrompt(artistData) },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";

  let jsonParsed: unknown;
  try {
    jsonParsed = JSON.parse(raw);
  } catch (e) {
    const err = `invalid JSON from OpenAI: ${e instanceof Error ? e.message : String(e)}`;
    await markJobStatus(artistId, "failed", err);
    throw new Error(`[generate-artist-bio] ${err}`);
  }

  const parsed = ArtistBioSchema.safeParse(jsonParsed);

  if (!parsed.success) {
    const err = `validation failed: ${parsed.error.message}`;
    await markJobStatus(artistId, "failed", err);
    throw new Error(`[generate-artist-bio] ${err}`);
  }

  const { bio_es } = parsed.data;

  await query(
    `UPDATE artists SET bio_es=$1, content_status='published', updated_at=NOW() WHERE id=$2`,
    [bio_es, artistId]
  );

  await markJobStatus(artistId, "done");

  return bio_es;
}
