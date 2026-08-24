'use client'

import { useEffect, useSyncExternalStore } from 'react'
import Link from 'next/link'
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  getDictionary,
  isLocale,
  type Locale,
} from '@/lib/i18n/shared'

/**
 * La excepción del sistema de idiomas.
 *
 * Next renderiza este componente solo con `error` y `reset`: no hay padre
 * servidor que le pase el diccionario, así que lo resuelve él leyendo la
 * cookie. Por eso `ge_lang` no es `httpOnly`.
 *
 * Se lee en un efecto y no durante el render: tocar `document` al renderizar
 * produce HTML distinto en servidor y cliente y rompe la hidratación.
 */
/** La cookie no cambia mientras esta pantalla vive, asi que no hay a que suscribirse. */
const subscribe = () => () => {}

function readCookieLocale(): Locale {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`)
  )
  const value = match?.[1]
  return isLocale(value) ? value : DEFAULT_LOCALE
}

const getServerSnapshot = () => DEFAULT_LOCALE

function useLocaleFromCookie(): Locale {
  // `useSyncExternalStore` y no `useState` + efecto: React 19 rechaza
  // sincronizar estado con setState dentro de un efecto
  // (`react-hooks/set-state-in-effect`), y es el mismo patron que ya usan
  // `use-clock.ts` y `OfflineBanner` para leer sistemas del navegador.
  // El snapshot es estable porque `document.cookie` devuelve lo mismo en
  // cada lectura, que es lo que exige este hook.
  return useSyncExternalStore(subscribe, readCookieLocale, getServerSnapshot)
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = getDictionary(useLocaleFromCookie())

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
      <p className="tabular mb-4 text-[10px] uppercase tracking-[0.24em] text-[var(--urgency-high)]">
        {t.error.eyebrow}
      </p>
      <h1 className="mb-3 text-2xl font-bold tracking-tight text-foreground">
        {t.error.title}
      </h1>
      <p className="mb-2 text-sm leading-relaxed text-dim">
        {t.error.body}
      </p>
      {error.digest && (
        <p className="tabular mb-8 text-[11px] text-[var(--text-faint)]">
          {t.error.ref} {error.digest}
        </p>
      )}

      <div className="mt-6 flex gap-6">
        <button
          onClick={reset}
          className="tabular border-b border-foreground pb-1 text-xs uppercase tracking-[0.14em] text-foreground transition-colors hover:border-[var(--urgency-low)] hover:text-[var(--urgency-low)]"
        >
          {t.error.retry}
        </button>
        <Link
          href="/hoy"
          className="tabular border-b border-transparent pb-1 text-xs uppercase tracking-[0.14em] text-dim transition-colors hover:text-foreground"
        >
          {t.error.backHome}
        </Link>
      </div>
    </main>
  )
}
