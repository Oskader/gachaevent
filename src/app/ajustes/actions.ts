'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { LOCALE_COOKIE, isLocale, type Locale } from '@/lib/i18n'

export async function setLocale(locale: Locale) {
  // La Server Action es un endpoint: lo que llega no es de fiar aunque el
  // tipo diga que sí.
  if (!isLocale(locale)) return

  const store = await cookies()
  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    // Lo lee también `error.tsx` desde el navegador, que no puede recibir el
    // diccionario de ningún padre servidor. No guarda nada sensible.
    httpOnly: false,
  })

  // Sin esto, lo ya renderizado seguiría sirviéndose en el idioma viejo.
  revalidatePath('/', 'layout')
}
