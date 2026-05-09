'use client'

import Link from 'next/link'
import { ChecklistClient } from './ChecklistClient'
import type { Database } from '@/lib/supabase/types'

type ChecklistItemRow = Database['public']['Tables']['checklist_items']['Row']
type ProgressRow = Database['public']['Tables']['user_checklist_progress']['Row']

export function ChecklistWithAuth({
  items,
  initialProgress,
  gameId,
  accentColor,
  userId,
}: {
  items: ChecklistItemRow[]
  initialProgress: ProgressRow[]
  gameId: string
  accentColor: string
  userId: string | null
}) {
  return (
    <div className="relative">
      <div className={!userId ? "opacity-30 pointer-events-none select-none blur-sm transition-all" : ""}>
        <ChecklistClient
          items={items}
          initialProgress={initialProgress}
          gameId={gameId}
          accentColor={accentColor}
          userId={userId}
        />
      </div>
      {!userId && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-4">
          <div className="glass-card p-6 flex flex-col items-center text-center gap-4 border border-white/10 rounded-2xl bg-[#0F0F23]/80 backdrop-blur-xl shadow-2xl">
            <span className="text-3xl">🔒</span>
            <p className="text-white font-medium max-w-[200px] leading-snug">
              Inicia sesión para guardar tu progreso de farmeo
            </p>
            <Link 
              href="/login" 
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-[0_0_15px_rgba(124,58,237,0.3)] mt-2"
            >
              Iniciar Sesión
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
