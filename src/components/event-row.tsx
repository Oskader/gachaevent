import { CountdownLabel, Fuse } from '@/components/ui/countdown'
import type { Database } from '@/lib/supabase/types'

type EventRow = Database['public']['Tables']['events']['Row']

interface Props {
  event: EventRow
  accentColor: string
  /** En la vista agregada hace falta saber de qué juego es cada fila. */
  gameName?: string
}

/**
 * Una fila de evento.
 *
 * Jerarquía deliberada: la cuenta atrás pesa lo mismo que el título,
 * porque en un gacha la pregunta no es "qué evento es" sino "cuánto me
 * queda". La mecha de abajo cierra la fila y da la lectura de un vistazo.
 */
export function EventRow({ event, accentColor, gameName }: Props) {
  const rewards = event.rewards as { items?: string[] } | null
  const items = rewards?.items ?? []

  return (
    <article className="group relative border-b border-line py-4 last:border-b-0">
      {gameName && (
        <div className="mb-1.5 flex items-center gap-2">
          <span
            className="h-2.5 w-[3px] shrink-0"
            style={{ backgroundColor: accentColor }}
            aria-hidden="true"
          />
          <span className="tabular text-[10px] uppercase tracking-[0.14em] text-dim">
            {gameName}
          </span>
        </div>
      )}

      <div className="mb-2 flex items-start justify-between gap-4">
        <h3 className="flex-1 text-sm font-semibold leading-snug text-foreground">
          {event.title}
        </h3>
        <CountdownLabel endDate={event.end_date} className="shrink-0" />
      </div>

      {event.description && (
        <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-dim">
          {event.description}
        </p>
      )}

      {items.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-x-3 gap-y-1">
          {items.slice(0, 4).map((reward, i) => (
            <li
              key={`${reward}-${i}`}
              className="tabular text-[11px] text-dim before:mr-1.5 before:text-[var(--text-faint)] before:content-['+']"
            >
              {reward}
            </li>
          ))}
          {items.length > 4 && (
            <li className="tabular text-[11px] text-[var(--text-faint)]">
              y {items.length - 4} más
            </li>
          )}
        </ul>
      )}

      <Fuse startDate={event.start_date} endDate={event.end_date} />
    </article>
  )
}
