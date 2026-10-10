import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Big_Shoulders, IBM_Plex_Sans_Condensed, Martian_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const display = Big_Shoulders({ variable: "--font-display", subsets: ["latin"], weight: "variable" });
const body = IBM_Plex_Sans_Condensed({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = Martian_Mono({ variable: "--font-mono", subsets: ["latin"], weight: "variable" });

const SITE_URL = "https://simroutes.n3el.dev/";
const DESCRIPTION = "Find real-world routes by aircraft type, block time and airport size for your next sim flight.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "SimRoutes",
  description: DESCRIPTION,
  // The image tags come from opengraph-image.png and its alt.txt beside this file.
  openGraph: {
    title: "SimRoutes — Real-world routes for your next sim flight",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "SimRoutes",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <ClerkProvider>{children}</ClerkProvider>
        {/* Anonymous, cookieless page-view counter; see README "Privacy & analytics". */}
        <Script src="https://analytics.n3el.dev/p.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
