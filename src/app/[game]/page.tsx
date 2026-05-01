import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { GameHero } from './components/GameHero'
import { EventsFeed } from './components/EventsFeed'
import { ChecklistSection } from './components/ChecklistSection'
import type { Database } from '@/lib/supabase/types'

interface Props {
  params: Promise<{ game: string }>
}

export default async function GamePage({ params }: Props) {
  const { game: gameSlug } = await params
  const supabase = await createClient()

  // Fetch secuencial: primero el game.id, luego paralelo para eventos y checklist
  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('slug', gameSlug as Database['public']['Enums']['game_slug'])
    .single()

  if (!game) notFound()

  const [{ data: events }, { data: checklistItems }] = await Promise.all([
    supabase
      .from('events')
      .select('*')
      .eq('game_id', game.id)
      .eq('is_active', true)
      .gte('end_date', new Date().toISOString())
      .order('end_date', { ascending: true })
      .limit(10),
    supabase
      .from('checklist_items')
      .select('*')
      .eq('game_id', game.id)
      .order('sort_order')
  ])

  return (
    <main className="min-h-dvh bg-[var(--color-bg-primary)]">
      <GameHero game={game} />

      <div className="px-4 pb-24 space-y-6 mt-4">
        {/* Split view: Feed arriba, Checklist abajo */}
        <EventsFeed events={events ?? []} accentColor={game.color_accent} />
        <ChecklistSection
          items={checklistItems ?? []}
          gameId={game.id}
          accentColor={game.color_accent}
        />
      </div>
    </main>
  )
}
