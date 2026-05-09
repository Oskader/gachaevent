import * as cheerio from 'cheerio'

export interface FetchedContent {
  rawText: string
  sourceUrl: string
}

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
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    throw new Error(`MediaWiki fetch failed: ${res.status} ${res.statusText}`)
  }

  const json = await res.json()
  const html = json?.parse?.text?.['*'] ?? ''

  const $ = cheerio.load(html)
  $('script, style, table.navbox, .mw-editsection, .toc, .noprint, .mw-empty-elt').remove()
  const rawText = $('body').text().replace(/\s+/g, ' ').trim()

  return { rawText: rawText.substring(0, 12000), sourceUrl: url }
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
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    throw new Error(`Static fetch failed: ${res.status} ${res.statusText}`)
  }

  const html = await res.text()
  const $ = cheerio.load(html)
  $('script, style, nav, footer, header, .ads, .cookie-banner').remove()
  const rawText = $('main, article, .content, body').first().text().replace(/\s+/g, ' ').trim()

  return { rawText: rawText.substring(0, 12000), sourceUrl: url }
}
