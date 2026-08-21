import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/page-header'
import { SignOutButton } from '@/components/ui/SignOutButton'

export const metadata: Metadata = { title: 'Cuenta' }

export default async function CuentaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="mx-auto max-w-lg px-4 pb-10">
        <PageHeader title="Cuenta" />
        <div className="border border-line bg-panel px-5 py-8 text-center">
          <p className="mb-1 text-sm font-medium text-foreground">
            No has iniciado sesión
          </p>
          <p className="mb-5 text-sm text-dim">
            Tu progreso de endgame se guarda en tu cuenta y te sigue entre
            dispositivos.
          </p>
          <Link
            href="/login?next=/cuenta"
            className="tabular text-xs uppercase tracking-[0.14em] text-foreground underline underline-offset-4 hover:text-[var(--urgency-low)]"
          >
            Iniciar sesión
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
      <PageHeader title="Cuenta" />

      <dl className="border-y border-line">
        <Row label="Correo" value={user.email ?? '—'} />
        <Row label="Tareas completadas" value={String(count ?? 0)} />
        <Row
          label="Cuenta creada"
          value={new Date(user.created_at).toLocaleDateString('es', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        />
      </dl>

      <div className="mt-6">
        <SignOutButton />
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
