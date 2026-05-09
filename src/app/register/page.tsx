import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RegisterForm } from './RegisterForm'

export default async function RegisterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm glass-card rounded-2xl p-6 border border-white/10 shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#7C3AED] to-transparent opacity-50" />
        
        <div className="text-center mb-8">
          <div className="w-12 h-12 mx-auto rounded-xl bg-[#7C3AED] flex items-center justify-center text-white text-2xl font-black mb-4 shadow-[0_0_15px_rgba(124,58,237,0.5)]">
            G
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Crea tu cuenta</h1>
          <p className="text-sm text-white/50 mt-1">Únete a GachaDash</p>
        </div>

        <RegisterForm />
      </div>
    </main>
  )
}
