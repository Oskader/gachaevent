'use client'

import { useTransition } from 'react'
import { setLocale } from './actions'
import type { Locale } from '@/lib/i18n/shared'

interface Props {
  current: Locale
  labels: { spanish: string; english: string }
}

export function LocaleSelector({ current, labels }: Props) {
  const [pending, startTransition] = useTransition()

  const options: { value: Locale; label: string }[] = [
    { value: 'es', label: labels.spanish },
    { value: 'en', label: labels.english },
  ]

  return (
    <div className="flex gap-2" role="group">
      {options.map(({ value, label }) => {
        const active = value === current
        return (
          <button
            key={value}
            type="button"
            disabled={pending || active}
            aria-pressed={active}
            onClick={() => startTransition(() => setLocale(value))}
            // Sin color de marca: el sistema reserva el color saturado para la
            // urgencia. El estado activo se marca con el borde y el texto,
            // igual que la pestaña activa de la navegación.
            className={`tabular flex-1 border py-2.5 text-xs uppercase tracking-[0.14em] transition-colors disabled:opacity-60 ${
              active
                ? 'border-foreground text-foreground'
                : 'border-line text-dim hover:text-foreground'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
