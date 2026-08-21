'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export function SignOutButton() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    const { error } = await supabase.auth.signOut()

    if (error) {
      // Antes el error se ignoraba y el botón se quedaba en "Saliendo…"
      // para siempre.
      toast.error('No se pudo cerrar la sesión')
      setLoading(false)
      return
    }

    // push + refresh: sin el refresh, los Server Components siguen
    // renderizando con la sesión antigua en caché.
    router.push('/')
    router.refresh()
  }

  return (
    <Button
      variant="outline"
      onClick={handleSignOut}
      disabled={loading}
      className="w-full rounded-none border-line-strong text-sm hover:border-[var(--urgency-high)] hover:text-[var(--urgency-high)]"
    >
      {loading ? 'Cerrando sesión…' : 'Cerrar sesión'}
    </Button>
  )
}
