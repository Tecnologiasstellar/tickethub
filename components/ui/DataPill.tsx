import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface DataPillProps extends HTMLAttributes<HTMLDivElement> {
  /** Short uppercase label, e.g. "Capacidad" */
  label: string;
  /** Primary value, can be a number, date, formatted price, etc. */
  value: ReactNode;
  /** Optional secondary line shown below the value */
  hint?: ReactNode;
  /** Optional leading icon */
  icon?: ReactNode;
  /** Render compactly inside dense rows */
  compact?: boolean;
}

export function DataPill({
  label,
  value,
  hint,
  icon,
  compact,
  className,
  ...rest
}: DataPillProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)]",
        compact ? "px-3 py-2" : "px-4 py-3",
        className,
      )}
      {...rest}
    >
      {icon ? (
        <span
          aria-hidden
          className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center text-[var(--color-text-muted)]"
        >
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium uppercase tracking-[var(--tracking-wide)] text-[var(--color-text-muted)]">
          {label}
        </div>
        <div className="mt-0.5 truncate text-sm font-semibold text-[var(--color-text)]">
          {value}
        </div>
        {hint ? (
          <div className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
            {hint}
          </div>
        ) : null}
      </div>
    </div>
  );
}
