'use client'

import { useEffect, useState } from 'react'

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    const onOffline = () => setIsOffline(true)
    const onOnline = () => setIsOffline(false)
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div
      role="alert"
      className="fixed top-0 inset-x-0 z-50 bg-yellow-500/90 backdrop-blur-sm text-black text-sm font-medium text-center py-2 px-4"
    >
      Sin conexión — los cambios se guardarán al reconectar
    </div>
  )
}
