import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "error"
  | "info";

export type BadgeVariant = "soft" | "solid" | "outline";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  icon?: ReactNode;
  children: ReactNode;
}

const toneStyles: Record<BadgeTone, { soft: string; solid: string; outline: string }> = {
  neutral: {
    soft: "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
    solid: "bg-[var(--color-text-muted)] text-[var(--color-background)]",
    outline:
      "border border-[var(--color-border)] text-[var(--color-text-muted)]",
  },
  primary: {
    soft: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
    solid: "bg-[var(--color-primary)] text-[var(--color-text-on-primary)]",
    outline:
      "border border-[var(--color-primary)] text-[var(--color-primary)]",
  },
  success: {
    soft: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
    solid: "bg-[var(--color-success)] text-[var(--color-background)]",
    outline:
      "border border-[var(--color-success)] text-[var(--color-success)]",
  },
  warning: {
    soft: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
    solid: "bg-[var(--color-warning)] text-[var(--color-background)]",
    outline:
      "border border-[var(--color-warning)] text-[var(--color-warning)]",
  },
  error: {
    soft: "bg-[var(--color-error-soft)] text-[var(--color-error)]",
    solid: "bg-[var(--color-error)] text-white",
    outline:
      "border border-[var(--color-error)] text-[var(--color-error)]",
  },
  info: {
    soft: "bg-[var(--color-info-soft)] text-[var(--color-info)]",
    solid: "bg-[var(--color-info)] text-[var(--color-background)]",
    outline:
      "border border-[var(--color-info)] text-[var(--color-info)]",
  },
};

export function Badge({
  tone = "neutral",
  variant = "soft",
  icon,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-medium leading-none",
        toneStyles[tone][variant],
        className,
      )}
      {...rest}
    >
      {icon ? <span aria-hidden className="inline-flex">{icon}</span> : null}
      {children}
    </span>
  );
}
