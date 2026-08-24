import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getI18n } from '@/lib/i18n'

export default async function LandingPage() {
  const { t } = await getI18n()
  const supabase = await createClient()

  // getUser() valida el token; getSession() solo lee la cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Quien ya tiene sesión no necesita la página de venta.
  if (user) redirect('/hoy')

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-16">
      <p className="tabular mb-10 text-[10px] uppercase tracking-[0.24em] text-dim">
        GachaEvent
      </p>

      {/* La tesis de la app, dicha con el mismo lenguaje visual que usa
          después: la cuenta atrás es el titular. */}
      <h1 className="mb-6 text-[2.75rem] font-bold leading-[1.05] tracking-tight text-foreground">
        {t.landing.headlineBefore}
        <br />
        <span className="tabular text-[var(--urgency-mid)]">en 06h 41m</span>
        <br />
        {t.landing.headlineAfter}
      </h1>

      <p className="mb-12 max-w-sm text-sm leading-relaxed text-dim">
        {t.landing.intro}
      </p>

      <dl className="mb-12 border-y border-line">
        <Feature term={t.landing.feature1Term} detail={t.landing.feature1Detail} />
        <Feature term={t.landing.feature2Term} detail={t.landing.feature2Detail} />
        <Feature term={t.landing.feature3Term} detail={t.landing.feature3Detail} />
      </dl>

      <div className="flex flex-col gap-3">
        <Link
          href="/register"
          className="border border-foreground bg-foreground px-6 py-3 text-center text-sm font-semibold text-background transition-colors hover:bg-transparent hover:text-foreground"
        >
          {t.landing.createAccount}
        </Link>
        <Link
          href="/hoy"
          className="tabular px-6 py-3 text-center text-xs uppercase tracking-[0.14em] text-dim transition-colors hover:text-foreground"
        >
          {t.landing.browseAnonymously}
        </Link>
      </div>
    </main>
  )
}

function Feature({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="border-b border-line py-4 last:border-b-0">
      <dt className="mb-1 text-sm font-semibold text-foreground">{term}</dt>
      <dd className="text-sm leading-relaxed text-dim">{detail}</dd>
    </div>
  )
}
