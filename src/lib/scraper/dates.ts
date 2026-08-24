/**
 * Interpretación de las cadenas de duración que publican las wikis.
 *
 * Formatos vistos en vivo en las cuatro fuentes:
 *   "July 10, 2026 – August 7, 2026"          (Fandom, guion largo)
 *   "September 26, 2025 – TBA"                 (sin fecha de fin)
 *   "May 23, 2024 – Indefinite"                (permanente)
 *   "April 26, 2023"                           (una sola fecha)
 *   "2026/08/09 12:00 – 2026/09/01 17:00 (UTC-5)"   (Endfield, con hora y huso)
 *
 * Dos cosas que este módulo tiene que resolver y no son obvias:
 *
 * 1. **Las wikis de Fandom dan el día, no la hora.** Un fin "August 26, 2026"
 *    convertido con `Date.UTC(y, m, d)` cae en el instante en que ese día
 *    EMPIEZA, así que el evento se apagaba hasta 24 h antes de tiempo — en una
 *    app que trata del tiempo restante, eso es el bug de fondo. Cuando la fecha
 *    de fin no trae hora se toma el final de ese día.
 *
 * 2. **Endfield sí trae huso, y hay que aplicarlo.** Sus tarjetas rotulan
 *    "(UTC+8)" o "(UTC-5)" junto a la hora. Ignorarlo guardaba `17:00 UTC-5`
 *    como `17:00Z`: cinco horas de más. Las wikis de Fandom no declaran huso;
 *    ahí la precisión es de un día y no hay nada que aplicar.
 */

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
}

const DAY_MS = 86_400_000

export interface DateRange {
  start_date: string
  end_date: string
}

/**
 * Un extremo del rango. `hasTime` distingue "el día 26" de "el 26 a las 17:00":
 * sin hora, el fin hay que estirarlo hasta el final del día.
 */
interface Point {
  ms: number
  hasTime: boolean
}

function parseOne(part: string): Point | null {
  // "August 7, 2026" — las wikis de Fandom nunca añaden hora aquí.
  const named = part.match(/([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/)
  if (named) {
    const month = MONTHS[named[1].toLowerCase()]
    if (month !== undefined) {
      return { ms: Date.UTC(+named[3], month, +named[2]), hasTime: false }
    }
  }

  // "2026/09/01 17:00"
  const slashed = part.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/)
  if (slashed) {
    return {
      ms: Date.UTC(
        +slashed[1], +slashed[2] - 1, +slashed[3],
        slashed[4] ? +slashed[4] : 0,
        slashed[5] ? +slashed[5] : 0
      ),
      hasTime: Boolean(slashed[4]),
    }
  }

  return null
}

/** Minutos que hay que restar para pasar de la hora rotulada a UTC. */
function offsetMinutes(text: string): number {
  const m = text.match(/UTC\s*([+-])\s*(\d{1,2})(?::(\d{2}))?/i)
  if (!m) return 0
  const sign = m[1] === '-' ? -1 : 1
  return sign * (+m[2] * 60 + (m[3] ? +m[3] : 0))
}

/**
 * Devuelve null cuando la fila no representa un evento de tiempo limitado con
 * ventana conocida. Eso incluye los permanentes: la app trata del tiempo que
 * queda, y un evento sin fin no tiene nada que contar.
 */
export function parseDuration(raw: string): DateRange | null {
  const text = (raw || '').replace(/\s+/g, ' ').trim()
  if (!text) return null
  if (/indefinite|permanent|tba|to be announced/i.test(text)) return null

  const offset = offsetMinutes(text)

  // Separadores: guion largo, o " - " con espacios (nunca un guion pegado,
  // que forma parte de nombres como "Ding-Dong!").
  const parts = text.split(/[–—]|\s+-\s+/).map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return null

  const start = parseOne(parts[0])
  const end = parseOne(parts[1])
  if (!start || !end) return null

  // Sin hora, el fin es el final de ese día, no su principio.
  const endMs = end.hasTime ? end.ms : end.ms + DAY_MS - 1

  const startUtc = start.ms - offset * 60_000
  const endUtc = endMs - offset * 60_000
  if (endUtc <= startUtc) return null

  return {
    start_date: new Date(startUtc).toISOString(),
    end_date: new Date(endUtc).toISOString(),
  }
}
