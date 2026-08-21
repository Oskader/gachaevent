import { dedupKey } from './normalize'

/**
 * Tablón de anuncios oficial de HoYoverse.
 *
 * Es el mismo endpoint que consume el juego, así que es la fuente autorizada:
 * fechas con hora exacta, texto redactado por el estudio y banner. Solo cubre
 * los dos juegos de HoYo; Wuthering Waves (Kuro) y Endfield (Hypergryph) no
 * exponen nada equivalente — lo comprobé contra sus APIs públicas.
 *
 * Se usa como CAPA DE ENRIQUECIMIENTO, no como lista maestra: el tablón mezcla
 * eventos con notas de parche y avisos de mantenimiento, y su ventana es la
 * del anuncio, no la del evento. La lista sigue saliendo de la wiki.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const ENDPOINTS: Record<string, string> = {
  'honkai-star-rail':
    'https://sg-hkrpg-api.hoyoverse.com/common/hkrpg_global/announcement/api/getAnnContent?game=hkrpg&game_biz=hkrpg_global&lang=en&bundle_id=hkrpg_global&platform=pc&region=prod_official_asia&level=70&uid=1',
  'zenless-zone-zero':
    'https://sg-announcement-api.hoyoverse.com/common/nap_global/announcement/api/getAnnContent?game=nap&game_biz=nap_global&lang=en&bundle_id=nap_global&platform=pc&region=prod_gf_jp&level=60&uid=1',
}

export interface Enrichment {
  description: string | null
  /** Ventana real del evento, si el anuncio la declara. */
  start_date?: string
  end_date?: string
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

/** Primera viñeta con sustancia bajo "Event Details". */
function descriptionFrom(text: string): string | null {
  const section = text.match(/Event Details?\s*\n([\s\S]{0,600})/i)
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

/** "Event Duration 2026/08/19 10:00 (server time) – 2026/09/07 03:59" */
function durationFrom(text: string): { start: string; end: string } | null {
  const m = text.match(
    /Event Duration\D{0,40}?(\d{4}\/\d{1,2}\/\d{1,2}(?:\s+\d{1,2}:\d{2})?)[\s\S]{0,40}?(\d{4}\/\d{1,2}\/\d{1,2}(?:\s+\d{1,2}:\d{2})?)/i
  )
  if (!m) return null

  const toIso = (s: string) => {
    const p = s.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/)
    if (!p) return null
    return new Date(
      Date.UTC(+p[1], +p[2] - 1, +p[3], p[4] ? +p[4] : 0, p[5] ? +p[5] : 0)
    ).toISOString()
  }

  const start = toIso(m[1])
  const end = toIso(m[2])
  if (!start || !end || end <= start) return null
  return { start, end }
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
  const url = ENDPOINTS[gameSlug]
  if (!url) return index

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return index

    const json = await res.json()
    if (json?.retcode !== 0) return index

    for (const item of json?.data?.list ?? []) {
      const name = eventNameFrom(item.subtitle || item.title || '')
      if (!name) continue

      const text = stripHtml(item.content || '')
      const duration = durationFrom(text)

      index.set(dedupKey(name), {
        description: descriptionFrom(text),
        ...(duration ? { start_date: duration.start, end_date: duration.end } : {}),
      })
    }
  } catch (err) {
    console.warn(`[${gameSlug}] tablón oficial no disponible: ${err}`)
  }

  return index
}
