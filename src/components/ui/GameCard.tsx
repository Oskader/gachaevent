import Link from 'next/link'
import Image from 'next/image'

interface Game {
  id: string
  slug: string
  name: string
  color_accent: string
  icon_url: string | null
}

export function GameCard({ game }: { game: Game }) {
  // Extract initials if icon is missing (e.g. "Honkai: Star Rail" -> "HS")
  const initials = game.name
    .split(/[\s:]+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <Link
      href={`/${game.slug}`}
      className="glass-card aspect-[4/3] rounded-xl overflow-hidden relative flex flex-col items-center justify-center p-4 hover:scale-[1.02] transition-transform duration-200 group"
      style={{
        backgroundColor: `${game.color_accent}26`, // ~15% opacity (hex 26)
        borderLeft: `3px solid ${game.color_accent}`,
      }}
    >
      {game.icon_url ? (
        <div className="w-12 h-12 mb-3 rounded-lg overflow-hidden relative">
          <Image
            src={game.icon_url}
            alt={`${game.name} icon`}
            fill
            className="object-cover"
          />
        </div>
      ) : (
        <div
          className="w-12 h-12 mb-3 rounded-lg flex items-center justify-center font-bold text-lg text-white"
          style={{ backgroundColor: `${game.color_accent}80` }}
        >
          {initials}
        </div>
      )}
      
      <h2 className="text-white font-bold text-center text-sm leading-tight drop-shadow-md">
        {game.name}
      </h2>
    </Link>
  )
}
