import type { Database } from '@/lib/supabase/types'

export type GameSlug = Database['public']['Enums']['game_slug']

/**
 * Juegos temporalmente pausados mientras Honkai: Star Rail se valida al 100%.
 *
 * Este archivo es la ÚNICA fuente de verdad de la pausa. Pausar significa:
 *
 *   1. El scraper no lee la wiki ni escribe en `events` — guard al inicio de
 *      `runScraperForGame` (scraper-runner.ts), que cubre cron y `npm run scrape`.
 *   2. Su ruta de cron responde 200 con `paused: true` (cron-route.ts) para
 *      que Vercel no registre el disparo como fallo.
 *   3. La UI muestra el juego como «Próximamente» y sus eventos no aparecen.
 *      El filtro es en render/consulta, NUNCA en la base de datos: las filas
 *      quedan intactas para que reactivar sea borrar slugs de esta lista.
 *
 * Sin override para forzar un scrape manual: pausa es pausa.
 */
export const PAUSED_GAMES: readonly GameSlug[] = [
  'wuthering-waves',
  'zenless-zone-zero',
  'arknights-endfield',
]

export function isPausedGame(slug: string): boolean {
  return (PAUSED_GAMES as readonly string[]).includes(slug)
}
