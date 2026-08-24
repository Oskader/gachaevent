import { cookies } from 'next/headers'
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  getDictionary,
  isLocale,
  type Dictionary,
  type Locale,
} from './shared'

/**
 * Resolución del idioma en el servidor.
 *
 * Este módulo importa `next/headers`, así que **solo se puede usar desde
 * Server Components, Server Actions y route handlers**. Los componentes de
 * cliente importan de `./shared`, que no lo toca.
 *
 * El idioma viaja en una cookie y no en la URL a propósito: meter un segmento
 * `[locale]` en la raíz pondría en riesgo la resolución estático-vs-dinámico
 * que hace que `/hoy`, `/juegos`, `/cuenta` y `/ajustes` ganen a `/[game]`.
 */

/** `cookies()` es asíncrono en Next 16. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies()
  const value = store.get(LOCALE_COOKIE)?.value
  return isLocale(value) ? value : DEFAULT_LOCALE
}

export async function getI18n(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = await getLocale()
  return { locale, t: getDictionary(locale) }
}

export {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  getDictionary,
  isLocale,
  pickDescription,
  pickTitle,
} from './shared'
export type { Dictionary, Locale } from './shared'
