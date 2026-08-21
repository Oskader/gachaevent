import Link from 'next/link'

/** Marco compartido por login y registro. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
      <Link
        href="/"
        className="tabular mb-10 text-[10px] uppercase tracking-[0.24em] text-dim transition-colors hover:text-foreground"
      >
        GachaDash
      </Link>

      <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mb-8 text-sm text-dim">{subtitle}</p>

      {children}
    </main>
  )
}
