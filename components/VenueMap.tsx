export function VenueMap({
  lat,
  lng,
  name,
  address,
}: {
  lat: number;
  lng: number;
  name: string;
  address?: string | null;
}) {
  const delta = 0.008;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&marker=${lat},${lng}&layers=M`;

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
      <iframe
        title={`Mapa: ${name}`}
        src={src}
        width="100%"
        height="280"
        style={{ border: "none", display: "block" }}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      {address && (
        <div className="flex items-center justify-between px-4 py-3 text-sm text-[var(--color-text-muted)]">
          <span>{address}</span>
          <a
            href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=16`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-3 shrink-0 text-[var(--color-primary)] hover:underline"
          >
            Abrir mapa ↗
          </a>
        </div>
      )}
    </div>
  );
}
