import { dedupKey } from './normalize'

/**
 * Tablón de anuncios oficial de HoYoverse.
 *
 * Es el mismo endpoint que consume el juego, así que es la fuente autorizada:
 * fechas con hora exacta y texto redactado por el estudio. Wuthering Waves
 * (Kuro) y Endfield (Hypergryph) no exponen nada equivalente — comprobado
 * contra sus APIs públicas.
 *
 * **Hoy solo rinde en Zenless (8 de 16 eventos).** Comprobado el 2026-08-24:
 * `getAnnList` devuelve para Zenless los grupos `Announcements` y `Events`,
 * pero para Honkai un único grupo `Notices` con 13 entradas que son notas de
 * parche y mantenimientos — ni uno de los eventos que la wiki lista como
 * activos. Probado con `region` en asia / usa / eur / cht y con
 * `auth_appid=announcement`: no cambia. Se deja conectado porque no cuesta
 * nada y HoYo puede volver a publicarlos, pero **Honkai nunca obtiene hora
 * exacta por aquí**: se queda con el día que da la wiki.
 *
 * Se usa como CAPA DE ENRIQUECIMIENTO, no como lista maestra: el tablón mezcla
 * eventos con notas de parche y avisos de mantenimiento, y su ventana es la
 * del anuncio, no la del evento. La lista sigue saliendo de la wiki.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/**
 * El `lang` se inyecta porque el mismo anuncio se pide en los dos idiomas:
 * el inglés para emparejar contra la wiki, el español para la descripción.
 */
const ENDPOINTS: Record<string, (lang: string) => string> = {
  'honkai-star-rail': (lang) =>
    `https://sg-hkrpg-api.hoyoverse.com/common/hkrpg_global/announcement/api/getAnnContent?game=hkrpg&game_biz=hkrpg_global&lang=${lang}&bundle_id=hkrpg_global&platform=pc&region=prod_official_asia&level=70&uid=1`,
  'zenless-zone-zero': (lang) =>
    `https://sg-announcement-api.hoyoverse.com/common/nap_global/announcement/api/getAnnContent?game=nap&game_biz=nap_global&lang=${lang}&bundle_id=nap_global&platform=pc&region=prod_gf_jp&level=60&uid=1`,
}

export interface Enrichment {
  description: string | null
  /**
   * Descripción oficial en español, sacada del MISMO anuncio.
   *
   * Se cruza por `ann_id`, no por nombre, y esa es toda la gracia: el tablón
   * español traduce también los nombres («Las vacaciones de una peligrosa
   * fugitiva»), así que emparejarlo contra los títulos ingleses de la wiki
   * daría cero. Cruzando por id el emparejamiento sigue siendo el inglés
   * —que ya funciona— y el español se saca del anuncio hermano.
   */
  description_es?: string | null
  /** Ventana real del evento, si el anuncio la declara. */
  start_date?: string
  end_date?: string
  /**
   * Banner oficial del anuncio. **Hoy nadie lo rellena, a propósito.**
   *
   * `getAnnContent` —el mismo endpoint del que salen estas descripciones— ya
   * devuelve el campo `banner` en cada item, así que activarlo no costará
   * ninguna petición nueva: será leer `item.banner` en el bucle de
   * `fetchHoyoEnrichment`. El cruce por `dedupKey` ya está resuelto y lo
   * hereda gratis.
   *
   * Queda declarado para que la cadena de preferencia de `scraper-runner.ts`
   * esté escrita de una vez y encenderlo sea rellenar un campo, no rehacerla.
   * Lo que sí hará falta: el `remotePattern` de `sdk.hoyoverse.com`.
   * Ver §6 del diseño.
   *
   * Al rellenarlo, normaliza la cadena vacía a `null`. La cadena de
   * preferencia de `scraper-runner.ts` usa `??`, que NO salta `''`: un
   * anuncio con `banner: ""` machacaría en silencio la imagen buena que vino
   * de la wiki, y la fila se quedaría sin miniatura sin dar ningún error.
   */
  banner?: string | null
}

interface AnnItem {
  ann_id: number
  title?: string
  subtitle?: string
  content?: string
}

/**
 * Solo las etiquetas de bloque cortan línea.
 *
 * Convertir *toda* etiqueta en salto partía las frases por la mitad cada vez
 * que el anuncio metía un <span> para colorear el nombre de un objeto, y la
 * descripción acababa en "...can head to Roscaelifer to find".
 */
