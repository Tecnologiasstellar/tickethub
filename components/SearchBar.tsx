"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function SearchBar({
  placeholder = "Busca artistas, eventos o ciudades…",
}: {
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    window.location.href = `/buscar?q=${encodeURIComponent(q)}`;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-2xl gap-2"
      role="search"
      aria-label="Buscar eventos"
    >
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={placeholder}
        className="h-12 flex-1 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-base text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-ring)]"
      />
      <Button type="submit" size="lg" variant="primary">
        Buscar
      </Button>
    </form>
  );
}
