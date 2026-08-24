import { es, type Dictionary } from './es'
import { en } from './en'

/**
 * Lo que pueden importar TANTO servidor como cliente.
 *
 * Está separado de `index.ts` por un motivo concreto: `index.ts` importa
 * `cookies` de `next/headers`, que no existe en el navegador, y
 * `src/app/error.tsx` es un componente de cliente que Next renderiza solo con
 * `error` y `reset` — sin padre servidor que le pase el diccionario, así que
 * tiene que resolverlo él. Si esto viviera en `index.ts`, importarlo desde
 * ahí rompería el build.
 */

export type Locale = 'es' | 'en'

export const DEFAULT_LOCALE: Locale = 'es'

/**
 * `httpOnly: false` a propósito, por lo mismo: `error.tsx` la lee desde
 * `document.cookie`. No guarda nada sensible, solo 'es' o 'en'.
 */
export const LOCALE_COOKIE = 'ge_lang'

const DICTIONARIES: Record<Locale, Dictionary> = { es, en }

export function isLocale(value: unknown): value is Locale {
  return value === 'es' || value === 'en'
}

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE]
}

/**
 * Descripción del evento en el idioma pedido, cayendo al otro si falta.
 *
 * La caída no es un detalle: la traducción se hace por lotes y con tope por
 * pasada, así que un evento recién aparecido puede pasar un día sin español.
 * Enseñar el inglés es mejor que dejar la tarjeta muda.
 */
export function pickDescription(
  row: { description_es: string | null; description_en: string | null },
  locale: Locale
): string | null {
  return locale === 'es'
    ? (row.description_es ?? row.description_en)
    : (row.description_en ?? row.description_es)
}

/** Título del item de checklist en el idioma pedido, con la misma caída. */
export function pickTitle(
  row: { title_es: string | null; title_en: string | null; title: string },
  locale: Locale
): string {
  const picked = locale === 'es' ? row.title_es : row.title_en
  return picked ?? row.title_es ?? row.title_en ?? row.title
}

export type { Dictionary }
