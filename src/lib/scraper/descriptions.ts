import * as cheerio from 'cheerio'

/**
 * Descripción de un evento, sacada de su propia página en la wiki.
 *
 * El tablón oficial de HoYoverse solo cubre los anuncios vigentes de dos de
 * los cuatro juegos, así que cubría ~10 de 36 eventos. Cada evento sí tiene
 * su propia página, y ahí está redactado lo que hace. Esto la busca.
 *
 * Ninguna de las cuatro wikis tiene la extensión TextExtracts, así que no se
 * puede pedir el resumen por API: hay que sacar el texto de cabecera del HTML.
 */

const UA = 'GachaDashBot/1.0 (https://gachadash.vercel.app)'

/** Cuántas páginas se piden a la vez. Suficiente para no tardar y no abusar. */
const CONCURRENCY = 5

const MAX_LENGTH = 260

/** Tope por página. Con 5 en paralelo, el peor caso queda muy por debajo de 60s. */
const PAGE_TIMEOUT_MS = 8000

/** Frases de plantilla y de mantenimiento que no describen nada. */
const NOISE =
  /(in need of information|can you help|click here|please help|this article is about|this page pertains|stub|edit source|ends in:)/i

/**
 * Etiquetas de pestaña y volcados de infobox que van pegados delante del texto
 * real ("OverviewHistory Deadly Assault is...", "Bedazzling DawnstarVersion
 * HomecomingType Sign-In... Bedazzling Dawnstar is a sign-in event...").
 *
 * En vez de perseguir el selector de cada wiki, se busca dónde empieza la
 * frase de definición y se corta por ahí.
 */
const DEFINITION = /(?:^|[\s.>])([A-Z][^.!?]{0,90}?\s(?:is|are)\s(?:a|an|the)\s)/

function cleanChrome($: cheerio.CheerioAPI) {
  const root = $('.mw-parser-output').first()
  const scope = root.length ? root : $('body')
  scope
    .find(
      'style, script, table, aside, figure, sup, .reference, ' +
        '.infobox, .portable-infobox, .mw-editsection, .navbox, .toc, ' +
        '.hatnote, .notice, .messagebox, .ambox, ' +
        '.wds-tabs, .wds-tabber__tabs, .mw-collapsible, ' +
        '.countdown, .mp-timer-container'
    )
    .remove()
  return scope
}

/** Texto que precede al primer encabezado de sección. */
function leadText($: cheerio.CheerioAPI, scope: cheerio.Cheerio<never>): string {
  const parts: string[] = []
  for (const node of scope.contents().toArray()) {
    const tag = (node as { tagName?: string }).tagName
    if (tag && /^h[1-3]$/i.test(tag)) break
    const text = $(node as never).text().replace(/\s+/g, ' ').trim()
    if (text) parts.push(text)
  }
  return parts.join(' ').replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1').trim()
}

function tidy(text: string): string {
  let out = text.trim()
  if (out.length <= MAX_LENGTH) return out
  const cut = out.slice(0, MAX_LENGTH)
  const stop = cut.lastIndexOf('. ')
  out = stop > 80 ? cut.slice(0, stop + 1) : `${cut.trimEnd()}…`
  return out
}

/**
 * Los widgets de cuenta atrás dejan restos pegados sin puntuación
 * ("AsiaEnds in:EuropeEnds in:AmericaEnds in: Fashion Guide..."), que además
 * hacen que la frase entera caiga en el filtro de ruido. Se limpian antes de
 * partir en frases, no después.
 */
