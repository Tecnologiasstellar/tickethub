import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataPill } from "@/components/ui/DataPill";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, formatPrice } from "@/lib/utils/format";

export interface EventHeroProps {
  title: string;
  artistName?: string;
  artistSlug?: string;
  venueName: string;
  venueSlug?: string;
  cityName: string;
  citySlug?: string;
  date: Date | string;
  imageUrl?: string;
  minPrice?: number;
  currency?: string;
  primaryCtaHref?: string;
  primaryCtaLabel?: string;
  secondaryAction?: ReactNode;
  badges?: ReactNode;
  className?: string;
  variant?: "tier1" | "tier2";
}

export function EventHero({
  title,
  artistName,
  artistSlug,
  venueName,
  venueSlug,
  cityName,
  citySlug,
  date,
  imageUrl,
  minPrice,
  currency,
  primaryCtaHref,
  primaryCtaLabel = "Ver precios",
  secondaryAction,
  badges,
  className,
  variant = "tier1",
}: EventHeroProps) {
  const isTier2 = variant === "tier2";
  const artistBadge = artistName ? (
    <Badge tone="primary" variant="soft">
      {artistSlug ? (
        <a href={`/artista/${artistSlug}`} className="hover:underline">
          {artistName}
        </a>
      ) : (
        artistName
      )}
    </Badge>
  ) : null;
  const venueDisplay = venueSlug ? (
    <a href={`/venue/${venueSlug}`} className="hover:text-[var(--color-primary)] hover:underline">
      {venueName}
    </a>
  ) : (
    venueName
  );
  const cityDisplay = citySlug ? (
    <a href={`/ciudad/${citySlug}`} className="hover:text-[var(--color-primary)] hover:underline">
      {cityName}
    </a>
  ) : (
    cityName
  );

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)]",
        className,
      )}
    >
      {!isTier2 && imageUrl ? (
        <>
          <div
            aria-hidden
            className="absolute inset-0 bg-cover bg-center opacity-40"
            style={{ backgroundImage: `url(${imageUrl})` }}
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-[var(--color-background)] via-[var(--color-background)]/85 to-[var(--color-background)]/30"
          />
        </>
      ) : null}

      <div
        className={cn(
          "relative grid gap-8 md:grid-cols-[1fr_auto] md:items-end",
          isTier2 ? "p-6 md:p-8" : "p-6 md:p-10",
        )}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {artistBadge}
            {badges}
          </div>

          <h1
            className={cn(
              "font-display mt-4 font-bold leading-[var(--leading-tight)] text-[var(--color-text)]",
              isTier2 ? "text-2xl md:text-3xl" : "text-3xl md:text-5xl",
            )}
          >
            {title}
          </h1>

          <p className="mt-3 text-[var(--color-text-muted)] md:text-lg">
            {venueDisplay} · {cityDisplay}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {formatDateTime(date)}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <DataPill
              label="Fecha"
              value={formatDateTime(date)}
            />
            <DataPill
              label="Ciudad"
              value={cityName}
              hint={venueName}
            />
            {minPrice !== undefined ? (
              <DataPill
                label="Desde"
                value={
                  <span className="text-[var(--color-primary)]">
                    {formatPrice(minPrice, currency)}
                  </span>
                }
              />
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-3 md:items-end">
          {primaryCtaHref ? (
            <Button href={primaryCtaHref} size="lg" variant="primary">
              {primaryCtaLabel}
            </Button>
          ) : null}
          {secondaryAction}
        </div>
      </div>
    </section>
  );
}
