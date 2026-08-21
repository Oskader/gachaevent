import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Artefacto generado por Serwist en cada build: 90 avisos de ruido que
    // tapaban los problemas reales del código propio.
    "public/sw.js",

    // Scripts operativos de un solo uso y sondas manuales, no código de la app.
    "scripts/**",
    "scratch-*.mjs",
    "test_*.mjs",
    "upload-env.js",
  ]),
]);

export default eslintConfig;