function stripHtml(html: string): string {
  return html
    .replace(/<\s*(?:br|\/p|\/div|\/li|\/tr|\/h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]+/g, ' ')
    // Al decodificar &quot; junto a una comilla que ya estaba en el texto
    // salen pares: 'During the ""Gift From the Clouds" event'.
    .replace(/"{2,}/g, '"')
    .trim()
}

/** El nombre del evento va entre comillas en el subtítulo del anuncio. */
function eventNameFrom(subtitle: string): string {
  const plain = subtitle.replace(/<[^>]*>/g, '').trim()
  const quoted = plain.match(/["“”]([^"“”]+)["“”]/)
  return (quoted ? quoted[1] : plain)
    .replace(/\s*Event Details\s*$/i, '')
    .trim()
}

/**
 * Primera viñeta con sustancia bajo "Event Details" / "Detalles del evento".
 *
 * El ancla cambia con el idioma: el tablón español no dice "Event Details",
 * así que sin esto la versión española devolvería siempre null.
 */
function descriptionFrom(text: string, lang: 'en' | 'es' = 'en'): string | null {
  const anchor =
    lang === 'es'
      ? /Detalles del evento\s*\n([\s\S]{0,600})/i
      : /Event Details?\s*\n([\s\S]{0,600})/i
  const section = text.match(anchor)
  if (!section) return null

  const line = section[1]
    .split('\n')
    .map((s) => s.replace(/^[•·\-\s]+/, '').trim())
    .find((s) => s.length > 40)

  if (!line) return null
  if (line.length <= 280) return line

  // Cortar en el final de frase anterior al límite, no a mitad de palabra.
  const cut = line.slice(0, 280)
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '))
  return lastStop > 80 ? cut.slice(0, lastStop + 1) : `${cut.trimEnd()}…`
}

/**
 * Las horas del tablón son HORA DE SERVIDOR, no UTC.
 *
 * Los dos endpoints de arriba piden explícitamente el servidor de Asia
 * (`prod_official_asia`, `prod_gf_jp`), cuya hora es UTC+8. Leer
 * "2026/09/07 03:59 (server time)" como si fuera UTC dejaba el evento ocho
 * horas más tarde de lo que acaba — justo el orden de magnitud que importa
 * cuando el umbral rojo de la cuenta atrás son 12 h.
 *
 * Asia es además la región que cierra ANTES en tiempo absoluto, así que la
 * cuenta atrás peca de conservadora: nunca promete tiempo que ya no existe.
 */
const SERVER_OFFSET_MINUTES = 8 * 60

/** "Event Duration 2026/08/19 10:00 (server time) – 2026/09/07 03:59" */
function durationFrom(text: string): { start: string; end: string } | null {
  const m = text.match(
    /Event Duration\D{0,40}?(\d{4}\/\d{1,2}\/\d{1,2}(?:\s+\d{1,2}:\d{2})?)[\s\S]{0,40}?(\d{4}\/\d{1,2}\/\d{1,2}(?:\s+\d{1,2}:\d{2})?)/i
  )
  if (!m) return null

  const toIso = (s: string) => {
    const p = s.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/)
    if (!p) return null
    const local = Date.UTC(+p[1], +p[2] - 1, +p[3], p[4] ? +p[4] : 0, p[5] ? +p[5] : 0)
    return new Date(local - SERVER_OFFSET_MINUTES * 60_000).toISOString()
  }

  const start = toIso(m[1])
  const end = toIso(m[2])
  if (!start || !end || end <= start) return null
  return { start, end }
}

/**
 * Lista de anuncios en un idioma. Devuelve [] si algo falla: el tablón es una
 * capa de enriquecimiento, y que se caiga no puede tumbar el scraping.
 */
async function fetchAnnouncements(url: string, gameSlug: string): Promise<AnnItem[]> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []

    const json = await res.json()
    if (json?.retcode !== 0) return []

    return (json?.data?.list ?? []) as AnnItem[]
  } catch (err) {
    console.warn(`[${gameSlug}] tablón oficial no disponible: ${err}`)
    return []
  }
}

/**
 * Devuelve un índice por clave de deduplicación, listo para cruzar con los
 * títulos que salieron de la wiki. Nunca lanza: si el tablón falla, el
 * scraping sigue con lo que tenga.
 */
export async function fetchHoyoEnrichment(
  gameSlug: string
): Promise<Map<string, Enrichment>> {
  const index = new Map<string, Enrichment>()
  const buildUrl = ENDPOINTS[gameSlug]
  if (!buildUrl) return index

  const [en, es] = await Promise.all([
    fetchAnnouncements(buildUrl('en'), gameSlug),
    fetchAnnouncements(buildUrl('es'), gameSlug),
  ])

  // El español se indexa por `ann_id`. Ver el comentario de `description_es`:
  // cruzarlo por nombre no funcionaría porque el tablón los traduce.
  const spanishById = new Map(es.map((item) => [item.ann_id, item]))

  for (const item of en) {
    const name = eventNameFrom(item.subtitle || item.title || '')
    if (!name) continue

    const text = stripHtml(item.content || '')
    const duration = durationFrom(text)

    const sibling = spanishById.get(item.ann_id)
    const spanishText = sibling ? stripHtml(sibling.content || '') : ''

    index.set(dedupKey(name), {
      description: descriptionFrom(text),
      description_es: spanishText ? descriptionFrom(spanishText, 'es') : null,
      ...(duration ? { start_date: duration.start, end_date: duration.end } : {}),
    })
  }

  return index
}
