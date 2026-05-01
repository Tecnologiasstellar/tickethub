"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/format";

export interface StickyMobileCTAProps {
  href: string;
  label?: string;
  /** Lowest available price across sources */
  minPrice?: number;
  currency?: string;
  /** Short caption above price, e.g. "Mejor precio" */
  caption?: string;
  /** Hide on desktop via the `md:` breakpoint when true (default) */
  mobileOnly?: boolean;
}

/**
 * Fixed bottom CTA visible on mobile. Hides when the user scrolls
 * down (out of the way) and reappears on scroll up so it never
 * blocks content while reading.
 */
export function StickyMobileCTA({
  href,
  label = "Ver precios",
  minPrice,
  currency,
  caption = "Desde",
  mobileOnly = true,
}: StickyMobileCTAProps) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        const goingDown = y > lastY + 6;
        const goingUp = y < lastY - 6;
        if (goingDown && y > 240) setHidden(true);
        else if (goingUp) setHidden(false);
        lastY = y;
        frame = 0;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <div
        aria-hidden
        className={cn(
          "h-[var(--sticky-cta-height)]",
          mobileOnly && "md:hidden",
        )}
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      />
      <div
        role="region"
        aria-label="Comprar boletos"
        className={cn(
          "fixed inset-x-0 bottom-0 z-[var(--z-sticky-cta)] border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur",
          "transition-transform duration-[var(--duration-base)] ease-[var(--ease-standard)]",
          hidden ? "translate-y-full" : "translate-y-0",
          mobileOnly && "md:hidden",
        )}
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <span className="text-[10px] uppercase tracking-[var(--tracking-wide)] text-[var(--color-text-muted)]">
              {caption}
            </span>
            {minPrice !== undefined ? (
              <div className="font-display text-xl font-bold text-[var(--color-primary)]">
                {formatPrice(minPrice, currency)}
              </div>
            ) : (
              <div className="text-sm text-[var(--color-text-muted)]">
                Sin precio
              </div>
            )}
          </div>
          <Button href={href} size="md" variant="primary">
            {label}
          </Button>
        </div>
      </div>
    </>
  );
}
