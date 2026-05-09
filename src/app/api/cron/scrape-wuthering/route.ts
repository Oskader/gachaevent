import { NextRequest, NextResponse } from 'next/server'
import { runScraperForGame } from '@/lib/scraper/scraper-runner'

const GAME_SLUG = 'wuthering-waves'
// Using Fandom wiki static page (kurogames.com requires JS rendering)
const SOURCE_URL = 'https://wutheringwaves.fandom.com/api.php?action=parse&page=Event&format=json'

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
