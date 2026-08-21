/**
 * Normalización de títulos de evento.
 *
 * El pipeline anterior aplastaba el HTML de la wiki a texto plano y le pedía
 * a un LLM que reconstruyera la lista. El resultado eran cinco familias de
 * duplicados en la misma tabla:
 *
 *   - sufijo de fecha        "Garden of Plenty" + "Garden of Plenty 2026-08-14"
 *   - variantes de comillas  'For You...' + "For You..." + For You...
 *   - prefijo variable       'Deadly Assault "Spirit"...' + 'Spirit Artist's...'
 *   - singular/plural        "Marcel Anniversary Gift" + "...Gifts"
 *   - lista de personajes    "Aptitude Showcase - Himeko • Nova, Anaxa, ..."
 *
 * Ahora los títulos vienen de parsear la tabla directamente, así que las
 * variantes ya no se generan. Esto se queda como saneado de lo que la propia
 * wiki escribe raro, y como clave de deduplicación.
 */

/** Nombre presentable: lo que el usuario debe leer en la tarjeta. */
export function cleanTitle(raw: string): string {
  let t = (raw || '').replace(/\s+/g, ' ').trim()

  // Comillas tipográficas a rectas, para que no haya dos formas del mismo nombre.
  t = t.replace(/[‘’]/g, "'").replace(/[“”]/g, '"')

  // Una imagen rota deja su alt pegado delante del nombre:
  // "File:Event Cute Corrosion.pngCyclical Extrapolation: Cute Corrosion"
  t = t.replace(/^File:.*?\.(?:png|jpg|jpeg|gif|webp|svg)\s*/i, '')

  // Endfield rotula "[Nombre del evento] Tipo Event".
  const bracketed = t.match(/^\[(.+?)\]\s*(.*)$/)
  if (bracketed) t = bracketed[1]

  // Las wikis desambiguan ocurrencias repetidas añadiendo la fecha al título
  // ("Nameless Honor 2026-08-26"). Para mostrar sobra: la fecha ya se ve
  // en la cuenta atrás.
  t = t.replace(/\s+\d{4}-\d{2}-\d{2}$/, '')

  // Algunas filas cuelgan el reparto detrás del nombre:
  // "Aptitude Showcase - Himeko • Nova, Anaxa, Cerydra, Aventurine, ..."
  t = t.replace(/\s*[-–—]\s*(?:[A-Z][\w.'•]*(?:\s+[\w.'•]+)*,\s*){2,}.*$/, '')

  // Quitar comillas solo si envuelven la cadena entera; si no, se pierde
  // el cierre de nombres que legítimamente llevan comillas dentro.
  const wrapped = t.match(/^"(.+)"$/)
  if (wrapped) t = wrapped[1]

  return t.trim()
}

/**
 * Clave de comparación. Agresiva a propósito: solo sirve para decidir si dos
 * filas son el mismo evento, nunca se muestra ni se guarda.
 */
export function dedupKey(title: string): string {
  return cleanTitle(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    // "Gift"/"Gifts" y el sufijo "Event" son ruido para comparar.
    .replace(/\b(gifts?|events?)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Un evento recurrente aparece a la vez en "Current" y en "Upcoming": son dos
 * ocurrencias del mismo nombre. Nos quedamos con la que termina antes, que es
 * la que el jugador puede jugar ahora; la siguiente entrará sola cuando el
 * cron vuelva a correr y esta haya caducado.
 */
export function dedupeByTitle<T extends { title: string; end_date: string }>(
  rows: T[]
): T[] {
  const best = new Map<string, T>()
  for (const row of rows) {
    const key = dedupKey(row.title)
    if (!key) continue
    const prev = best.get(key)
    if (!prev || row.end_date < prev.end_date) best.set(key, row)
  }
  return [...best.values()]
}
