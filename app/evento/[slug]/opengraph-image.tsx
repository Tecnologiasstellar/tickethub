import { ImageResponse } from "next/og";
import { getEventBySlug } from "@/lib/queries/evento";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  const title = event?.seo_title ?? event?.title ?? "Evento en México";
  const date = event?.date
    ? new Intl.DateTimeFormat("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "America/Mexico_City",
      }).format(new Date(event.date))
    : null;
  const venue = event?.venue_name ?? null;
  const city = event?.city_name ?? null;
  const imageUrl = event?.image_url ?? event?.artist_image_url ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "1200px",
          height: "630px",
          background: "#0d0c0b",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background image with overlay */}
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.18,
            }}
          />
        )}

        {/* Left amber accent bar */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "6px",
            background: "#f5a623",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "60px 72px",
            width: "100%",
          }}
        >
          {/* Top: branding */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "#f5a623", fontWeight: 700, fontSize: "22px" }}>
              TicketHub
            </span>
            <span style={{ color: "#8a857c", fontSize: "22px" }}>.mx</span>
          </div>

          {/* Middle: title */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                color: "#e8e4dd",
                fontSize: title.length > 40 ? "52px" : "64px",
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
              }}
            >
              {title.length > 60 ? title.slice(0, 57) + "…" : title}
            </div>
            {date && (
              <div style={{ color: "#f5a623", fontSize: "28px", fontWeight: 600 }}>
                {date}
              </div>
            )}
          </div>

          {/* Bottom: venue + city */}
          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            {venue && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#8a857c",
                  }}
                />
                <span style={{ color: "#8a857c", fontSize: "22px" }}>{venue}</span>
              </div>
            )}
            {city && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#8a857c",
                  }}
                />
                <span style={{ color: "#8a857c", fontSize: "22px" }}>{city}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
