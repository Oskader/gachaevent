import { NextRequest, NextResponse } from 'next/server'
import { runScraperForGame } from './scraper-runner'

/**
 * Construye el handler GET de una ruta de cron de scraping.
 *
 * La ruta ya no lleva URL: la fuente de cada juego vive en `sources.ts`, que
 * es donde está documentada la comparativa de fuentes.
 */
export function createCronScraper(gameSlug: string) {
  return async function GET(req: NextRequest) {
    const cronSecret = process.env.CRON_SECRET

    // Sin esto, un CRON_SECRET ausente hace que el header esperado sea
    // literalmente "Bearer undefined" y cualquiera dispare el scraper.
    if (!cronSecret) {
      console.error(`[${gameSlug}] CRON_SECRET is not set; refusing to run`)
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }

    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await runScraperForGame(gameSlug)

    if (!result.success) {
      console.error(`[${gameSlug}] scrape failed: ${result.error}`)
    } else {
      console.log(
        `[${gameSlug}] ${result.eventsUpserted} eventos ` +
          `(${result.duplicatesCollapsed ?? 0} duplicados fusionados, ` +
          `${result.eventsEnriched ?? 0} con descripción oficial)`
      )
    }

    return NextResponse.json(result, { status: result.success ? 200 : 500 })
  }
}
