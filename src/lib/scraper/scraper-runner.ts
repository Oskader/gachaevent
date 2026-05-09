import { fetchMediaWiki, fetchStaticPage } from './browser'
import { callGroqWithRetry } from './groq-extractor'
import type { ExtractedEvent } from './groq-extractor'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export type FetchStrategy = 'mediawiki' | 'static'

function getServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function runScraperForGame(
  gameSlug: string,
  sourceUrl: string,
  strategy: FetchStrategy = 'mediawiki'
): Promise<{ success: boolean; eventsUpserted: number; error?: string }> {
  const supabase = getServiceRoleClient()

  // 1. Get game_id from DB
  const { data: game } = await supabase
    .from('games')
    .select('id')
    .eq('slug', gameSlug as Database['public']['Enums']['game_slug'])
    .single()

  if (!game)
    return {
      success: false,
      eventsUpserted: 0,
      error: `Game not found: ${gameSlug}`,
    }

  // 2. Fetch content using the appropriate strategy
  let rawText: string
  try {
    const fetched =
      strategy === 'mediawiki'
        ? await fetchMediaWiki(sourceUrl)
        : await fetchStaticPage(sourceUrl)
    rawText = fetched.rawText
  } catch (err) {
    return {
      success: false,
      eventsUpserted: 0,
      error: `Fetching failed: ${err}`,
    }
  }

  if (!rawText) {
    return { success: false, eventsUpserted: 0, error: 'Empty content fetched' }
  }

  // 3. Call Groq with retries
  let events: ExtractedEvent[]
  try {
    events = await callGroqWithRetry(rawText, gameSlug)
  } catch (err) {
    return {
      success: false,
      eventsUpserted: 0,
      error: `Groq extraction failed after 3 retries: ${err}`,
    }
  }

  // Filter events missing required end_date (NOT NULL in DB)
  const validEvents = events.filter((e) => {
    if (!e.end_date || e.end_date === 'null') {
      console.warn(`[${gameSlug}] Skipping event "${e.title}" — no end_date`)
      return false
    }
    return true
  })

  if (validEvents.length === 0) {
    return { success: true, eventsUpserted: 0 }
  }

  // Deduplicate within the same batch by title (Groq may return duplicates)
  const seen = new Set<string>()
  const dedupedEvents = validEvents.filter((e) => {
    if (seen.has(e.title)) return false
    seen.add(e.title)
    return true
  })

  // 4. Upsert into Supabase (avoid duplicates by title + game_id)
  const rows = dedupedEvents.map((e) => ({
    game_id: game.id,
    title: e.title,
    description: e.description,
    start_date: e.start_date,
    end_date: e.end_date,
    rewards: e.rewards ? { items: e.rewards } : null,
    source_url: sourceUrl,
    is_active: true,
  }))

  const { error: upsertError } = await supabase.from('events').upsert(rows, {
    onConflict: 'game_id,title',
    ignoreDuplicates: false,
  })

  if (upsertError) {
    return {
      success: false,
      eventsUpserted: 0,
      error: upsertError.message,
    }
  }

  return { success: true, eventsUpserted: rows.length }
}
