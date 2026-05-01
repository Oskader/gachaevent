import { ChecklistWithAuth } from './ChecklistWithAuth'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

type ChecklistItemRow = Database['public']['Tables']['checklist_items']['Row']

export async function ChecklistSection({
  items,
  gameId,
  accentColor,
}: {
  items: ChecklistItemRow[]
  gameId: string
  accentColor: string
}) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  let initialProgress: any[] = []
  if (session?.user?.id) {
    const itemIds = items.map(i => i.id)
    if (itemIds.length > 0) {
      const { data } = await supabase
        .from('user_checklist_progress')
        .select('*')
        .eq('user_id', session.user.id)
        .in('checklist_item_id', itemIds)
      
      if (data) initialProgress = data
    }
  }

  return (
    <ChecklistWithAuth
      items={items}
      initialProgress={initialProgress}
      gameId={gameId}
      accentColor={accentColor}
    />
  )
}
