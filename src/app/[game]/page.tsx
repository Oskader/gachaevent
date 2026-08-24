import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/page-header'
import { EventRow } from '@/components/event-row'
import { ChecklistSection } from './components/ChecklistSection'
import { getI18n } from '@/lib/i18n'
import type { Database } from '@/lib/supabase/types'

interface Props {
  params: Promise<{ game: string }>
}

type GameSlug = Database['public']['Enums']['game_slug']

async function getGame(slug: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('games')
    .select('*')
    .eq('slug', slug as GameSlug)
    .single()
  return data
}

// Sin esto las cuatro páginas de juego compartían título y descripción.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { game: slug } = await params
  const { t } = await getI18n()
  const game = await getGame(slug)

  if (!game) return { title: t.game.notFound }

  return {
    title: game.name,
    description: t.game.metaDescription.replace('{game}', game.name),
  }
}

export default async function GamePage({ params }: Props) {
  const { game: gameSlug } = await params
  const { locale, t } = await getI18n()
  const supabase = await createClient()

  const game = await getGame(gameSlug)
  if (!game) notFound()

  const [{ data: events }, { data: checklistItems }] = await Promise.all([
    supabase
      .from('events')
      .select('*')
      .eq('game_id', game.id)
      .eq('is_active', true)
      .gte('end_date', new Date().toISOString())
      .order('end_date', { ascending: true })
      .limit(20),
    supabase
      .from('checklist_items')
      .select('*')
      .eq('game_id', game.id)
      .order('sort_order'),
  ])

  const activeEvents = events ?? []

  return (
    <main className="mx-auto max-w-lg px-4 pb-10">
      <PageHeader
        title={game.name}
        accentColor={game.color_accent}
        meta={`${activeEvents.length} ${activeEvents.length === 1 ? 'activo' : 'activos'}`}
      />

      <div className="space-y-9">
        <section>
          <h2 className="eyebrow mb-3">{t.game.eventsHeading}</h2>
          {activeEvents.length === 0 ? (
            <p className="text-sm text-dim">{t.game.noEvents}</p>
          ) : (
            <div>
              {activeEvents.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  accentColor={game.color_accent}
                  locale={locale}
                  words={t.urgency}
                  andMore={t.event.andMore}
                />
              ))}
            </div>
          )}
        </section>

        <ChecklistSection
          items={checklistItems ?? []}
          gameSlug={game.slug}
          accentColor={game.color_accent}
          locale={locale}
          labels={t.game}
        />
      </div>
    </main>
  )
}
