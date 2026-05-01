const fmt = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export function buildEventFaqs(data: {
  title: string;
  artistName?: string | null;
  date: string;
  venueName?: string | null;
  cityName?: string | null;
  minPrice?: number;
}): Array<{ question: string; answer: string }> {
  const dateStr = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(data.date));

  const faqs: Array<{ question: string; answer: string }> = [];

  if (data.venueName && data.cityName) {
    faqs.push({
      question: `¿Dónde es ${data.title}?`,
      answer: `El evento se realiza en ${data.venueName}, ${data.cityName}.`,
    });
  }

  faqs.push({
    question: `¿Cuándo es ${data.title}?`,
    answer: `${data.title} es el ${dateStr}.`,
  });

  if (data.minPrice != null) {
    faqs.push({
      question: `¿Cuánto cuestan los boletos para ${data.artistName ?? data.title}?`,
      answer: `El precio mínimo actual es desde ${fmt.format(data.minPrice)}. Los precios varían según la categoría y la plataforma de compra.`,
    });
  }

  faqs.push({
    question: "¿Dónde puedo comprar los boletos?",
    answer:
      "En TicketHub.mx comparamos precios de múltiples plataformas oficiales y de reventa. Consulta la tabla de precios para ir directamente al sitio de compra que mejor te convenga.",
  });

  return faqs;
}
