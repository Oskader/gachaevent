export default function Loading() {
  return (
    <main className="min-h-dvh bg-[var(--color-bg-primary)] animate-pulse">
      {/* Hero skeleton */}
      <div className="w-full h-32 bg-white/5" />

      <div className="px-4 pb-24 space-y-6 mt-4">
        {/* Events skeleton */}
        <section>
          <div className="h-5 w-32 bg-white/10 rounded mb-3" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card h-28 rounded-xl bg-white/5 border border-white/5" />
            ))}
          </div>
        </section>

        {/* Checklist skeleton */}
        <section>
          <div className="flex justify-between mb-3">
            <div className="h-5 w-32 bg-white/10 rounded" />
            <div className="h-5 w-8 bg-white/10 rounded" />
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full mb-4" />
          <ul className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <li key={i} className="h-10 bg-white/5 rounded-lg border border-white/5" />
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}
