/**
 * Interpretación de las cadenas de duración que publican las wikis.
 *
 * Formatos vistos en vivo en las cuatro fuentes:
 *   "July 10, 2026 – August 7, 2026"          (Fandom, guion largo)
 *   "September 26, 2025 – TBA"                 (sin fecha de fin)
 *   "May 23, 2024 – Indefinite"                (permanente)
 *   "April 26, 2023"                           (una sola fecha)
 *   "2026/08/09 12:00 – 2026/09/01 17:00"      (Endfield, con hora)
 */

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
}

export interface DateRange {
  start_date: string
  end_date: string
}

function parseOne(part: string): number | null {
  // "August 7, 2026"
  const named = part.match(/([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/)
  if (named) {
    const month = MONTHS[named[1].toLowerCase()]
    if (month !== undefined) return Date.UTC(+named[3], month, +named[2])
  }

  // "2026/09/01 17:00"
  const slashed = part.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/)
  if (slashed) {
    return Date.UTC(
      +slashed[1], +slashed[2] - 1, +slashed[3],
      slashed[4] ? +slashed[4] : 0,
      slashed[5] ? +slashed[5] : 0
    )
  }

  return null
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

  // Separadores: guion largo, o " - " con espacios (nunca un guion pegado,
  // que forma parte de nombres como "Ding-Dong!").
  const parts = text.split(/[–—]|\s+-\s+/).map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return null

  const start = parseOne(parts[0])
  const end = parseOne(parts[1])
  if (start === null || end === null || end <= start) return null

  return {
    start_date: new Date(start).toISOString(),
    end_date: new Date(end).toISOString(),
  }
}
