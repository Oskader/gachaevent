import { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AuthForm } from '@/components/auth-form'
import { AuthShell } from '@/components/auth-shell'

export const metadata: Metadata = { title: 'Entrar' }

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/hoy')

  return (
    <AuthShell
      title="Entrar"
      subtitle="Tu progreso de endgame te está esperando."
    >
      {/* useSearchParams necesita un límite de Suspense. */}
      <Suspense fallback={null}>
        <AuthForm mode="login" />
      </Suspense>
    </AuthShell>
  )
}
