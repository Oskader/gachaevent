import { fetchMediaWiki, fetchStaticPage } from './browser'
import { callGroqWithRetry } from './groq-extractor'
import type { ExtractedEvent } from './groq-extractor'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export type FetchStrategy = 'mediawiki' | 'static'

export interface ScrapeResult {
  success: boolean
  eventsUpserted: number
  eventsDiscarded?: number
  error?: string
}

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Sin este guard, un env var ausente produce un fallo opaco dentro del SDK.
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  return createClient<Database>(url, key)
}

/** Una fecha sirve solo si existe y Postgres la va a aceptar. */
function isUsableDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false
  return !Number.isNaN(Date.parse(trimmed))
}

export async function runScraperForGame(
  gameSlug: string,
  sourceUrl: string,
  strategy: FetchStrategy = 'mediawiki'
): Promise<ScrapeResult> {
  let supabase: ReturnType<typeof getServiceRoleClient>
  try {
    supabase = getServiceRoleClient()
  } catch (err) {
    return { success: false, eventsUpserted: 0, error: String(err) }
  }

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

  // 4. Validar contra el esquema ANTES de tocar la BD.
  //    start_date y end_date son ambos NOT NULL: si uno solo viene mal, el
  //    upsert del lote entero falla y no se guarda ni un evento.
  const validEvents = events.filter((e) => {
    if (!e?.title?.trim()) {
      console.warn(`[${gameSlug}] Skipping event with no title`)
      return false
    }
    if (!isUsableDate(e.start_date)) {
      console.warn(`[${gameSlug}] Skipping "${e.title}" — bad start_date: ${e.start_date}`)
      return false
    }
    if (!isUsableDate(e.end_date)) {
      console.warn(`[${gameSlug}] Skipping "${e.title}" — bad end_date: ${e.end_date}`)
      return false
    }
    return true
  })

  const discarded = events.length - validEvents.length

  if (validEvents.length === 0) {
    return { success: true, eventsUpserted: 0, eventsDiscarded: discarded }
  }

  // Deduplicate within the same batch by title (Groq may return duplicates)
  const seen = new Set<string>()
  const dedupedEvents = validEvents.filter((e) => {
    const key = e.title.trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // 5. El upsert es un UPDATE sobre (game_id, title). Sin este merge, una
  //    corrida en la que el LLM devuelva description/rewards nulos borraría
  //    los datos buenos que guardó la corrida anterior.
  const { data: existing } = await supabase
    .from('events')
    .select('title, description, rewards')
    .eq('game_id', game.id)
    .in('title', dedupedEvents.map((e) => e.title.trim()))

  const previous = new Map(
    (existing ?? []).map((row) => [row.title, row])
  )

  const rows = dedupedEvents.map((e) => {
    const title = e.title.trim()
    const prev = previous.get(title)
    const rewards =
      e.rewards && e.rewards.length > 0 ? { items: e.rewards } : null

    return {
      game_id: game.id,
      title,
      description: e.description ?? prev?.description ?? null,
      start_date: e.start_date,
      end_date: e.end_date,
      rewards: rewards ?? prev?.rewards ?? null,
      source_url: sourceUrl,
      is_active: true,
    }
  })

  const { error: upsertError } = await supabase.from('events').upsert(rows, {
    onConflict: 'game_id,title',
    ignoreDuplicates: false,
  })

  if (upsertError) {
    return {
      success: false,
      eventsUpserted: 0,
      eventsDiscarded: discarded,
      error: upsertError.message,
    }
  }

  return {
    success: true,
    eventsUpserted: rows.length,
    eventsDiscarded: discarded,
  }
}
