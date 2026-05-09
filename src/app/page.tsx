import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  return (
    <main className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-4 pb-12 pt-8 text-center">
      <div className="max-w-2xl w-full space-y-16">
        {/* Hero Section */}
        <section className="space-y-6 flex flex-col items-center">
          <h1 className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#7C3AED] to-[#D8B4FE] tracking-tight leading-tight">
            Domina el Endgame de tus Gachas
          </h1>
          <p className="text-lg md:text-xl text-[var(--color-text-muted)] max-w-xl">
            Tu centro de comando para no perder recompensas. Trackea tu progreso y mantente al día con los eventos de tiempo limitado.
          </p>
          <div className="pt-4">
            <Link 
              href={session ? "/dashboard" : "/register"}
              className="inline-block bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold py-3 px-8 rounded-xl transition-all shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] transform hover:-translate-y-1"
            >
              {session ? "Ir al Dashboard" : "Empezar a trackear"}
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
          <div className="glass-card p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl hover:bg-white/10 transition-colors">
            <div className="text-4xl mb-4">⚔️</div>
            <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Checklists de Farmeo</h3>
            <p className="text-[var(--color-text-muted)] leading-relaxed">
              Gestión de progreso diario y semanal. Olvídate de llevar hojas de cálculo; marca tus tareas completadas y maximiza tus recursos.
            </p>
          </div>
          <div className="glass-card p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl hover:bg-white/10 transition-colors">
            <div className="text-4xl mb-4">🔔</div>
            <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Alertas de Eventos</h3>
            <p className="text-[var(--color-text-muted)] leading-relaxed">
              Scraping automático de eventos activos. Entérate antes de que terminen para que nunca más te pierdas de recompensas exclusivas.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
