import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

export interface SetlistTrack {
  /** 1-based track position */
  position: number;
  title: string;
  /** Optional duration in seconds */
  durationSeconds?: number;
}

export interface SetlistPreviewProps {
  /** Title shown in header, e.g. "Probable setlist" */
  title?: string;
  tracks: SetlistTrack[];
  /** Reference to the source playlist or setlist */
  sourceLabel?: string;
  sourceUrl?: string;
  /** Limit visible tracks (rest collapses) */
  maxVisible?: number;
  className?: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SetlistPreview({
  title = "Probable setlist",
  tracks,
  sourceLabel,
  sourceUrl,
  maxVisible = 8,
  className,
}: SetlistPreviewProps) {
  const visible = tracks.slice(0, maxVisible);
  const remaining = tracks.length - visible.length;

  if (tracks.length === 0) {
    return null;
  }

  return (
    <Card variant="subtle" padding="md" className={cn("", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {sourceLabel ? (
          sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
            >
              {sourceLabel} ↗
            </a>
          ) : (
            <span className="text-xs text-[var(--color-text-muted)]">
              {sourceLabel}
            </span>
          )
        ) : null}
      </CardHeader>

      <ol className="divide-y divide-[var(--color-border-subtle)]">
        {visible.map((track) => (
          <li
            key={`${track.position}-${track.title}`}
            className="flex items-center gap-3 py-2.5"
          >
            <span className="w-6 shrink-0 text-right text-xs tabular-nums text-[var(--color-text-muted)]">
              {track.position.toString().padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-text)]">
              {track.title}
            </span>
            {track.durationSeconds !== undefined ? (
              <span className="shrink-0 text-xs tabular-nums text-[var(--color-text-muted)]">
                {formatDuration(track.durationSeconds)}
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      {remaining > 0 ? (
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          +{remaining} canciones más
        </p>
      ) : null}
    </Card>
  );
}
