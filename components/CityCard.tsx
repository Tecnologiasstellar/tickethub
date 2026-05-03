import { Badge } from "@/components/ui/Badge";

export function CityCard({ name, slug, eventCount }: { name: string; slug: string; eventCount: number }) {
  return (
    <a href={`/ciudad/${slug}`}
      className="group flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-2)]">
      <span className="font-display font-semibold text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">{name}</span>
      {eventCount > 0
        ? <Badge tone="primary" variant="soft">{eventCount} evento{eventCount !== 1 ? "s" : ""}</Badge>
        : <Badge tone="neutral" variant="soft">Próximamente</Badge>}
    </a>
  );
}
