import { NextRequest, NextResponse } from 'next/server'
import { runScraperForGame } from '@/lib/scraper/scraper-runner'

const GAME_SLUG = 'arknights-endfield'
// Using Arknights wiki.gg MediaWiki API
const SOURCE_URL = 'https://arknights.wiki.gg/api.php?action=parse&page=Event&format=json'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runScraperForGame(GAME_SLUG, SOURCE_URL, 'mediawiki')

  return NextResponse.json(result, {
    status: result.success ? 200 : 500,
  })
}
