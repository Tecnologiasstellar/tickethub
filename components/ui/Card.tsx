import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type CardVariant = "default" | "elevated" | "subtle" | "outline";
type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  interactive?: boolean;
  as?: "div" | "article" | "section";
  children: ReactNode;
}

const variantStyles: Record<CardVariant, string> = {
  default:
    "bg-[var(--color-surface)] border border-[var(--color-border)]",
  elevated:
    "bg-[var(--color-surface-2)] border border-[var(--color-border)] shadow-[var(--shadow-md)]",
  subtle:
    "bg-[var(--color-surface-2)] border border-[var(--color-border-subtle)]",
  outline:
    "bg-transparent border border-[var(--color-border)]",
};

const paddingStyles: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-6 md:p-8",
};

export function Card({
  variant = "default",
  padding = "md",
  interactive,
  as = "div",
  className,
  children,
  ...rest
}: CardProps) {
  const Component = as;
  return (
    <Component
      className={cn(
        "rounded-[var(--radius-lg)] transition-colors transition-shadow",
        variantStyles[variant],
        paddingStyles[padding],
        interactive &&
          "cursor-pointer hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]",
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}

export function CardHeader({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-3 flex items-start justify-between gap-3", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "font-display text-lg font-semibold leading-[var(--leading-snug)] text-[var(--color-text)]",
        className,
      )}
      {...rest}
    >
      {children}
    </h3>
  );
}

export function CardFooter({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mt-4 flex items-center justify-between gap-3 border-t border-[var(--color-border-subtle)] pt-4",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
