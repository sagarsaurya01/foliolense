import type { Metadata } from "next";
import { cookies } from "next/headers";
import { IBM_Plex_Mono, IBM_Plex_Sans, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

const display = Schibsted_Grotesk({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-display" });
const body = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });
const num = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-num" });

export const metadata: Metadata = {
  title: "FolioLense",
  description: "Family portfolio tracker",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // "light" / "dark" pin the theme; no cookie (or "system") follows the computer's setting
  const theme = (await cookies()).get("theme")?.value;
  return (
    <html
      lang="en-IN"
      className={`${display.variable} ${body.variable} ${num.variable}`}
      data-theme={theme === "light" || theme === "dark" ? theme : undefined}
    >
      <body>{children}</body>
    </html>
  );
}
