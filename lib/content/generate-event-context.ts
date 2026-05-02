// lib/content/generate-event-context.ts
import OpenAI from "openai";
import { z } from "zod";
import { query, queryOne } from "../db";
import {
  SYSTEM_PROMPT,
  buildEventPrompt,
  type EventData,
} from "./prompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EventContentSchema = z.object({
  seo_title:       z.string().min(10).max(60),
  seo_description: z.string().min(20).max(160),
  h1_title:        z.string().min(10).max(100),
  context_text:    z.string().min(50).max(300),
  faq: z.array(
    z.object({
      question: z.string().min(5),
      answer:   z.string().min(5),
    })
  ).length(3),
});

type EventContent = z.infer<typeof EventContentSchema>;

async function markJobStatus(
  eventId: string,
  jobType: string,
  status: "processing" | "done" | "failed",
  lastError?: string
) {
  await query(
    `UPDATE content_jobs
     SET status=$1, last_error=$2,
         attempts = CASE WHEN $1 = 'processing' THEN attempts+1 ELSE attempts END,
         updated_at=NOW()
     WHERE entity_type='event' AND entity_id=$3 AND job_type=$4`,
    [status, lastError ?? null, eventId, jobType]
  );
}

export async function generateEventContext(eventId: string): Promise<EventContent> {
  const JOB_TYPE = "event_context";

  await markJobStatus(eventId, JOB_TYPE, "processing");

  const row = await queryOne<{
    title: string;
    date: Date;
    artist_name: string | null;
    genres: string[] | null;
    venue_name: string | null;
    city_name: string | null;
    min_price: number | null;
    max_price: number | null;
    currency: string | null;
  }>(
    `SELECT
       e.title,
       e.date,
       a.name  AS artist_name,
       a.genres,
       v.name  AS venue_name,
       c.name  AS city_name,
       (SELECT MIN(ps.min_price) FROM price_snapshots ps
        JOIN event_sources es ON es.id = ps.event_source_id
        WHERE es.event_id = e.id) AS min_price,
       (SELECT MAX(ps.max_price) FROM price_snapshots ps
        JOIN event_sources es ON es.id = ps.event_source_id
        WHERE es.event_id = e.id) AS max_price,
       (SELECT ps.currency FROM price_snapshots ps
        JOIN event_sources es ON es.id = ps.event_source_id
        WHERE es.event_id = e.id LIMIT 1) AS currency
     FROM events e
     LEFT JOIN artists a ON a.id = e.artist_id
     LEFT JOIN venues  v ON v.id = e.venue_id
     LEFT JOIN cities  c ON c.id = e.city_id
     WHERE e.id = $1`,
    [eventId]
  );

  if (!row) {
    const err = `event ${eventId} not found`;
    await markJobStatus(eventId, JOB_TYPE, "failed", err);
    throw new Error(err);
  }

  const eventData: EventData = {
    title:      row.title,
    artistName: row.artist_name ?? row.title,
    venueName:  row.venue_name  ?? "Recinto por confirmar",
    cityName:   row.city_name   ?? "México",
    dateIso:    new Date(row.date).toISOString().slice(0, 10),
    genres:     row.genres,
    minPrice:   row.min_price,
    maxPrice:   row.max_price,
    currency:   row.currency,
  };

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: buildEventPrompt(eventData) },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  let jsonParsed: unknown;
  try {
    jsonParsed = JSON.parse(raw);
  } catch (e) {
    const err = `invalid JSON from OpenAI: ${e instanceof Error ? e.message : String(e)}`;
    await markJobStatus(eventId, JOB_TYPE, "failed", err);
    throw new Error(`[generate-event-context] ${err}`);
  }
  const parsed = EventContentSchema.safeParse(jsonParsed);

  if (!parsed.success) {
    const err = `validation failed: ${parsed.error.message}`;
    await markJobStatus(eventId, JOB_TYPE, "failed", err);
    throw new Error(`[generate-event-context] ${err}`);
  }

  const content = parsed.data;

  await query(
    `UPDATE events
     SET seo_title=$1, seo_description=$2, h1_title=$3, context_text=$4,
         faq_json=$5, content_status='published', updated_at=NOW()
     WHERE id=$6`,
    [
      content.seo_title,
      content.seo_description,
      content.h1_title,
      content.context_text,
      JSON.stringify(content.faq),
      eventId,
    ]
  );

  await markJobStatus(eventId, JOB_TYPE, "done");

  return content;
}
