import { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AuthForm } from '@/components/auth-form'
import { AuthShell } from '@/components/auth-shell'

export const metadata: Metadata = { title: 'Crear cuenta' }

export default async function RegisterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/hoy')

  return (
    <AuthShell
      title="Crear cuenta"
      subtitle="Para que lo que marques siga ahí mañana."
    >
      <Suspense fallback={null}>
        <AuthForm mode="register" />
      </Suspense>
    </AuthShell>
  )
}
