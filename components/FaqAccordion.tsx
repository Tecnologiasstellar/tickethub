export interface FaqItem {
  question: string;
  answer: string;
}

export function FaqAccordion({
  faqs,
  title = "Preguntas frecuentes",
}: {
  faqs: FaqItem[];
  title?: string;
}) {
  if (!faqs.length) return null;
  return (
    <section aria-labelledby="faq-heading">
      <h2
        id="faq-heading"
        className="font-display mb-4 text-xl font-bold text-[var(--color-text)]"
      >
        {title}
      </h2>
      <dl className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
        {faqs.map((faq, i) => (
          <details
            key={i}
            className="group border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)] last:border-b-0"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 transition-colors hover:bg-[var(--color-surface-2)]">
              <dt className="text-sm font-medium text-[var(--color-text)]">
                {faq.question}
              </dt>
              <span
                aria-hidden
                className="ml-3 shrink-0 text-[var(--color-text-muted)] transition-transform duration-[var(--duration-fast)] group-open:rotate-180"
              >
                ▾
              </span>
            </summary>
            <dd className="px-5 pb-4 pt-1 text-sm leading-[var(--leading-relaxed)] text-[var(--color-text-muted)]">
              {faq.answer}
            </dd>
          </details>
        ))}
      </dl>
    </section>
  );
}
