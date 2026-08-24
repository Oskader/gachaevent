import { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AuthForm } from '@/components/auth-form'
import { AuthShell } from '@/components/auth-shell'
import { getI18n } from '@/lib/i18n'

export const metadata: Metadata = { title: 'Crear cuenta' }

export default async function RegisterPage() {
  const { t } = await getI18n()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/hoy')

  return (
    <AuthShell
      title={t.auth.registerTitle}
      subtitle={t.auth.registerSubtitle}
    >
      <Suspense fallback={null}>
        <AuthForm labels={t.auth} mode="register" />
      </Suspense>
    </AuthShell>
  )
}
