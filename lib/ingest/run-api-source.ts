import { ingestNormalizedEvent } from "../dedupe/ingest";
import type { NormalizedEvent } from "../types";

export interface SourceStats {
  fetched: number;
  skipped: number;
  created: number;
  merged: number;
  ambiguous: number;
  tribute_rejected: number;
  unknown_city: number;
  errors: number;
}

export async function runApiSource<T>(options: {
  tag: string;
  events: AsyncIterable<T>;
  normalize: (ev: T) => NormalizedEvent | null;
  limit?: number;
  dryRun?: boolean;
}): Promise<SourceStats> {
  const { tag, events, normalize, limit = Infinity, dryRun = false } = options;
  const stats: SourceStats = {
    fetched: 0, skipped: 0, created: 0, merged: 0,
    ambiguous: 0, tribute_rejected: 0, unknown_city: 0, errors: 0,
  };

  for await (const ev of events) {
    if (stats.fetched >= limit) break;
    stats.fetched++;

    const normalized = normalize(ev);
    if (!normalized) { stats.skipped++; continue; }

    if (dryRun) {
      console.log(
        `[${tag}] would ingest: "${normalized.title}" (${normalized.cityName}, ${normalized.date.toISOString().slice(0, 10)})`
      );
      continue;
    }

    try {
      const result = await ingestNormalizedEvent(normalized);
      console.log(result.log);
      switch (result.action) {
        case "created":               stats.created++; break;
        case "merged":                stats.merged++; break;
        case "ambiguous_skipped":     stats.ambiguous++; break;
        case "rejected_tribute":      stats.tribute_rejected++; break;
        case "rejected_unknown_city": stats.unknown_city++; break;
      }
    } catch (err) {
      stats.errors++;
      console.error(
        `[${tag}] error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return stats;
}

export function statsLine(tag: string, s: SourceStats): string {
  return (
    `[${tag}] fetched=${s.fetched} skipped=${s.skipped} ` +
    `created=${s.created} merged=${s.merged} ambiguous=${s.ambiguous} ` +
    `tribute_rejected=${s.tribute_rejected} unknown_city=${s.unknown_city} errors=${s.errors}`
  );
}
