import type { Metadata } from "next";
import { Inter, Syne } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "TicketHub.mx — Compara boletos para eventos en México",
    template: "%s | TicketHub.mx",
  },
  description:
    "Compara precios de boletos en Boletia, Eventbrite, Superboletos, StubHub y más. Encuentra el mejor precio para conciertos, festivales y eventos en México.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://tickethub.mx"
  ),
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: "TicketHub.mx",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.variable} ${syne.variable}`}>
      <body>
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
