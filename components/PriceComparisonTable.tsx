import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/format";
import type { SourcePlatform } from "@/lib/types";

export interface PriceComparisonRow {
  /** Stable id, e.g. event_source.id */
  id: string;
  platform: SourcePlatform;
  /** Override the platform display name */
  platformLabel?: string;
  minPrice?: number | null;
  maxPrice?: number | null;
  currency?: string;
  url: string;
  isResale?: boolean;
  isSoldOut?: boolean;
  /** Last time prices were refreshed */
  updatedAt?: Date | string;
}

export interface PriceComparisonTableProps {
  rows: PriceComparisonRow[];
  caption?: string;
  className?: string;
}

const platformLabels: Record<SourcePlatform, string> = {
  eventbrite: "Eventbrite",
  boletia: "Boletia",
  superboletos: "Superboletos",
  stubhub: "StubHub",
  ticketmaster: "Ticketmaster",
  songkick: "Songkick",
  manual: "Otro",
};

function lowestPrice(rows: PriceComparisonRow[]): number | null {
  let lowest: number | null = null;
  for (const row of rows) {
    if (row.isSoldOut) continue;
    if (row.minPrice === undefined || row.minPrice === null) continue;
    if (lowest === null || row.minPrice < lowest) {
      lowest = row.minPrice;
    }
  }
  return lowest;
}

export function PriceComparisonTable({
  rows,
  caption,
  className,
}: PriceComparisonTableProps) {
  const cheapest = lowestPrice(rows);
  const hasRows = rows.length > 0;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]",
        className,
      )}
    >
      <div className="hidden md:block">
        <table className="w-full border-collapse text-left">
          {caption ? (
            <caption className="px-5 py-3 text-left text-sm text-[var(--color-text-muted)]">
              {caption}
            </caption>
          ) : null}
          <thead>
            <tr className="border-b border-[var(--color-border)] text-xs uppercase tracking-[var(--tracking-wide)] text-[var(--color-text-muted)]">
              <th scope="col" className="px-5 py-3 font-medium">Fuente</th>
              <th scope="col" className="px-5 py-3 font-medium">Precio</th>
              <th scope="col" className="px-5 py-3 font-medium">Tipo</th>
              <th scope="col" className="px-5 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {hasRows ? (
              rows.map((row) => {
                const isCheapest =
                  cheapest !== null &&
                  !row.isSoldOut &&
                  row.minPrice !== undefined &&
                  row.minPrice !== null &&
                  row.minPrice === cheapest;
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-[var(--color-border-subtle)] last:border-b-0 transition-colors",
                      isCheapest && "bg-[var(--color-primary-soft)]",
                    )}
                  >
                    <td className="px-5 py-4 align-middle">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--color-text)]">
                          {row.platformLabel ?? platformLabels[row.platform]}
                        </span>
                        {isCheapest ? (
                          <Badge tone="primary" variant="solid">
                            Mejor precio
                          </Badge>
                        ) : null}
                      </div>
                      {row.updatedAt ? (
                        <span className="mt-1 block text-xs text-[var(--color-text-muted)]">
                          Actualizado{" "}
                          {new Intl.DateTimeFormat("es-MX", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(
                            typeof row.updatedAt === "string"
                              ? new Date(row.updatedAt)
                              : row.updatedAt,
                          )}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      {row.isSoldOut ? (
                        <Badge tone="error" variant="soft">Agotado</Badge>
                      ) : row.minPrice !== undefined && row.minPrice !== null ? (
                        <div>
                          <div
                            className={cn(
                              "font-semibold",
                              isCheapest
                                ? "text-[var(--color-primary)] font-display text-lg"
                                : "text-[var(--color-text)]",
                            )}
                          >
                            {formatPrice(row.minPrice, row.currency)}
                          </div>
                          {row.maxPrice && row.maxPrice > row.minPrice ? (
                            <div className="text-xs text-[var(--color-text-muted)]">
                              hasta {formatPrice(row.maxPrice, row.currency)}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-sm text-[var(--color-text-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      {row.isResale ? (
                        <Badge tone="warning" variant="soft">Reventa</Badge>
                      ) : (
                        <Badge tone="neutral" variant="soft">Oficial</Badge>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right align-middle">
                      <Button
                        href={row.url}
                        size="sm"
                        variant={isCheapest ? "primary" : "secondary"}
                        rel="noopener nofollow sponsored"
                        target="_blank"
                      >
                        Comprar
                      </Button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-8 text-center text-sm text-[var(--color-text-muted)]"
                >
                  No hay precios disponibles por el momento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden">
        {hasRows ? (
          rows.map((row) => {
            const isCheapest =
              cheapest !== null &&
              !row.isSoldOut &&
              row.minPrice !== undefined &&
              row.minPrice !== null &&
              row.minPrice === cheapest;
            return (
              <li
                key={row.id}
                className={cn(
                  "border-b border-[var(--color-border-subtle)] p-4 last:border-b-0",
                  isCheapest && "bg-[var(--color-primary-soft)]",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-[var(--color-text)]">
                        {row.platformLabel ?? platformLabels[row.platform]}
                      </span>
                      {isCheapest ? (
                        <Badge tone="primary" variant="solid">Mejor precio</Badge>
                      ) : null}
                      {row.isResale ? (
                        <Badge tone="warning" variant="soft">Reventa</Badge>
                      ) : null}
                    </div>
                    <div className="mt-2">
                      {row.isSoldOut ? (
                        <Badge tone="error" variant="soft">Agotado</Badge>
                      ) : row.minPrice !== undefined && row.minPrice !== null ? (
                        <div
                          className={cn(
                            "font-display text-xl font-bold",
                            isCheapest
                              ? "text-[var(--color-primary)]"
                              : "text-[var(--color-text)]",
                          )}
                        >
                          {formatPrice(row.minPrice, row.currency)}
                        </div>
                      ) : (
                        <span className="text-sm text-[var(--color-text-muted)]">
                          Sin precio
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    href={row.url}
                    size="sm"
                    variant={isCheapest ? "primary" : "secondary"}
                    rel="noopener nofollow sponsored"
                    target="_blank"
                  >
                    Ir
                  </Button>
                </div>
              </li>
            );
          })
        ) : (
          <li className="p-6 text-center text-sm text-[var(--color-text-muted)]">
            No hay precios disponibles por el momento.
          </li>
        )}
      </ul>
    </div>
  );
}
