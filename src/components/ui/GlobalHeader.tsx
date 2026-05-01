import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { SignOutButton } from './SignOutButton'

export async function GlobalHeader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0F0F23]/80 backdrop-blur-md border-b border-white/5 px-4 py-3 flex justify-between items-center">
      <Link href="/" className="font-bold text-[var(--color-text-primary)] tracking-tight flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-[#7C3AED] flex items-center justify-center text-white text-xs font-black">
          G
        </div>
        GachaDash
      </Link>
      {user ? (
        <div className="flex items-center gap-3">
          <SignOutButton />
        </div>
      ) : (
        <Link 
          href="/login" 
          className="text-xs font-medium text-white bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/20 transition-colors"
        >
          Iniciar Sesión
        </Link>
      )}
    </header>
  )
}
