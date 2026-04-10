import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Projektmanager – Norddjurs Kommune",
  description: "Projektoverblik og opgavestyring",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#1D3E47",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <body>{children}</body>
    </html>
  );
}
