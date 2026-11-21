import type { Metadata, Viewport } from "next";
import { DemoBanner } from "@/components/DemoBanner";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { BRAND } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: `${BRAND.name} — Luxury Airport Transfers & Chauffeur Service`,
    template: `%s · ${BRAND.name}`,
  },
  description: `${BRAND.tagline} Flat rates to DCA, IAD, BWI and Union Station, live flight tracking and 24/7 professional chauffeurs.`,
  openGraph: {
    title: `${BRAND.name} — Luxury Airport Transfers`,
    description: BRAND.tagline,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <DemoBanner />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
