import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { BottomNav } from "@/components/bottom-nav";
import { getI18n } from "@/lib/i18n";
import "./globals.css";

// Antes entraban por @import de Google Fonts dentro del CSS, que bloquea
// el render. next/font las autoaloja y las precarga.
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-data",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0c11",
};

export const metadata: Metadata = {
  title: {
    default: "GachaEvent — cuánto te queda",
    template: "%s · GachaEvent",
  },
  description:
    "Eventos de tiempo limitado y checklist de endgame de Honkai: Star Rail, Wuthering Waves, Zenless Zone Zero y Arknights: Endfield, ordenados por lo que vence antes.",
  applicationName: "GachaEvent",
  // El manifest existía en public/ pero no lo enlazaba nadie, así que la
  // PWA no era instalable.
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GachaEvent",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // El idioma sale de la cookie, no de la URL: ver src/lib/i18n/index.ts.
  const { locale, t } = await getI18n();

  return (
    <html
      lang={locale}
      className={`dark ${archivo.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col antialiased">
        <OfflineBanner label={t.offline.banner} />
        <div className="flex-1">{children}</div>
        <BottomNav labels={t.nav} />
        <Toaster theme="dark" position="top-center" />
      </body>
    </html>
  );
}
