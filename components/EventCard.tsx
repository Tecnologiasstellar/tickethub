import type { HTMLAttributes } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { formatDate, formatPrice } from "@/lib/utils/format";

export type EventAvailability = "available" | "low_stock" | "sold_out" | "cancelled" | "past";

export interface EventCardProps extends HTMLAttributes<HTMLAnchorElement> {
  href: string;
  title: string;
  artistName?: string;
  venueName: string;
  cityName: string;
  date: Date | string;
  imageUrl?: string;
  /** Lowest price across all sources */
  minPrice?: number;
  currency?: string;
  /** Number of distinct sources comparing prices */
  sourceCount?: number;
  availability?: EventAvailability;
}

const availabilityCopy: Record<EventAvailability, { label: string; tone: "success" | "warning" | "error" | "neutral" }> = {
  available: { label: "Disponible", tone: "success" },
  low_stock: { label: "Pocos boletos", tone: "warning" },
  sold_out: { label: "Agotado", tone: "error" },
  cancelled: { label: "Cancelado", tone: "error" },
  past: { label: "Finalizado", tone: "neutral" },
};

export function EventCard({
  href,
  title,
  artistName,
  venueName,
  cityName,
  date,
  imageUrl,
  minPrice,
  currency,
  sourceCount,
  availability = "available",
  className,
  ...rest
}: EventCardProps) {
  const status = availabilityCopy[availability];
  const dim = availability === "sold_out" || availability === "cancelled" || availability === "past";

  return (
    <a
      href={href}
      className={cn(
        "group block focus-visible:outline-none",
        className,
      )}
      {...rest}
    >
      <Card
        variant="default"
        padding="none"
        interactive
        className={cn(
          "overflow-hidden h-full flex flex-col group-hover:border-[var(--color-primary)]",
          dim && "opacity-70",
        )}
      >
        <div
          className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--color-surface-2)]"
          aria-hidden={!imageUrl}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote image hosts not yet configured in next.config
            <img
              src={imageUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-[var(--duration-slow)] group-hover:scale-[1.03]"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-[var(--color-surface-2)] to-[var(--color-surface-3)]" />
          )}
          <div className="absolute left-3 top-3">
            <Badge tone={status.tone} variant="soft">
              {status.label}
            </Badge>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-4">
          <CardHeader className="mb-2">
            <CardTitle className="line-clamp-2">{title}</CardTitle>
          </CardHeader>

          {artistName ? (
            <p className="text-sm text-[var(--color-text-muted)] line-clamp-1">
              {artistName}
            </p>
          ) : null}

          <p className="mt-2 text-sm text-[var(--color-text-muted)] line-clamp-1">
            {venueName} · {cityName}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text)]">
            {formatDate(date)}
          </p>

          <div className="mt-auto" />

          <CardFooter className="mt-4">
            <div className="min-w-0">
              {minPrice !== undefined ? (
                <>
                  <span className="text-[10px] uppercase tracking-[var(--tracking-wide)] text-[var(--color-text-muted)]">
                    Desde
                  </span>
                  <div className="font-display text-xl font-bold text-[var(--color-primary)]">
                    {formatPrice(minPrice, currency)}
                  </div>
                </>
              ) : (
                <span className="text-sm text-[var(--color-text-muted)]">
                  Precio no disponible
                </span>
              )}
            </div>
            {sourceCount && sourceCount > 1 ? (
              <Badge tone="primary" variant="soft">
                {sourceCount} fuentes
              </Badge>
            ) : null}
          </CardFooter>
        </div>
      </Card>
    </a>
  );
}
