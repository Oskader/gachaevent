'use client'

import { useClock } from '@/lib/use-clock'
import {
  burnedFraction,
  timelineAt,
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

/**
 * Marca neutra de "empieza en", para no romper la regla de que el texto
 * VISIBLE de la cuenta atrás no cambia de idioma. La frase entera va en la
 * etiqueta del lector de pantalla, que sí está traducida.
 */
const STARTS_IN = '→ '

export function CountdownLabel({
  startDate,
  endDate,
  className = '',
  words,
}: {
  /**
   * Solo lo pasan las filas que la página ya clasificó como futuras. Con él,
   * la etiqueta cuenta hasta el ARRANQUE en vez de hasta el final; sin él se
   * comporta igual que siempre.
   *
   * Se sigue recalculando la fase en cliente para que un evento que arranca
   * con la pestaña abierta pase solo a contar hasta su final.
   */
  startDate?: string
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
        {startDate ? `${STARTS_IN}00d 00h` : '00d 00h'}
      </span>
    )
  }

  const cd = timelineAt(startDate, endDate, now, words)

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
      <span aria-hidden="true">
        {cd.phase === 'upcoming' ? `${STARTS_IN}${cd.label}` : cd.label}
      </span>
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

  // `timelineAt` y no `countdownAt`: un evento que empieza dentro de tres
  // días y dura uno tenía la mecha vacía pero teñida de naranja, como si se
  // estuviera agotando.
  const burned = now === 0 ? 0 : burnedFraction(startDate, endDate, now)
  const level = now === 0 ? 'none' : timelineAt(startDate, endDate, now).level

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
