import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#7C3AED",
};

export const metadata: Metadata = {
  title: "GachaDash — Tu Centro de Eventos Gacha",
  description:
    "Centraliza y organiza eventos de tiempo limitado y contenido endgame de Honkai: Star Rail, Wuthering Waves, Zenless Zone Zero y Arknights: Endfield.",
  applicationName: "GachaDash",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GachaDash",
  },
};

import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { GlobalHeader } from "@/components/ui/GlobalHeader";
import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-dvh flex flex-col bg-[var(--color-bg-primary)]">
        <OfflineBanner />
        <GlobalHeader />
        <div className="flex-1">
          {children}
        </div>
        <Toaster theme="dark" position="bottom-center" />
      </body>
    </html>
  );
}
