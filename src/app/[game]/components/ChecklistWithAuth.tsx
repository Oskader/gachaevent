'use client'

import { AuthGate } from '@/components/ui/AuthGate'
import { ChecklistClient } from './ChecklistClient'
import type { Database } from '@/lib/supabase/types'

type ChecklistItemRow = Database['public']['Tables']['checklist_items']['Row']
type ProgressRow = Database['public']['Tables']['user_checklist_progress']['Row']

export function ChecklistWithAuth({
  items,
  initialProgress,
  gameId,
  accentColor,
}: {
  items: ChecklistItemRow[]
  initialProgress: ProgressRow[]
  gameId: string
  accentColor: string
}) {
  return (
    <AuthGate>
      {(userId) => (
        <ChecklistClient
          items={items}
          initialProgress={initialProgress}
          gameId={gameId}
          accentColor={accentColor}
          userId={userId}
        />
      )}
    </AuthGate>
  )
}
