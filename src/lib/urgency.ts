/**
 * Urgencia: la única fuente de verdad sobre cuánto queda y cómo se pinta.
 *
 * El color saturado de la app codifica urgencia y nada más, así que este
 * módulo es el que decide qué se ve rojo. Vive aparte de los componentes
 * para que el servidor y el cliente calculen exactamente lo mismo.
 */

export type UrgencyLevel = 'none' | 'low' | 'mid' | 'high' | 'ended'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

export interface Countdown {
  level: UrgencyLevel
  /** Milisegundos restantes; 0 si ya terminó. */
  remaining: number
  /** "2d 04h" / "06h 12m" / "14m". Vacío si terminó. */
  label: string
  /** Etiqueta larga para lectores de pantalla. */
  srLabel: string
}

export function levelFor(remainingMs: number): UrgencyLevel {
  if (remainingMs <= 0) return 'ended'
  if (remainingMs < 12 * HOUR) return 'high'
  if (remainingMs < 2 * DAY) return 'mid'
  if (remainingMs < 7 * DAY) return 'low'
  return 'none'
}

/** Variable CSS del color correspondiente al nivel. */
export function urgencyColor(level: UrgencyLevel): string {
  switch (level) {
    case 'high':
      return 'var(--urgency-high)'
    case 'mid':
      return 'var(--urgency-mid)'
    case 'low':
      return 'var(--urgency-low)'
    case 'ended':
      return 'var(--text-faint)'
    default:
      return 'var(--urgency-none)'
  }
}

export function formatRemaining(remainingMs: number): string {
  if (remainingMs <= 0) return ''

  const days = Math.floor(remainingMs / DAY)
  const hours = Math.floor((remainingMs % DAY) / HOUR)
  const minutes = Math.floor((remainingMs % HOUR) / (60 * 1000))

  const pad = (n: number) => String(n).padStart(2, '0')

  if (days > 0) return `${days}d ${pad(hours)}h`
  if (hours > 0) return `${pad(hours)}h ${pad(minutes)}m`
  return `${minutes}m`
}

/**
 * Palabras de la etiqueta para lectores de pantalla.
 *
 * Solo esta es traducible: el texto VISIBLE de la cuenta atrás ("2d 03h",
 * "06h 41m") es neutro y no cambia de idioma. Son plantillas enteras y no
 * palabras sueltas porque el orden cambia: "Quedan 3 días y 5 h" contra
 * "3 days and 5 h left".
 */
export interface UrgencyWords {
  ended: string
  withDays: string
  withHours: string
  lessThanHour: string
  day: string
  days: string
}

const DEFAULT_WORDS: UrgencyWords = {
  ended: 'Terminado',
  withDays: 'Quedan {d} {dayWord} y {h} h',
  withHours: 'Quedan {h} h',
  lessThanHour: 'Quedan menos de una hora',
  day: 'día',
  days: 'días',
}

function srFormat(remainingMs: number, w: UrgencyWords): string {
  if (remainingMs <= 0) return w.ended
  const days = Math.floor(remainingMs / DAY)
  const hours = Math.floor((remainingMs % DAY) / HOUR)
  if (days > 0) {
    return w.withDays
      .replace('{d}', String(days))
      .replace('{dayWord}', days === 1 ? w.day : w.days)
      .replace('{h}', String(hours))
  }
  if (hours > 0) return w.withHours.replace('{h}', String(hours))
  return w.lessThanHour
}

/**
 * `now` es un parámetro obligatorio a propósito: leer el reloj dentro de
 * un render hace que servidor y cliente produzcan HTML distinto.
 */
export function countdownAt(
  endDate: string,
  now: number,
  words: UrgencyWords = DEFAULT_WORDS
): Countdown {
  const end = Date.parse(endDate)
  const remaining = Number.isNaN(end) ? 0 : Math.max(0, end - now)

  return {
    level: levelFor(remaining),
    remaining,
    label: formatRemaining(remaining),
    srLabel: srFormat(remaining, words),
  }
}

/**
 * Fracción de la ventana del evento ya consumida, de 0 a 1.
 * Es lo que dibuja la mecha: no es progreso global, es "cuánto se ha
 * quemado de ESTE evento".
 */
export function burnedFraction(
  startDate: string,
  endDate: string,
  now: number
): number {
  const start = Date.parse(startDate)
  const end = Date.parse(endDate)
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0
  return Math.min(1, Math.max(0, (now - start) / (end - start)))
}

/**
 * Lectura del reloj para Server Components.
 *
 * En un RSC dinámico esto se evalúa una vez por petición, no en un ciclo de
 * render, así que es legítimo. Vive en una función aparte para que quede
 * explícito que es una lectura por request y no un render impuro.
 */
export function requestNow(): number {
  return Date.now()
}
