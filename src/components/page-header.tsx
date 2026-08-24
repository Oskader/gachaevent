import Link from 'next/link'

/**
 * Cabecera de pantalla. La marca no ocupa una barra fija propia: el título
 * de la pantalla es lo que orienta, y GachaEvent se firma en pequeño al lado.
 * Así se recupera altura útil en móvil, que es donde se usa esto.
 */
export function PageHeader({
  title,
  meta,
  accentColor,
}: {
  title: string
  meta?: string
  accentColor?: string
}) {
  return (
    <header className="py-6">
      <div className="mb-3 flex items-center justify-between">
        <Link
          href="/hoy"
          className="tabular text-[10px] uppercase tracking-[0.24em] text-dim transition-colors hover:text-foreground"
        >
          GachaEvent
        </Link>
        {meta && (
          <span className="tabular text-[10px] uppercase tracking-[0.14em] text-dim">
            {meta}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {accentColor && (
          <span
            className="h-7 w-[3px] shrink-0"
            style={{ backgroundColor: accentColor }}
            aria-hidden="true"
          />
        )}
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground">
          {title}
        </h1>
      </div>
    </header>
  )
}
