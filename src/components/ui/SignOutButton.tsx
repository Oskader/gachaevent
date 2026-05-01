'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function SignOutButton() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const handleSignOut = async () => {
    setLoading(true)
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <button 
      onClick={handleSignOut}
      disabled={loading}
      className="text-xs font-medium text-[var(--color-text-muted)] hover:text-white transition-colors"
    >
      {loading ? 'Saliendo...' : 'Cerrar Sesión'}
    </button>
  )
}
