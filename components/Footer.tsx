import Link from "next/link";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-[var(--container-max)] px-4 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md">
            <p className="font-display text-lg font-bold text-[var(--color-primary)]">TicketHub.mx</p>
            <p className="mt-2 text-sm text-[var(--color-text-muted)] leading-relaxed">
              Somos un agregador independiente de boletos para eventos en México.{" "}
              <strong className="text-[var(--color-text)]">No vendemos boletos directamente.</strong>{" "}
              Los enlaces de compra te dirigen a las plataformas oficiales o de reventa correspondientes.
              Los precios mostrados pueden variar y no garantizamos disponibilidad.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--color-text-muted)]">
            <Link href="/" className="hover:text-[var(--color-text)] transition-colors">Inicio</Link>
          </nav>
        </div>
        <p className="mt-8 text-xs text-[var(--color-text-subtle)]">© {year} TicketHub.mx — Comparador independiente de boletos.</p>
      </div>
    </footer>
  );
}
