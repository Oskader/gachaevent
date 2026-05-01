'use client'

import type { Database } from '@/lib/supabase/types'

type ChecklistItemRow = Database['public']['Tables']['checklist_items']['Row']

export function ChecklistItem({
  item,
  completed,
  accentColor,
  onToggle,
  disabled,
}: {
  item: ChecklistItemRow
  completed: boolean
  accentColor: string
  onToggle: () => void
  disabled: boolean
}) {
  return (
    <li>
      <button
        role="checkbox"
        aria-checked={completed}
        onClick={onToggle}
        disabled={disabled}
        title={disabled ? 'Inicia sesión para marcar' : ''}
        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 text-left ${
          disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-white/5'
        } ${
          completed ? 'bg-white/5 border-transparent' : 'bg-transparent border-white/10'
        }`}
      >
        <div
          className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-all duration-200"
          style={{
            border: completed ? 'none' : `2px solid ${accentColor}`,
            backgroundColor: completed ? accentColor : 'transparent',
          }}
        >
          {completed && (
            <svg
              className="w-3 h-3 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <p
            className={`text-sm font-medium transition-all duration-200 truncate ${
              completed ? 'text-white/50 line-through' : 'text-white'
            }`}
          >
            {item.title}
          </p>
        </div>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
          style={{
            backgroundColor: `${accentColor}26`,
            color: accentColor,
            opacity: completed ? 0.5 : 1,
          }}
        >
          {item.category}
        </span>
      </button>
    </li>
  )
}
