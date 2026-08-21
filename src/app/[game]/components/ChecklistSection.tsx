import Link from 'next/link'
import { ChecklistClient } from './ChecklistClient'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

type ChecklistItemRow = Database['public']['Tables']['checklist_items']['Row']

export async function ChecklistSection({
  items,
  gameSlug,
  accentColor,
}: {
  items: ChecklistItemRow[]
  gameSlug: string
  accentColor: string
}) {
  const supabase = await createClient()

  // getUser() valida la firma del JWT; getSession() se limita a decodificar
  // la cookie y darla por buena.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let completedIds: string[] = []

  if (user && items.length > 0) {
    const { data } = await supabase
      .from('user_checklist_progress')
      .select('checklist_item_id, completed')
      .eq('user_id', user.id)
      .in(
        'checklist_item_id',
        items.map((i) => i.id)
      )

    completedIds = (data ?? [])
      .filter((row) => row.completed)
      .map((row) => row.checklist_item_id)
  }

  if (items.length === 0) {
    return (
      <section>
        <h2 className="eyebrow mb-4">Endgame</h2>
        <p className="text-sm text-dim">
          Todavía no hay tareas de endgame para este juego.
        </p>
      </section>
    )
  }

  return (
    <div>
      <ChecklistClient
        items={items}
        completedIds={completedIds}
        gameSlug={gameSlug}
        accentColor={accentColor}
        isSignedIn={Boolean(user)}
      />

      {!user && (
        <p className="mt-4 border border-line bg-panel px-4 py-3 text-sm text-dim">
          <Link
            href={`/login?next=/${gameSlug}`}
            className="font-medium text-foreground underline underline-offset-4 hover:text-[var(--urgency-low)]"
          >
            Inicia sesión
          </Link>{' '}
          para guardar tu progreso entre sesiones.
        </p>
      )}
    </div>
  )
}
