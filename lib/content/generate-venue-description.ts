// lib/content/generate-venue-description.ts
import OpenAI from "openai";
import { z } from "zod";
import { query, queryOne } from "../db";
import { SYSTEM_PROMPT, buildVenuePrompt, type VenueData } from "./prompts";

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

const VenueDescriptionSchema = z.object({
  description_es: z.string().min(30).max(200),
});

async function markJobStatus(
  venueId: string,
  status: "processing" | "done" | "failed",
  lastError?: string
) {
  await query(
    `UPDATE content_jobs
     SET status=$1, last_error=$2,
         attempts = CASE WHEN $1 = 'processing' THEN attempts+1 ELSE attempts END,
         updated_at=NOW()
     WHERE entity_type='venue' AND entity_id=$3 AND job_type='venue_description'`,
    [status, lastError ?? null, venueId]
  );
}

export async function generateVenueDescription(venueId: string): Promise<string> {
  await markJobStatus(venueId, "processing");

  const row = await queryOne<{
    name: string;
    city_name: string | null;
    capacity: number | null;
    address: string | null;
  }>(
    `SELECT v.name, c.name AS city_name, v.capacity, v.address
     FROM venues v
     LEFT JOIN cities c ON c.id = v.city_id
     WHERE v.id = $1`,
    [venueId]
  );

  if (!row) {
    const err = `venue ${venueId} not found`;
    await markJobStatus(venueId, "failed", err);
    throw new Error(err);
  }

  const venueData: VenueData = {
    name:     row.name,
    cityName: row.city_name,
    capacity: row.capacity,
    address:  row.address,
  };

  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: buildVenuePrompt(venueData) },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";

  let jsonParsed: unknown;
  try {
    jsonParsed = JSON.parse(raw);
  } catch (e) {
    const err = `invalid JSON from OpenAI: ${e instanceof Error ? e.message : String(e)}`;
    await markJobStatus(venueId, "failed", err);
    throw new Error(`[generate-venue-description] ${err}`);
  }

  const parsed = VenueDescriptionSchema.safeParse(jsonParsed);

  if (!parsed.success) {
    const err = `validation failed: ${parsed.error.message}`;
    await markJobStatus(venueId, "failed", err);
    throw new Error(`[generate-venue-description] ${err}`);
  }

  const { description_es } = parsed.data;

  await query(
    `UPDATE venues SET description_es=$1, content_status='published', updated_at=NOW() WHERE id=$2`,
    [description_es, venueId]
  );

  await markJobStatus(venueId, "done");

  return description_es;
}
