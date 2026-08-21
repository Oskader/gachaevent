'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
      <p className="tabular mb-4 text-[10px] uppercase tracking-[0.24em] text-[var(--urgency-high)]">
        Error
      </p>
      <h1 className="mb-3 text-2xl font-bold tracking-tight text-foreground">
        Algo se rompió al cargar
      </h1>
      <p className="mb-2 text-sm leading-relaxed text-dim">
        No hemos podido preparar esta pantalla. Vuelve a intentarlo; si
        insiste, es cosa nuestra.
      </p>
      {error.digest && (
        <p className="tabular mb-8 text-[11px] text-[var(--text-faint)]">
          ref {error.digest}
        </p>
      )}

      <div className="mt-6 flex gap-6">
        <button
          onClick={reset}
          className="tabular border-b border-foreground pb-1 text-xs uppercase tracking-[0.14em] text-foreground transition-colors hover:border-[var(--urgency-low)] hover:text-[var(--urgency-low)]"
        >
          Reintentar
        </button>
        <Link
          href="/hoy"
          className="tabular border-b border-transparent pb-1 text-xs uppercase tracking-[0.14em] text-dim transition-colors hover:text-foreground"
        >
          Volver a Hoy
        </Link>
      </div>
    </main>
  )
}
