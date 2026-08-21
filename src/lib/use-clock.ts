'use client'

import { useSyncExternalStore } from 'react'

/**
 * Un único reloj compartido para toda la app.
 *
 * Dos motivos para que sea un store externo y no `useState` + `useEffect`:
 *
 * 1. El reloj ES un sistema externo. React 19 marca como error leerlo en
 *    render (impuro) o sincronizarlo con setState dentro de un efecto.
 *    `useSyncExternalStore` es la API prevista para esto.
 * 2. Con veinte eventos en pantalla habría veinte intervalos desalineados,
 *    y las cuentas atrás saltarían en momentos distintos. Con un solo
 *    intervalo laten todas a la vez.
 *
 * El snapshot de servidor es 0 y el primero de cliente también, así que la
 * hidratación coincide; el valor real llega justo después de suscribirse.
 */

const TICK_MS = 60_000

const listeners = new Set<() => void>()
let intervalId: ReturnType<typeof setInterval> | null = null
let snapshot = 0

function emit() {
  snapshot = Date.now()
  for (const listener of listeners) listener()
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange)

  if (intervalId === null) {
    intervalId = setInterval(emit, TICK_MS)
  }

  // Publica la hora real en cuanto hay alguien escuchando.
  if (snapshot === 0) snapshot = Date.now()
  onStoreChange()

  return () => {
    listeners.delete(onStoreChange)
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }
}

const getSnapshot = () => snapshot
const getServerSnapshot = () => 0

/** Devuelve la hora en ms, o 0 mientras no se haya montado en cliente. */
export function useClock(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
