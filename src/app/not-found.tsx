import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
      <p className="tabular mb-4 text-[10px] uppercase tracking-[0.24em] text-dim">
        Error 404
      </p>
      <h1 className="mb-3 text-2xl font-bold tracking-tight text-foreground">
        Esto no existe
      </h1>
      <p className="mb-8 text-sm leading-relaxed text-dim">
        La página que buscas no está aquí. Si era un evento, puede que ya
        haya terminado.
      </p>
      <Link
        href="/hoy"
        className="tabular self-start border-b border-foreground pb-1 text-xs uppercase tracking-[0.14em] text-foreground transition-colors hover:border-[var(--urgency-low)] hover:text-[var(--urgency-low)]"
      >
        Ver qué sigue activo
      </Link>
    </main>
  )
}
