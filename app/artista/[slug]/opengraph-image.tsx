import { ImageResponse } from "next/og";
import { getArtistBySlug } from "@/lib/queries/artista";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const artist = await getArtistBySlug(slug);

  const name = artist?.name ?? "Artista";
  const genres = artist?.genres?.slice(0, 3) ?? [];
  const imageUrl = artist?.image_url ?? null;

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
        {/* Background image — right-aligned with gradient fade */}
        {imageUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                height: "100%",
                width: "50%",
                objectFit: "cover",
                objectPosition: "center top",
              }}
            />
            {/* Gradient overlay from left */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(to right, #0d0c0b 45%, transparent 75%)",
              }}
            />
          </>
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
            width: imageUrl ? "65%" : "100%",
          }}
        >
          {/* Top: branding */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "#f5a623", fontWeight: 700, fontSize: "22px" }}>
              TicketHub
            </span>
            <span style={{ color: "#8a857c", fontSize: "22px" }}>.mx</span>
          </div>

          {/* Middle: artist name */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ color: "#8a857c", fontSize: "20px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Conciertos en México
            </div>
            <div
              style={{
                color: "#e8e4dd",
                fontSize: name.length > 20 ? "64px" : "80px",
                fontWeight: 800,
                lineHeight: 1.0,
                letterSpacing: "-0.03em",
              }}
            >
              {name.length > 28 ? name.slice(0, 25) + "…" : name}
            </div>
          </div>

          {/* Bottom: genres */}
          {genres.length > 0 && (
            <div style={{ display: "flex", gap: "12px" }}>
              {genres.map((g) => (
                <div
                  key={g}
                  style={{
                    background: "#1e1c19",
                    border: "1px solid #2a2720",
                    borderRadius: "20px",
                    padding: "8px 18px",
                    color: "#8a857c",
                    fontSize: "18px",
                    textTransform: "capitalize",
                  }}
                >
                  {g}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
