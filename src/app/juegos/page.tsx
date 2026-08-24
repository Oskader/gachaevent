import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/page-header'
import { getI18n } from '@/lib/i18n'
import { countdownAt, requestNow, urgencyColor } from '@/lib/urgency'

export const metadata: Metadata = { title: 'Juegos' }

export default async function JuegosPage() {
  const { t } = await getI18n()
  const supabase = await createClient()
  const now = requestNow()

  const [{ data: games }, { data: events }] = await Promise.all([
    supabase
      .from('games')
      .select('id, slug, name, color_accent')
      .order('name'),
    supabase
      .from('events')
      .select('game_id, end_date')
      .eq('is_active', true)
      .gte('end_date', new Date(now).toISOString()),
  ])

  // Un juego no se resume por su icono, se resume por lo que se te escapa.
  const summary = new Map<string, { count: number; soonest: string | null }>()
  for (const event of events ?? []) {
    const entry = summary.get(event.game_id) ?? { count: 0, soonest: null }
    entry.count += 1
    if (!entry.soonest || event.end_date < entry.soonest) {
      entry.soonest = event.end_date
    }
    summary.set(event.game_id, entry)
  }

  return (
    <main className="mx-auto max-w-lg px-4 pb-10">
      <PageHeader title={t.juegos.title} meta={`${games?.length ?? 0} ${t.juegos.tracked}`} />

      <ul className="border-t border-line">
        {games?.map((game) => {
          const stats = summary.get(game.id)
          const cd = stats?.soonest ? countdownAt(stats.soonest, now, t.urgency) : null

          return (
            <li key={game.id} className="border-b border-line">
              <Link
                href={`/${game.slug}`}
                className="group flex items-center gap-4 py-4 transition-colors hover:bg-panel"
              >
                <span
                  className="h-10 w-[3px] shrink-0"
                  style={{ backgroundColor: game.color_accent }}
                  aria-hidden="true"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {game.name}
                  </p>
                  <p className="tabular mt-0.5 text-[11px] text-dim">
                    {stats?.count
                      ? `${stats.count} ${stats.count === 1 ? t.hoy.activeEvent : t.hoy.activeEvents}`
                      : t.juegos.noActiveEvents}
                  </p>
                </div>

                {cd && (
                  <span
                    className="tabular shrink-0 text-sm font-medium"
                    style={{ color: urgencyColor(cd.level) }}
                  >
                    <span aria-hidden="true">{cd.label}</span>
                    <span className="sr-only">
                      {t.juegos.nextClosing}: {cd.srLabel}
                    </span>
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
