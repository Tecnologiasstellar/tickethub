import Link from "next/link";

export function Navbar() {
  return (
    <nav
      className="sticky top-0 z-[var(--z-header)] border-b border-[var(--color-border)] bg-[var(--color-background)]/90 backdrop-blur"
      aria-label="Navegación principal"
    >
      <div className="mx-auto flex h-[var(--header-height)] max-w-[var(--container-max)] items-center justify-between px-4">
        <Link href="/" className="font-display text-xl font-bold text-[var(--color-primary)]">
          TicketHub<span className="text-[var(--color-text-muted)]">.mx</span>
        </Link>
        <div className="flex items-center gap-1 text-sm">
          <Link
            href="/"
            className="rounded-[var(--radius-sm)] px-3 py-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
          >
            Inicio
          </Link>
        </div>
      </div>
    </nav>
  );
}
