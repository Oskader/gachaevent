'use client'

import { useOptimistic, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChecklistItem } from './ChecklistItem'
import type { Database } from '@/lib/supabase/types'

type ChecklistItemRow = Database['public']['Tables']['checklist_items']['Row']
type ProgressRow = Database['public']['Tables']['user_checklist_progress']['Row']

interface Props {
  items: ChecklistItemRow[]
  initialProgress: ProgressRow[]
  gameId: string
  accentColor: string
  userId: string | null
}

export function ChecklistClient({
  items,
  initialProgress,
  gameId,
  accentColor,
  userId,
}: Props) {
  const supabase = createClient()
  const [, startTransition] = useTransition()

  // Set de IDs completados — fuente de verdad local
  const completedIds = new Set(
    initialProgress
      .filter(p => p.completed)
      .map(p => p.checklist_item_id)
  )

  const [optimisticCompleted, updateOptimistic] = useOptimistic(
    completedIds,
    (current: Set<string>, itemId: string) => {
      const next = new Set(current)
      next.has(itemId) ? next.delete(itemId) : next.add(itemId)
      return next
    }
  )

  async function toggleItem(itemId: string) {
    if (!userId) return // AuthGate debe prevenir esto

    const isCompleted = optimisticCompleted.has(itemId)

    startTransition(async () => {
      // 1. Update optimista: instantáneo
      updateOptimistic(itemId)

      // 2. Sincronización en background con Supabase
      if (isCompleted) {
        await supabase
          .from('user_checklist_progress')
          .update({ completed: false, completed_at: null })
          .eq('user_id', userId)
          .eq('checklist_item_id', itemId)
      } else {
        await supabase
          .from('user_checklist_progress')
          .upsert({
            user_id: userId,
            checklist_item_id: itemId,
            completed: true,
            completed_at: new Date().toISOString(),
          }, { onConflict: 'user_id,checklist_item_id' })
      }
    })
  }

  const completedCount = optimisticCompleted.size
  const totalCount = items.length
  const progressPercent = totalCount > 0
    ? Math.round((completedCount / totalCount) * 100)
    : 0

  return (
    <section aria-label="Checklist endgame">
      {/* Barra de progreso */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">
          Progreso endgame
        </span>
        <span className="text-sm text-[var(--color-text-muted)]">
          {completedCount}/{totalCount}
        </span>
      </div>
      <div className="w-full h-2 bg-white/10 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progressPercent}%`,
            backgroundColor: accentColor,
          }}
        />
      </div>

      {/* Lista de items */}
      <ul className="space-y-2">
        {items.map(item => (
          <ChecklistItem
            key={item.id}
            item={item}
            completed={optimisticCompleted.has(item.id)}
            accentColor={accentColor}
            onToggle={() => toggleItem(item.id)}
            disabled={!userId}
          />
        ))}
      </ul>
    </section>
  )
}
