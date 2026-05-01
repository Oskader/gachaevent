import { EventCard } from './EventCard'
import type { Database } from '@/lib/supabase/types'

type EventRow = Database['public']['Tables']['events']['Row']

export function EventsFeed({
  events,
  accentColor,
}: {
  events: EventRow[]
  accentColor: string
}) {
  return (
    <section aria-label="Eventos Activos">
      <h2 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
        Eventos Activos
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] italic glass-card p-4 rounded-xl border border-white/5">
          No hay eventos activos en este momento.
        </p>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} accentColor={accentColor} />
          ))}
        </div>
      )}
    </section>
  )
}
