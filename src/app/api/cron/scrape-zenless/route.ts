import { NextRequest, NextResponse } from 'next/server'
import { runScraperForGame } from '@/lib/scraper/scraper-runner'

const GAME_SLUG = 'zenless-zone-zero'
const SOURCE_URL = 'https://zenless.hoyoverse.com/en-us/news'

export const maxDuration = 10

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runScraperForGame(GAME_SLUG, SOURCE_URL)

  return NextResponse.json(result, {
    status: result.success ? 200 : 500,
  })
}
