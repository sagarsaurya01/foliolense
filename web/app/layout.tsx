import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted (via @fontsource) so the production build never fetches Google Fonts at build time —
// that fetch is unreliable from the build host and was failing the deploy.
// next/font requires every value here to be an explicitly written literal (no variables/templates).
const display = localFont({
  variable: "--font-display",
  display: "swap",
  src: [
    { path: "../node_modules/@fontsource/schibsted-grotesk/files/schibsted-grotesk-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../node_modules/@fontsource/schibsted-grotesk/files/schibsted-grotesk-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "../node_modules/@fontsource/schibsted-grotesk/files/schibsted-grotesk-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
});
const body = localFont({
  variable: "--font-body",
  display: "swap",
  src: [
    { path: "../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
});
const num = localFont({
  variable: "--font-num",
  display: "swap",
  src: [
    { path: "../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "FolioLense",
  description: "Family portfolio tracker",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${display.variable} ${body.variable} ${num.variable}`}>
      <body>{children}</body>
    </html>
  );
}
