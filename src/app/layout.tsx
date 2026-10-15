import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import AppShell from "@/components/AppShell";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "EggDrop",
  description: "Find AR eggs near local businesses and redeem the reward inside.",
  applicationName: "EggDrop",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "EggDrop" },
  formatDetection: { telephone: false },
  other: { "mobile-web-app-capable": "yes" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#FFC93C",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>
          <Suspense fallback={<div className="screen"><p className="sub">Loading…</p></div>}>{children}</Suspense>
        </AppShell>
        <PwaRegister />
      </body>
    </html>
  );
}
