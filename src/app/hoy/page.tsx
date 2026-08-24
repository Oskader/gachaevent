import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { EventRow } from '@/components/event-row'
import { PageHeader } from '@/components/page-header'
import { countdownAt, requestNow } from '@/lib/urgency'
import { getI18n, type Dictionary, type Locale } from '@/lib/i18n'
import type { Database } from '@/lib/supabase/types'

export const metadata: Metadata = { title: 'Hoy' }

type GameRow = Database['public']['Tables']['games']['Row']

/** Fila de `events` con el juego embebido por el join. */
type EventWithGame = Database['public']['Tables']['events']['Row'] & {
  games: Pick<GameRow, 'slug' | 'name' | 'color_accent'> | null
}

export default async function HoyPage() {
  const { locale, t } = await getI18n()
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
        title={t.hoy.title}
        meta={`${rows.length} ${rows.length === 1 ? t.hoy.activeEvent : t.hoy.activeEvents}`}
      />

      {rows.length === 0 ? (
        <EmptyState t={t} />
      ) : (
        <div className="space-y-9">
          <Group
            label={t.hoy.endsToday}
            events={byLevel(['high'])}
            emptyNote={t.hoy.nothingSoon}
            locale={locale}
            words={t.urgency}
            andMore={t.event.andMore}
          />
          <Group
            label={t.hoy.thisWeek}
            events={byLevel(['mid', 'low'])}
            locale={locale}
            words={t.urgency}
            andMore={t.event.andMore}
          />
          <Group
            label={t.hoy.later}
            events={byLevel(['none'])}
            locale={locale}
            words={t.urgency}
            andMore={t.event.andMore}
          />
        </div>
      )}
    </main>
  )
}

function Group({
  label,
  events,
  emptyNote,
  locale,
  words,
  andMore,
}: {
  label: string
  events: EventWithGame[]
  emptyNote?: string
  locale: Locale
  words: Dictionary['urgency']
  andMore: string
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
              locale={locale}
              words={words}
              andMore={andMore}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function EmptyState({ t }: { t: Dictionary }) {
  return (
    <div className="border border-line bg-panel px-5 py-8 text-center">
      <p className="mb-1 text-sm font-medium text-foreground">
        {t.hoy.emptyTitle}
      </p>
      <p className="mb-5 text-sm text-dim">{t.hoy.emptyBody}</p>
      <Link
        href="/juegos"
        className="tabular text-xs uppercase tracking-[0.14em] text-foreground underline underline-offset-4 hover:text-[var(--urgency-low)]"
      >
        {t.hoy.seeGames}
      </Link>
    </div>
  )
}
