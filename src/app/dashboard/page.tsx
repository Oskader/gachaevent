import { createClient } from '@/lib/supabase/server'
import { GameCard } from '@/components/ui/GameCard'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: games } = await supabase
    .from('games')
    .select('id, slug, name, color_accent, icon_url')
    .order('name')

  return (
    <main className="px-4 pb-6 pt-6">
      <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">
        Tus Juegos
      </h2>
      <section
        aria-label="Juegos disponibles"
        className="grid grid-cols-2 gap-3"
      >
        {games?.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </section>
    </main>
  )
}
