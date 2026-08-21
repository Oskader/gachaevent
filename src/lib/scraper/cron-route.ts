import { NextRequest, NextResponse } from 'next/server'
import { runScraperForGame, type FetchStrategy } from './scraper-runner'

interface CronScraperConfig {
  gameSlug: string
  sourceUrl: string
  strategy?: FetchStrategy
}

/**
 * Construye el handler GET de una ruta de cron de scraping.
 *
 * Las cuatro rutas eran idénticas salvo dos constantes; esto deja una sola
 * copia de la lógica de autenticación, que es la parte que no conviene
 * divergir entre rutas.
 */
export function createCronScraper({
  gameSlug,
  sourceUrl,
  strategy = 'mediawiki',
}: CronScraperConfig) {
  return async function GET(req: NextRequest) {
    const cronSecret = process.env.CRON_SECRET

    // Sin esto, un CRON_SECRET ausente hace que el header esperado sea
    // literalmente "Bearer undefined" y cualquiera pueda disparar el scraper.
    if (!cronSecret) {
      console.error(`[${gameSlug}] CRON_SECRET is not set; refusing to run`)
      return NextResponse.json(
        { error: 'Server misconfigured' },
        { status: 500 }
      )
    }

    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await runScraperForGame(gameSlug, sourceUrl, strategy)

    if (!result.success) {
      console.error(`[${gameSlug}] scrape failed: ${result.error}`)
    }

    return NextResponse.json(result, { status: result.success ? 200 : 500 })
  }
}
