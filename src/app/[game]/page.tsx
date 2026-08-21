import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/page-header'
import { EventRow } from '@/components/event-row'
import { ChecklistSection } from './components/ChecklistSection'
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
  const game = await getGame(slug)

  if (!game) return { title: 'Juego no encontrado' }

  return {
    title: game.name,
    description: `Eventos activos y checklist de endgame de ${game.name}.`,
  }
}

export default async function GamePage({ params }: Props) {
  const { game: gameSlug } = await params
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
          <h2 className="eyebrow mb-3">Eventos</h2>
          {activeEvents.length === 0 ? (
            <p className="text-sm text-dim">
              No hay eventos activos ahora mismo. El scraper revisa la wiki
              cada mañana.
            </p>
          ) : (
            <div>
              {activeEvents.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  accentColor={game.color_accent}
                />
              ))}
            </div>
          )}
        </section>

        <ChecklistSection
          items={checklistItems ?? []}
          gameSlug={game.slug}
          accentColor={game.color_accent}
        />
      </div>
    </main>
  )
}
