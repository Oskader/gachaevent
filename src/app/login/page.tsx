import { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AuthForm } from '@/components/auth-form'
import { AuthShell } from '@/components/auth-shell'
import { getI18n } from '@/lib/i18n'

export const metadata: Metadata = { title: 'Entrar' }

export default async function LoginPage() {
  const { t } = await getI18n()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/hoy')

  return (
    <AuthShell
      title={t.auth.loginTitle}
      subtitle={t.auth.loginSubtitle}
    >
      {/* useSearchParams necesita un límite de Suspense. */}
      <Suspense fallback={null}>
        <AuthForm labels={t.auth} mode="login" />
      </Suspense>
    </AuthShell>
  )
}
