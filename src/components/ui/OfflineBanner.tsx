'use client'

import { useSyncExternalStore } from 'react'

/**
 * El estado de conexión es un sistema externo del navegador, así que se
 * lee con useSyncExternalStore en vez de espejarlo en useState.
 *
 * De paso arregla el fallo del banner anterior: solo escuchaba la
 * transición online→offline, y si la app arrancaba ya sin conexión
 * (servida desde la caché del service worker) el aviso no salía nunca.
 * `getSnapshot` lee navigator.onLine de entrada.
 */

function subscribe(onStoreChange: () => void) {
  window.addEventListener('online', onStoreChange)
  window.addEventListener('offline', onStoreChange)
  return () => {
    window.removeEventListener('online', onStoreChange)
    window.removeEventListener('offline', onStoreChange)
  }
}

const getSnapshot = () => navigator.onLine
// En servidor se asume conexión: así el HTML no incluye el banner y no hay
// mismatch cuando el cliente confirma que sí hay red.
const getServerSnapshot = () => true

export function OfflineBanner() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  if (isOnline) return null

  return (
    <div
      role="status"
      className="tabular border-b border-[var(--urgency-low)] bg-[var(--urgency-low)] px-4 py-1.5 text-center text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--ink)]"
    >
      Sin conexión · viendo datos guardados
    </div>
  )
}
