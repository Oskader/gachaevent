'use client'

import { useClock } from '@/lib/use-clock'
import {
  burnedFraction,
  countdownAt,
  urgencyColor,
  type UrgencyWords,
} from '@/lib/urgency'

/**
 * El reloj no se lee durante el render ni se sincroniza con setState en un
 * efecto: viene de un store externo compartido (ver use-clock). Eso evita
 * el hydration mismatch que tenía el badge anterior, que calculaba
 * `Date.now()` en el inicializador de useState y producía HTML distinto
 * en servidor y cliente.
 *
 * `now === 0` significa "todavía no montado en cliente".
 */

export function CountdownLabel({
  endDate,
  className = '',
  words,
}: {
  endDate: string
  className?: string
  /**
   * Palabras del lector de pantalla, en el idioma activo. Llegan por props
   * desde el servidor: este componente es de cliente y no puede leer la
   * cookie sin volver a renderizar en el navegador.
   */
  words?: UrgencyWords
}) {
  const now = useClock()

  if (now === 0) {
    // Reserva el hueco con las mismas métricas para que no salte el layout.
    return (
      <span
        className={`tabular text-sm text-transparent ${className}`}
        aria-hidden="true"
      >
        00d 00h
      </span>
    )
  }

  const cd = countdownAt(endDate, now, words)

  if (cd.level === 'ended') {
    return (
      <span className={`tabular text-sm text-[var(--text-faint)] ${className}`}>
        {cd.srLabel.toLowerCase()}
      </span>
    )
  }

  return (
    <span
      className={`tabular text-sm font-medium ${className}`}
      style={{ color: urgencyColor(cd.level) }}
    >
      <span aria-hidden="true">{cd.label}</span>
      <span className="sr-only">{cd.srLabel}</span>
    </span>
  )
}

/**
 * La mecha: se consume de izquierda a derecha en proporción a la ventana
 * del propio evento y toma el color de su urgencia. Es la firma visual
 * de la app — una pila de mechas ordenadas por lo que se apaga antes.
 */
export function Fuse({
  startDate,
  endDate,
  className = '',
}: {
  startDate: string
  endDate: string
  className?: string
}) {
  const now = useClock()

  const burned = now === 0 ? 0 : burnedFraction(startDate, endDate, now)
  const level = now === 0 ? 'none' : countdownAt(endDate, now).level

  return (
    <div className={`fuse ${className}`} role="presentation">
      <div
        className="fuse-burn"
        style={{
          width: `${burned * 100}%`,
          backgroundColor: urgencyColor(level),
        }}
      />
    </div>
  )
}
