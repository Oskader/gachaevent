import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import path from "node:path";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Hay un package-lock.json suelto en el home del usuario; sin esto Next
  // infiere C:\Users\oscar como raíz del workspace y el build tracing sale mal.
  outputFileTracingRoot: path.join(__dirname),

  images: {
    // games.icon_url es una URL arbitraria de la BD. Sin remotePatterns,
    // next/image lanza "Invalid src prop" en cuanto una fila deje de ser null.
    remotePatterns: [
      { protocol: "https", hostname: "**.fandom.com" },
      { protocol: "https", hostname: "**.wiki.gg" },
      { protocol: "https", hostname: "**.nocookie.net" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
    // Orden de preferencia del formato de salida para las imagenes que SI
    // pasan por next/image (iconos de juego, etc). La miniatura de evento
    // usa `unoptimized` y recibe el formato del upstream directamente.
    formats: ["image/avif", "image/webp"],
  },
};

export default withSerwist(nextConfig);