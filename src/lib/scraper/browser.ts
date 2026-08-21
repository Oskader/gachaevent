import * as cheerio from 'cheerio'

export interface FetchedContent {
  rawText: string
  sourceUrl: string
}

/** Tope de caracteres que se manda al LLM. Acota el coste del prompt. */
const MAX_CHARS = 12000

/**
 * Fetches content from a MediaWiki API endpoint (Fandom, wiki.gg, etc.)
 * using the ?action=parse route which avoids bot-detection 403s.
 */
export async function fetchMediaWiki(url: string): Promise<FetchedContent> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'GachaDashBot/1.0 (https://gachadash.vercel.app)',
      'Accept': 'application/json',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`MediaWiki fetch failed: ${res.status} ${res.statusText}`)
  }

  const json = await res.json()

  // La API responde 200 con un cuerpo de error; hay que mirarlo explícitamente.
  if (json?.error) {
    throw new Error(
      `MediaWiki API error: ${json.error.code} — ${json.error.info}`
    )
  }

  const html = json?.parse?.text?.['*'] ?? ''

  // action=parse NO sigue redirects: devuelve el stub de redirección con 200.
  // Sin este guard el fallo se ve como "no hay eventos" en vez de como un error.
  if (/class="redirectText"/i.test(html)) {
    throw new Error(
      `MediaWiki page "${json?.parse?.title}" is a redirect; point the scraper at the real page`
    )
  }

  const $ = cheerio.load(html)
  $('script, style, table.navbox, .mw-editsection, .toc, .noprint, .mw-empty-elt').remove()
  const rawText = $('body').text().replace(/\s+/g, ' ').trim()

  return { rawText: rawText.substring(0, MAX_CHARS), sourceUrl: url }
}

/**
 * Fetches content from a regular HTML page using plain fetch + Cheerio.
 * Works for sites that don't need JS rendering.
 */
export async function fetchStaticPage(url: string): Promise<FetchedContent> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; GachaDashBot/1.0)',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Static fetch failed: ${res.status} ${res.statusText}`)
  }

  const html = await res.text()
  const $ = cheerio.load(html)
  $('script, style, nav, footer, header, .ads, .cookie-banner').remove()

  // Un selector agrupado + .first() devuelve SIEMPRE <body>, porque cheerio
  // ordena por documento y el ancestro va primero. Hay que probar en orden
  // de preferencia y quedarse con el primero que exista de verdad.
  const preferred = ['main', 'article', '.content']
  const container = preferred
    .map((sel) => $(sel).first())
    .find((el) => el.length > 0)

  const rawText = (container ?? $('body'))
    .text()
    .replace(/\s+/g, ' ')
    .trim()

  return { rawText: rawText.substring(0, MAX_CHARS), sourceUrl: url }
}
