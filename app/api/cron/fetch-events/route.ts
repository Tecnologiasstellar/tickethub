import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/utils/cron";
import { EventbriteClient } from "@/lib/api/eventbrite/client";
import { normalizeEventbriteEvent } from "@/lib/api/eventbrite/normalizer";
import { SongkickClient } from "@/lib/api/songkick/client";
import { normalizeSongkickEvent } from "@/lib/api/songkick/normalizer";
import { StubHubClient } from "@/lib/api/stubhub/client";
import { normalizeStubHubEvent } from "@/lib/api/stubhub/normalizer";
import { runApiSource, statsLine, type SourceStats } from "@/lib/ingest/run-api-source";

const EVENTS_PER_RUN = parseInt(process.env.EVENTS_PER_RUN ?? "50", 10) || 50;

function mergeStats(a: SourceStats, b: SourceStats): SourceStats {
  return {
    fetched:          a.fetched          + b.fetched,
    skipped:          a.skipped          + b.skipped,
    created:          a.created          + b.created,
    merged:           a.merged           + b.merged,
    ambiguous:        a.ambiguous        + b.ambiguous,
    tribute_rejected: a.tribute_rejected + b.tribute_rejected,
    unknown_city:     a.unknown_city     + b.unknown_city,
    errors:           a.errors           + b.errors,
  };
}

export async function POST(req: NextRequest) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  try {
    let total: SourceStats = {
      fetched: 0, skipped: 0, created: 0, merged: 0,
      ambiguous: 0, tribute_rejected: 0, unknown_city: 0, errors: 0,
    };
    const sources: string[] = [];
    const skippedSources: string[] = [];

    // ─── Eventbrite ────────────────────────────────────────────────
    const ebKey = process.env.EVENTBRITE_API_KEY;
    if (ebKey) {
      const client = new EventbriteClient(ebKey);
      const stats = await runApiSource({
        tag: "eventbrite",
        events: client.allMexicoEvents(),
        normalize: normalizeEventbriteEvent,
        limit: EVENTS_PER_RUN,
      });
      sources.push(statsLine("eventbrite", stats));
      total = mergeStats(total, stats);
    } else {
      console.warn("[fetch-events] EVENTBRITE_API_KEY not set — skipping");
      skippedSources.push("eventbrite");
    }

    // ─── Songkick ──────────────────────────────────────────────────
    const skKey = process.env.SONGKICK_API_KEY;
    if (skKey) {
      const client = new SongkickClient(skKey);
      const stats = await runApiSource({
        tag: "songkick",
        events: client.allMexicoEvents(),
        normalize: normalizeSongkickEvent,
        limit: EVENTS_PER_RUN,
      });
      sources.push(statsLine("songkick", stats));
      total = mergeStats(total, stats);
    } else {
      console.warn("[fetch-events] SONGKICK_API_KEY not set — skipping");
      skippedSources.push("songkick");
    }

    // ─── StubHub ───────────────────────────────────────────────────
    const shId = process.env.STUBHUB_CLIENT_ID;
    const shSecret = process.env.STUBHUB_CLIENT_SECRET;
    if (shId && shSecret) {
      const client = new StubHubClient(shId, shSecret);
      const stats = await runApiSource({
        tag: "stubhub",
        events: client.mexicoConcerts(EVENTS_PER_RUN),
        normalize: normalizeStubHubEvent,
        limit: EVENTS_PER_RUN,
      });
      sources.push(statsLine("stubhub", stats));
      total = mergeStats(total, stats);
    } else {
      console.warn("[fetch-events] STUBHUB_CLIENT_ID or STUBHUB_CLIENT_SECRET not set — skipping");
      skippedSources.push("stubhub");
    }

    return NextResponse.json({
      ok: true,
      eventsPerRun: EVENTS_PER_RUN,
      sources,
      skippedSources,
      total,
    });
  } catch (err) {
    console.error("[fetch-events] unhandled error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
