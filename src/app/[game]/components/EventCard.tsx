import { CountdownBadge } from '@/components/ui/CountdownBadge'
import type { Database } from '@/lib/supabase/types'

type EventRow = Database['public']['Tables']['events']['Row']

export function EventCard({
  event,
  accentColor,
}: {
  event: EventRow
  accentColor: string
}) {
  const rewards = event.rewards as { items?: string[] } | null

  return (
    <article className="glass-card p-4 rounded-xl relative overflow-hidden border border-white/5">
      <div className="flex justify-between items-start gap-2 mb-2">
        <h3 className="text-[var(--color-text-primary)] font-bold text-sm line-clamp-2 leading-tight">
          {event.title}
        </h3>
        <CountdownBadge endDate={event.end_date} accentColor={accentColor} />
      </div>

      {event.description && (
        <p className="text-[var(--color-text-muted)] text-xs line-clamp-3 mb-3">
          {event.description}
        </p>
      )}

      {rewards?.items && rewards.items.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {rewards.items.slice(0, 4).map((reward, i) => (
            <span
              key={i}
              className="text-[10px] px-1.5 py-0.5 rounded text-white font-medium"
              style={{ backgroundColor: `${accentColor}33` }}
            >
              {reward}
            </span>
          ))}
          {rewards.items.length > 4 && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded text-[var(--color-text-muted)] font-medium"
              style={{ backgroundColor: `rgba(255,255,255,0.05)` }}
            >
              +{rewards.items.length - 4}
            </span>
          )}
        </div>
      )}
    </article>
  )
}
