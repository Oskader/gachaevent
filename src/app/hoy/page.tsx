import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { EventRow } from '@/components/event-row'
import { PageHeader } from '@/components/page-header'
import { countdownAt, requestNow } from '@/lib/urgency'
import type { Database } from '@/lib/supabase/types'

export const metadata: Metadata = { title: 'Hoy' }

type GameRow = Database['public']['Tables']['games']['Row']

/** Fila de `events` con el juego embebido por el join. */
type EventWithGame = Database['public']['Tables']['events']['Row'] & {
  games: Pick<GameRow, 'slug' | 'name' | 'color_accent'> | null
}

export default async function HoyPage() {
  const supabase = await createClient()
  const now = requestNow()

  const { data } = await supabase
    .from('events')
    .select('*, games!inner(slug, name, color_accent)')
    .eq('is_active', true)
    .gte('end_date', new Date(now).toISOString())
    .order('end_date', { ascending: true })
    .limit(40)
    .returns<EventWithGame[]>()

  const rows = data ?? []

  // Corte por urgencia, no por juego: la pregunta de esta pantalla es
  // "¿qué se me escapa?", y eso no entiende de franquicias.
  const byLevel = (levels: string[]) =>
    rows.filter((e) => levels.includes(countdownAt(e.end_date, now).level))

  return (
    <main className="mx-auto max-w-lg px-4 pb-10">
      <PageHeader
        title="Hoy"
        meta={`${rows.length} ${rows.length === 1 ? 'evento activo' : 'eventos activos'}`}
      />

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-9">
          <Group
            label="Se acaba hoy"
            events={byLevel(['high'])}
            emptyNote="Nada vence en las próximas 12 horas."
          />
          <Group label="Esta semana" events={byLevel(['mid', 'low'])} />
          <Group label="Más adelante" events={byLevel(['none'])} />
        </div>
      )}
    </main>
  )
}

function Group({
  label,
  events,
  emptyNote,
}: {
  label: string
  events: EventWithGame[]
  emptyNote?: string
}) {
  if (events.length === 0 && !emptyNote) return null

  return (
    <section>
      <h2 className="eyebrow mb-3">{label}</h2>
      {events.length === 0 ? (
        <p className="text-sm text-dim">{emptyNote}</p>
      ) : (
        <div>
          {events.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              accentColor={event.games?.color_accent ?? 'var(--urgency-none)'}
              gameName={event.games?.name}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function EmptyState() {
  return (
    <div className="border border-line bg-panel px-5 py-8 text-center">
      <p className="mb-1 text-sm font-medium text-foreground">
        No hay eventos activos
      </p>
      <p className="mb-5 text-sm text-dim">
        Los scrapers corren cada mañana. Mientras tanto puedes adelantar el
        checklist de endgame.
      </p>
      <Link
        href="/juegos"
        className="tabular text-xs uppercase tracking-[0.14em] text-foreground underline underline-offset-4 hover:text-[var(--urgency-low)]"
      >
        Ver juegos
      </Link>
    </div>
  )
}
