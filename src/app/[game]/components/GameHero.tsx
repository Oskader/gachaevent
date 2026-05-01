import Image from 'next/image'
import type { Database } from '@/lib/supabase/types'

type GameRow = Database['public']['Tables']['games']['Row']

export function GameHero({ game }: { game: GameRow }) {
  const initials = game.name
    .split(/[\s:]+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div
      className="relative w-full h-32 flex items-end px-4 pb-4 overflow-hidden"
      style={{ backgroundColor: `${game.color_accent}26` }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg-primary)] to-transparent" />
      <div className="relative z-10 flex items-center gap-4">
        {game.icon_url ? (
          <div className="w-16 h-16 rounded-xl overflow-hidden relative shadow-lg">
            <Image
              src={game.icon_url}
              alt={game.name}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center font-bold text-xl text-white shadow-lg"
            style={{ backgroundColor: `${game.color_accent}80` }}
          >
            {initials}
          </div>
        )}
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">
          {game.name}
        </h1>
      </div>
    </div>
  )
}
