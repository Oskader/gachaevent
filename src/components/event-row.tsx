import Image from 'next/image'
import { CountdownLabel, Fuse } from '@/components/ui/countdown'
import { pickDescription, type Locale } from '@/lib/i18n/shared'
import type { UrgencyWords } from '@/lib/urgency'
import type { Database } from '@/lib/supabase/types'

type EventRow = Database['public']['Tables']['events']['Row']

interface Props {
  event: EventRow
  accentColor: string
  /** En la vista agregada hace falta saber de qué juego es cada fila. */
  gameName?: string
  locale: Locale
  /** Palabras del lector de pantalla, para la cuenta atrás. */
  words: UrgencyWords
  /** Plantilla "y {n} más" del corte de recompensas. */
  andMore: string
  /**
   * La fila va en la sección de futuro: la cuenta atrás mira al arranque y
   * no al final. Lo decide la página, que es quien tiene el `now` de la
   * petición; aquí no se lee el reloj.
   */
  upcoming?: boolean
}

/**
 * Una fila de evento.
 *
 * Jerarquía deliberada: la cuenta atrás pesa lo mismo que el título,
 * porque en un gacha la pregunta no es "qué evento es" sino "cuánto me
 * queda". La mecha de abajo cierra la fila y da la lectura de un vistazo.
 */
export function EventRow({
  event,
  accentColor,
  gameName,
  locale,
  words,
  andMore,
  upcoming = false,
}: Props) {
  const rewards = event.rewards as { items?: string[] } | null
  const items = rewards?.items ?? []

  // Cae al otro idioma si falta la traducción: mejor inglés que una tarjeta
  // muda mientras la cola de traducción se vacía.
  const description = pickDescription(event, locale)

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

      <div className="flex gap-3">
        {event.image_url && (
          // 96×54 = 16:9, la proporción nativa de tres de las cuatro fuentes.
          // Endfield entrega 5.5:1 y se recorta por los lados: sigue siendo
          // reconocible, cosa que en una miniatura cuadrada no pasaría.
          <div className="relative h-[54px] w-24 shrink-0 overflow-hidden rounded-sm border border-line">
            <Image
              src={event.image_url}
              // Decorativa: el título va justo al lado y repetirlo solo
              // ensucia el lector de pantalla.
              alt=""
              fill
              sizes="96px"
              className="object-cover"
            />
          </div>
        )}

        {/* min-w-0 para que el line-clamp de la descripción pueda encoger. */}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-start justify-between gap-4">
            <h3 className="flex-1 text-sm font-semibold leading-snug text-foreground">
              {event.title}
            </h3>
            <CountdownLabel
              startDate={upcoming ? event.start_date : undefined}
              endDate={event.end_date}
              className="shrink-0"
              words={words}
            />
          </div>

          {description && (
            <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-dim">
              {description}
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
                  {andMore.replace('{n}', String(items.length - 4))}
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      <Fuse startDate={event.start_date} endDate={event.end_date} />
    </article>
  )
}
