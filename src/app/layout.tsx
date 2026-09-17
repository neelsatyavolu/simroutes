import type { Metadata } from "next";
import { Big_Shoulders, IBM_Plex_Sans_Condensed, Martian_Mono } from "next/font/google";
import "./globals.css";

const display = Big_Shoulders({ variable: "--font-display", subsets: ["latin"], weight: "variable" });
const body = IBM_Plex_Sans_Condensed({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = Martian_Mono({ variable: "--font-mono", subsets: ["latin"], weight: "variable" });

export const metadata: Metadata = {
  title: "SimRoutes",
  description: "Find real-world routes by aircraft type, block time and airport size for your next sim flight.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
