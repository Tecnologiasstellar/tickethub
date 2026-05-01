export const revalidate = 1800;

export default function HomePage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <section className="mx-auto max-w-5xl px-4 py-20 text-center">
        <h1
          className="font-display text-4xl font-bold md:text-6xl"
          style={{ color: "var(--text)" }}
        >
          Compara boletos en{" "}
          <span style={{ color: "var(--primary)" }}>un solo lugar</span>
        </h1>
        <p
          className="mt-6 text-lg md:text-xl"
          style={{ color: "var(--muted)" }}
        >
          Conciertos, festivales y eventos en México. Encuentra el precio más
          bajo entre Boletia, Eventbrite, Superboletos y más.
        </p>
      </section>
    </main>
  );
}
