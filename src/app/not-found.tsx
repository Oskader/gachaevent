import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="glass-card p-8 rounded-2xl border border-white/10 text-center max-w-md w-full relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#7C3AED] to-transparent opacity-50" />
        <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/20 mb-2">404</h1>
        <h2 className="text-xl font-bold text-white mb-2">Página no encontrada</h2>
        <p className="text-sm text-white/60 mb-8">El evento o sección que buscas ha terminado o no existe.</p>
        
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium rounded-lg transition-colors"
        >
          Explorar Juegos
        </Link>
      </div>
    </main>
  )
}
