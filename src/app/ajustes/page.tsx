import type { Metadata } from 'next'
import { PageHeader } from '@/components/page-header'
import { getI18n } from '@/lib/i18n'
import { LocaleSelector } from './LocaleSelector'

export const metadata: Metadata = { title: 'Ajustes' }

/**
 * Ajustes.
 *
 * Sin guardia en `proxy.ts` a propósito: el idioma tiene que poder cambiarse
 * sin sesión, así que esto no puede vivir dentro de `/cuenta`.
 *
 * `ajustes` es un segmento estático más, y como `/hoy`, `/juegos` y `/cuenta`
 * tiene que seguir ganando al dinámico `/[game]`. Comprobado que no choca con
 * ningún valor del enum `game_slug`.
 */
export default async function AjustesPage() {
  const { locale, t } = await getI18n()

  return (
    <main className="mx-auto max-w-lg px-4 pb-10">
      <PageHeader title={t.ajustes.title} />

      <section>
        <h2 className="eyebrow">{t.ajustes.languageLabel}</h2>
        <p className="mb-4 mt-3 text-sm leading-relaxed text-dim">
          {t.ajustes.languageHelp}
        </p>
        <LocaleSelector
          current={locale}
          labels={{ spanish: t.ajustes.spanish, english: t.ajustes.english }}
        />
      </section>
    </main>
  )
}