function scrubBlob(text: string): string {
  return text
    .replace(/[A-Za-z]*\s*Ends?\s+in:\s*/gi, ' ')
    // Bloques de horario del infobox de wiki.gg, que no es una <table>:
    // "Server 2026/08/19 12:00 – 2026/09/03 06:00 (UTC+8)"
    .replace(/(?:Americas?|Europe|Asia|Global)?\s*Server\s*/gi, ' ')
    .replace(/\d{4}\/\d{1,2}\/\d{1,2}[\s\d:–—-]*(?:\(UTC[^)]*\))?/g, ' ')
    .replace(/This page is in need of information\.?/gi, ' ')
    .replace(/Can you help out\??/gi, ' ')
    .replace(/Click here to add more\.?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Una frase que define o explica, no una cita de ambientación. */
const EXPLANATORY = /\b(is|are)\s(a|an|the)\b|\bDuring\b|\ballows?\b|\bprovides?\b|\bfeatures?\b|\bplayers? can\b|\brewards?\b/i

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Corta el ruido de delante anclando en el nombre del evento.
 *
 * Es más fiable que buscar "X is a...": ahí el sujeto que captura la regex se
 * come lo que tenga pegado delante ("OverviewHistory Deadly Assault is a...",
 * "Universe PeriodsThe Human Comedy... Cyclical Extrapolation is a...").
 *
 * Se exige que el nombre vaya seguido del verbo, para saltarse la aparición
 * dentro del infobox, donde va seguido de "Version" o "Type".
 */
function sliceAtSubject(blob: string, title?: string): string | null {
  if (!title) return null
  const candidates = [title, title.split(/[:–—-]/)[0].trim()].filter(
    (t, i, all) => t.length > 3 && all.indexOf(t) === i
  )
  for (const name of candidates) {
    const match = blob.match(new RegExp(`${escapeRegex(name)}\\s+(?:is|are|was)\\b`, 'i'))
    if (match?.index !== undefined) return blob.slice(match.index)
  }
  return null
}

export function extractDescription(html: string, title?: string): string | null {
  const $ = cheerio.load(html)
  const scope = cleanChrome($) as unknown as cheerio.Cheerio<never>
  let blob = scrubBlob(leadText($, scope))
  if (!blob) return null

  // Anclar en el nombre del evento; si no aparece, caer en la heurística
  // genérica de "X is a ...".
  const anchored = sliceAtSubject(blob, title)
  if (anchored) {
    blob = anchored
  } else {
    const def = blob.match(DEFINITION)
    if (def && def.index !== undefined && def.index > 0) {
      blob = blob.slice(def.index + (def[0].length - def[1].length))
    }
  }

  const sentences = blob
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40 && !NOISE.test(s))

  if (sentences.length === 0) return null

  // Se prefiere la frase que explica sobre la cita de ambientación con la que
  // arrancan algunas páginas de colaboración.
  const start = Math.max(
    0,
    sentences.findIndex((s) => EXPLANATORY.test(s))
  )

  const first = sentences[start]
  const picked =
    first.length < 110 && sentences[start + 1]
      ? `${first} ${sentences[start + 1]}`
      : first

  const result = tidy(picked)
  return result.length >= 40 ? result : null
}

async function fetchDescription(
  host: string,
  pageTitle: string,
  title?: string
): Promise<string | null> {
  try {
    const url =
      `https://${host}/api.php?action=parse&prop=text&redirects=1&format=json` +
      `&page=${encodeURIComponent(pageTitle)}`
    // Una wiki lenta no puede comerse el presupuesto de la función: la ruta
    // de cron tiene 60s y esto se hace una vez por evento.
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const json = await res.json()
    if (json?.error) return null
    const html: string = json?.parse?.text?.['*'] ?? ''
    return html ? extractDescription(html, title) : null
  } catch {
    return null
  }
}

export interface DescriptionTarget {
  /** Clave con la que se devolverá el resultado (el título del evento). */
  key: string
  /**
   * Páginas a probar, en orden de preferencia. Las wikis enlazan la
   * ocurrencia con fecha ("Nameless Honor/2026-07-15"), que suele ser una
   * subpágina sin texto de entrada; la página base sí lo tiene.
   */
  candidates: string[]
}

/**
 * Busca la descripción de cada evento en su propia página, probando los
 * candidatos en orden hasta que uno dé texto. Nunca lanza: una página caída
 * deja ese evento sin descripción, no tumba el scraping entero.
 */
export async function fetchDescriptions(
  host: string,
  targets: DescriptionTarget[]
): Promise<Map<string, string>> {
  const found = new Map<string, string>()

  // Caché por página: varios eventos pueden compartir candidato base.
  const cache = new Map<string, string | null>()
  const lookup = async (page: string, eventTitle: string) => {
    const cacheKey = `${page}|${eventTitle}`
    if (!cache.has(cacheKey)) {
      cache.set(cacheKey, await fetchDescription(host, page, eventTitle))
    }
    return cache.get(cacheKey) ?? null
  }

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY)
    await Promise.all(
      batch.map(async (target) => {
        for (const candidate of target.candidates) {
          if (!candidate) continue
          const description = await lookup(candidate, target.key)
          if (description) {
            found.set(target.key, description)
            return
          }
        }
      })
    )
  }

  return found
}
