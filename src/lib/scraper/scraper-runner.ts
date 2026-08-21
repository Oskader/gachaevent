import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { fetchMediaWiki } from './browser'
import { parseEndfieldCards, parseFandomTables, type ParsedEvent } from './parsers'
import { dedupeByTitle, dedupKey } from './normalize'
import { fetchHoyoEnrichment } from './hoyo-announcements'
import { SOURCES } from './sources'

export interface ScrapeResult {
  success: boolean
  eventsUpserted: number
  eventsParsed?: number
  eventsEnriched?: number
  duplicatesCollapsed?: number
  eventsDeactivated?: number
  error?: string
}

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient<Database>(url, key)
}

/** Descarga y parsea la lista de eventos según la fuente del juego. */
async function collectEvents(gameSlug: string): Promise<ParsedEvent[]> {
  const source = SOURCES[gameSlug]
  if (!source) throw new Error(`No source configured for ${gameSlug}`)

  if (source.parser === 'endfield-cards') {
    const collected: ParsedEvent[] = []
    for (const section of source.sections ?? []) {
      const url = `${source.sourceUrl}&section=${section.index}`
      const { html } = await fetchMediaWiki(url)
      collected.push(...parseEndfieldCards(html, section.label))
    }
    return collected
  }

  const { html } = await fetchMediaWiki(source.sourceUrl)
  return parseFandomTables(html)
}

export async function runScraperForGame(gameSlug: string): Promise<ScrapeResult> {
  const source = SOURCES[gameSlug]
  if (!source) {
    return { success: false, eventsUpserted: 0, error: `Unknown game: ${gameSlug}` }
  }

  let supabase: ReturnType<typeof getServiceRoleClient>
  try {
    supabase = getServiceRoleClient()
  } catch (err) {
    return { success: false, eventsUpserted: 0, error: String(err) }
  }

  const { data: game } = await supabase
    .from('games')
    .select('id')
    .eq('slug', gameSlug as Database['public']['Enums']['game_slug'])
    .single()

  if (!game) {
    return { success: false, eventsUpserted: 0, error: `Game not found: ${gameSlug}` }
  }

  // 1. Lista de eventos, parseada de la estructura que la fuente ya trae.
  let parsed: ParsedEvent[]
  try {
    parsed = await collectEvents(gameSlug)
  } catch (err) {
    return { success: false, eventsUpserted: 0, error: `Fetch/parse failed: ${err}` }
  }

  // Cero filas con la descarga correcta significa que la wiki cambió de
  // formato. Es un fallo que hay que ver, no un "hoy no hay eventos": si se
  // devolviera éxito, la app se quedaría con datos viejos sin avisar.
  if (parsed.length === 0) {
    return {
      success: false,
      eventsUpserted: 0,
      eventsParsed: 0,
      error: `Parsed 0 events from ${source.humanUrl} — el formato de la página pudo cambiar`,
    }
  }

  const deduped = dedupeByTitle(
    parsed.map((e) => ({ ...e, end_date: e.end_date }))
  )

  // 2. Enriquecimiento con el tablón oficial (solo HSR y ZZZ lo tienen).
  const enrichment = await fetchHoyoEnrichment(gameSlug)
  let enriched = 0

  // 3. Merge contra lo ya guardado, para que una pasada sin descripción no
  //    borre una buena de la pasada anterior.
  //    Se traen todas las filas del juego y se cruzan en memoria, por el mismo
  //    motivo que en el paso 4: un `in` sobre títulos con comillas no casa.
  const { data: existing } = await supabase
    .from('events')
    .select('title, description, rewards')
    .eq('game_id', game.id)

  const previous = new Map((existing ?? []).map((row) => [row.title, row]))

  /**
   * El pipeline anterior guardaba como descripción cosas que no lo eran:
   * "Collaboration", "Web", el contenido de la columna Type. Al arrastrarlas
   * hacia delante ensuciarían las tarjetas, así que solo se conserva lo que
   * parece una frase.
   */
  const usableDescription = (value: string | null | undefined) =>
    value && value.trim().length >= 30 ? value : null

  const rows = deduped.map((event) => {
    const extra = enrichment.get(dedupKey(event.title))
    if (extra?.description) enriched++
    const prev = previous.get(event.title)

    return {
      game_id: game.id,
      title: event.title,
      description: extra?.description ?? usableDescription(prev?.description),
      // El tablón oficial da la hora exacta; la wiki solo el día.
      start_date: extra?.start_date ?? event.start_date,
      end_date: extra?.end_date ?? event.end_date,
      rewards: prev?.rewards ?? null,
      source_url: source.humanUrl,
      is_active: true,
    }
  })

  const { error: upsertError } = await supabase
    .from('events')
    .upsert(rows, { onConflict: 'game_id,title', ignoreDuplicates: false })

  if (upsertError) {
    return { success: false, eventsUpserted: 0, error: upsertError.message }
  }

  // 4. Reconciliar: lo que la fuente ya no lista deja de estar activo.
  //
  //    Sin esto la tabla solo crece. Arrastraba 191 filas —duplicados de
  //    versiones anteriores del scraper y eventos terminados hace meses— que
  //    seguían saliendo en la app. Se desactiva en vez de borrar: es
  //    reversible y conserva el histórico.
  //    La comparación se hace en memoria, no con filtros `in`/`not.in` sobre
  //    títulos: hay eventos cuyo nombre lleva comillas dobles —por ejemplo
  //    Wuthering Waves Fan Creation Event "Blade of Past Resounds"— y PostgREST
  //    no los casa dentro de una lista, así que el scraper desactivaba una fila
  //    que acababa de escribir y la reactivaba en la pasada siguiente.
  const { data: activeRows } = await supabase
    .from('events')
    .select('id, title')
    .eq('game_id', game.id)
    .eq('is_active', true)

  const wanted = new Set(rows.map((r) => r.title))
  const staleIds = (activeRows ?? [])
    .filter((r) => !wanted.has(r.title))
    .map((r) => r.id)

  let deactivated = 0
  if (staleIds.length > 0) {
    const { count } = await supabase
      .from('events')
      .update({ is_active: false }, { count: 'exact' })
      .in('id', staleIds)
    deactivated = count ?? 0
  }

  return {
    success: true,
    eventsUpserted: rows.length,
    eventsParsed: parsed.length,
    eventsEnriched: enriched,
    duplicatesCollapsed: parsed.length - deduped.length,
    eventsDeactivated: deactivated,
  }
}
