import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";

export interface TourStop {
  id: string;
  date: Date | string;
  venueName: string;
  cityName: string;
  countryCode?: string;
  /** True for events that have not yet happened */
  upcoming?: boolean;
  /** Optional href to event page */
  href?: string;
}

export interface TourHistoryTimelineProps {
  title?: string;
  stops: TourStop[];
  /** Show no more than N stops; rest collapses */
  maxVisible?: number;
  className?: string;
}

export function TourHistoryTimeline({
  title = "Historial de gira",
  stops,
  maxVisible = 6,
  className,
}: TourHistoryTimelineProps) {
  if (stops.length === 0) return null;

  const visible = stops.slice(0, maxVisible);
  const remaining = stops.length - visible.length;

  return (
    <Card variant="subtle" padding="md" className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <span className="text-xs text-[var(--color-text-muted)]">
          {stops.length} fechas
        </span>
      </CardHeader>

      <ol className="relative ml-2 border-l border-[var(--color-border)] pl-5">
        {visible.map((stop) => (
          <li key={stop.id} className="relative pb-4 last:pb-0">
            <span
              aria-hidden
              className={cn(
                "absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-[var(--color-background)]",
                stop.upcoming
                  ? "bg-[var(--color-primary)]"
                  : "bg-[var(--color-border-strong)]",
              )}
            />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-[var(--tracking-wide)] text-[var(--color-text-muted)]">
                    {formatDate(stop.date)}
                  </span>
                  {stop.upcoming ? (
                    <Badge tone="primary" variant="soft">Próximo</Badge>
                  ) : null}
                </div>
                <div className="mt-1 text-sm text-[var(--color-text)]">
                  {stop.href ? (
                    <a
                      href={stop.href}
                      className="hover:text-[var(--color-primary)]"
                    >
                      {stop.venueName}
                    </a>
                  ) : (
                    stop.venueName
                  )}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {stop.cityName}
                  {stop.countryCode ? `, ${stop.countryCode}` : ""}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {remaining > 0 ? (
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          +{remaining} fechas más
        </p>
      ) : null}
    </Card>
  );
}
