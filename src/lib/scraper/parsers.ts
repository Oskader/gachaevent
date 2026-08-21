import * as cheerio from 'cheerio'
import { parseDuration } from './dates'
import { cleanTitle } from './normalize'

/**
 * Parseo determinista de las listas de eventos.
 *
 * La versión anterior hacía `$('body').text()` y le pedía a un LLM que
 * reconstruyera la tabla a partir del texto plano. Eso destruía la estructura
 * que la fuente ya traía hecha, y el modelo devolvía nombres mutilados,
 * duplicados y fechas inventadas.
 *
 * Aquí no hay modelo: se lee la tabla. Si la wiki cambia de formato, el
 * parser devuelve 0 filas y el runner lo reporta como fallo, que es mucho
 * mejor que guardar datos plausibles pero falsos.
 */

export interface ParsedEvent {
  title: string
  start_date: string
  end_date: string
  /** "Current" | "Upcoming" — de qué sección de la página salió. */
  section: string
  /**
   * Nombre de la página del evento en la wiki, tal cual lo enlaza la tabla.
   * No coincide siempre con `title`, porque este último se limpia para
   * mostrarlo y la wiki usa subpáginas ("Divergent Universe/...").
   * Es lo que permite ir a buscar la descripción a su propia página.
   */
  pageTitle?: string
}

/** El enlace de la celda apunta a la página del evento; File: y rojos no valen. */
function pageTitleFromCell($: cheerio.CheerioAPI, td: unknown): string | undefined {
  const link = $(td as never)
    .find('a')
    .filter((_i, a) => {
      const href = $(a).attr('href') ?? ''
      const t = $(a).attr('title') ?? ''
      if (/\/wiki\/File:/i.test(href) || /^File:/i.test(t)) return false
      // Los enlaces rojos apuntan a páginas que no existen.
      return !/redlink=1/.test(href) && !/\(page does not exist\)/i.test(t)
    })
    .first()

  const title = (link.attr('title') ?? '').trim()
  return title || undefined
}

/** Solo estas secciones. "Permanent" y los archivos por año no interesan. */
const WANTED_SECTIONS = /^(current|ongoing|upcoming)$/i

/**
 * Encabezado <h2..h4> que precede a un elemento en el árbol.
 *
 * Cheerio 1.x no reexporta los tipos de nodo de domhandler, así que se navega
 * con una forma estructural mínima en vez de con sus tipos.
 */
interface DomNodeish {
  tagName?: string
  prev: DomNodeish | null
  parent: DomNodeish | null
}

function precedingHeading(
  $: cheerio.CheerioAPI,
  el: DomNodeish
): string | null {
  let node: DomNodeish | null = el
  while (node) {
    let sibling: DomNodeish | null = node.prev
    while (sibling) {
      if (sibling.tagName && /^h[2-4]$/i.test(sibling.tagName)) {
        return $(sibling as never).text().replace(/\[edit\]/gi, '').trim()
      }
      sibling = sibling.prev
    }
    node = node.parent
  }
  return null
}

/**
 * Wikis de Fandom (HSR, ZZZ, Wuthering Waves).
 * Las páginas de eventos traen tablas con columnas Event | Duration | ...
 * agrupadas bajo encabezados Current / Upcoming / Permanent.
 */
export function parseFandomTables(html: string): ParsedEvent[] {
  const $ = cheerio.load(html)
  const out: ParsedEvent[] = []

  $('table').each((_, table) => {
    const $table = $(table)
    const headers = $table
      .find('tr')
      .first()
      .find('th,td')
      .map((_i, cell) => $(cell).text().trim())
      .get()

    const eventCol = headers.findIndex((h) => /^event$/i.test(h))
    const durationCol = headers.findIndex((h) => /^duration$/i.test(h))
    if (eventCol < 0 || durationCol < 0) return

    const section = (precedingHeading($, table as unknown as DomNodeish) ?? '').replace(/\[\]/g, '').trim()
    if (!WANTED_SECTIONS.test(section)) return

    $table.find('tr').slice(1).each((_i, row) => {
      const cells = $(row).find('td,th')
      if (cells.length < 2) return

      const dates = parseDuration($(cells.get(durationCol)).text())
      if (!dates) return

      // El texto visible de la celda, no el atributo `title` del enlace:
      // ese trae la ruta con subpáginas de la wiki
      // ("Threshold Simulation/Hard Mode/Myriad Endgame").
      const title = cleanTitle($(cells.get(eventCol)).text())
      if (!title) return

      out.push({
        title,
        ...dates,
        section,
        pageTitle: pageTitleFromCell($, cells.get(eventCol)),
      })
    })
  })

  return out
}

/**
 * endfield.wiki.gg no usa tabla: renderiza tarjetas `.mp-event` con el nombre
 * entre corchetes y una línea de horario por región.
 */
export function parseEndfieldCards(html: string, section: string): ParsedEvent[] {
  const $ = cheerio.load(html)
  const out: ParsedEvent[] = []

  $('.mp-event').each((_, card) => {
    const header = $(card).find('.mp-event-header').first().text()
    const title = cleanTitle(header)
    if (!title) return

    // Hay una línea por región. Se prefiere la occidental; si no está,
    // vale la primera, porque la diferencia entre husos es de horas y la
    // app razona en días.
    let line: string | null = null
    $(card).find('.mp-event-timer').each((_i, timer) => {
      const text = $(timer).text()
      if (/americas|europe/i.test(text)) line = text
      else if (!line) line = text
    })
    if (!line) return

    const dates = parseDuration(String(line).replace(/^[^:]*:\s*/, ''))
    if (!dates) return

    // El enlace a la página del evento cuelga de la tarjeta (de la imagen),
    // no de la cabecera.
    const link = $(card).find('a[title]').first()
    const pageTitle = (link.attr('title') ?? '').trim() || undefined

    out.push({ title, ...dates, section, pageTitle })
  })

  return out
}
