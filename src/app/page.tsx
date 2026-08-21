import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function LandingPage() {
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
        GachaDash
      </p>

      {/* La tesis de la app, dicha con el mismo lenguaje visual que usa
          después: la cuenta atrás es el titular. */}
      <h1 className="mb-6 text-[2.75rem] font-bold leading-[1.05] tracking-tight text-foreground">
        Se acaba
        <br />
        <span className="tabular text-[var(--urgency-mid)]">en 06h 41m</span>
        <br />
        y no lo sabías.
      </h1>

      <p className="mb-12 max-w-sm text-sm leading-relaxed text-dim">
        GachaDash reúne los eventos de tiempo limitado de Honkai: Star Rail,
        Wuthering Waves, Zenless Zone Zero y Arknights: Endfield en una sola
        lista, ordenada por lo que vence antes.
      </p>

      <dl className="mb-12 border-y border-line">
        <Feature
          term="Una lista, no cuatro"
          detail="Los eventos de los cuatro juegos, ordenados por urgencia y no por franquicia."
        />
        <Feature
          term="Checklist de endgame"
          detail="Marca lo que ya has farmeado. Se guarda en tu cuenta y te sigue entre dispositivos."
        />
        <Feature
          term="Se actualiza sola"
          detail="Un scraper lee las wikis cada mañana. Tú no mantienes nada."
        />
      </dl>

      <div className="flex flex-col gap-3">
        <Link
          href="/register"
          className="border border-foreground bg-foreground px-6 py-3 text-center text-sm font-semibold text-background transition-colors hover:bg-transparent hover:text-foreground"
        >
          Crear cuenta
        </Link>
        <Link
          href="/hoy"
          className="tabular px-6 py-3 text-center text-xs uppercase tracking-[0.14em] text-dim transition-colors hover:text-foreground"
        >
          Mirar sin cuenta
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
