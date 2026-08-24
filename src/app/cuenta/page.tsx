import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/page-header'
import { SignOutButton } from '@/components/ui/SignOutButton'
import { getI18n } from '@/lib/i18n'

export const metadata: Metadata = { title: 'Cuenta' }

export default async function CuentaPage() {
  const { locale, t } = await getI18n()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="mx-auto max-w-lg px-4 pb-10">
        <PageHeader title={t.cuenta.title} />
        <div className="border border-line bg-panel px-5 py-8 text-center">
          <p className="mb-1 text-sm font-medium text-foreground">
            {t.cuenta.signedOutTitle}
          </p>
          <p className="mb-5 text-sm text-dim">{t.cuenta.signedOutBody}</p>
          <Link
            href="/login?next=/cuenta"
            className="tabular text-xs uppercase tracking-[0.14em] text-foreground underline underline-offset-4 hover:text-[var(--urgency-low)]"
          >
            {t.cuenta.signIn}
          </Link>
        </div>
      </main>
    )
  }

  const { count } = await supabase
    .from('user_checklist_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('completed', true)

  return (
    <main className="mx-auto max-w-lg px-4 pb-10">
      <PageHeader title={t.cuenta.title} />

      <dl className="border-y border-line">
        <Row label={t.cuenta.email} value={user.email ?? '—'} />
        <Row label={t.cuenta.tasksDone} value={String(count ?? 0)} />
        <Row
          label={t.cuenta.createdAt}
          value={new Date(user.created_at).toLocaleDateString(locale, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        />
      </dl>

      <div className="mt-6">
        <SignOutButton labels={t.cuenta} />
      </div>
    </main>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-b-0">
      <dt className="tabular text-[11px] uppercase tracking-[0.14em] text-dim">
        {label}
      </dt>
      <dd className="tabular truncate text-sm text-foreground">{value}</dd>
    </div>
  )
}
