/**
 * Radiografía del estado de los datos. Solo lee, nunca escribe.
 *
 *   node scripts/status.mjs
 *
 * Responde de un vistazo a: ¿hay eventos activos en cada juego? ¿queda algún
 * duplicado? ¿cuántos tienen descripción? ¿está sembrado el checklist?
 */

import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const H = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
}

const get = async (path) => {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
    headers: H,
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json()
}

/** Misma normalización que usa el scraper, para detectar duplicados reales. */
const key = (t) =>
  t
    .toLowerCase()
    .replace(/\s+\d{4}-\d{2}-\d{2}$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(gifts?|events?)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const days = (iso) => (Date.parse(iso) - Date.now()) / 86_400_000

async function main() {
  const [games, events, checklist] = await Promise.all([
    get('games?select=id,slug,name&order=name'),
    get('events?select=game_id,title,start_date,end_date,description,is_active&limit=1000'),
    get('checklist_items?select=game_id,title&limit=500'),
  ])

  const now = new Date().toISOString()
  console.log(`GachaEvent — estado de datos · ${now.slice(0, 16).replace('T', ' ')} UTC\n`)

  let problems = 0

  for (const game of games) {
    const all = events.filter((e) => e.game_id === game.id)
    const live = all.filter((e) => e.is_active && e.end_date > now)
    const withDesc = live.filter((e) => e.description).length
    const items = checklist.filter((c) => c.game_id === game.id).length

    // Duplicados: dos filas activas que normalizan a la misma clave.
    const seen = new Map()
    const dupes = []
    for (const e of live) {
      const k = key(e.title)
      if (seen.has(k)) dupes.push([seen.get(k), e.title])
      else seen.set(k, e.title)
    }

    const soonest = live
      .map((e) => days(e.end_date))
      .sort((a, b) => a - b)[0]

    console.log(`${game.name}`)
    console.log(
      `   eventos activos ${String(live.length).padStart(3)}` +
        `   con descripción ${String(withDesc).padStart(3)}` +
        `   checklist ${String(items).padStart(3)}` +
        `   filas totales ${String(all.length).padStart(4)}`
    )

    if (live.length === 0) {
      console.log('   ! sin eventos activos — revisa el scraper o la wiki de origen')
      problems++
    } else {
      console.log(`   próximo cierre en ${soonest.toFixed(1)} días`)
    }

    if (items === 0) {
      console.log('   ! checklist vacío — npm run seed:checklist')
      problems++
    }

    const noDesc = live.filter((e) => !e.description)
    for (const e of noDesc) {
      console.log(`   ! sin descripción: "${e.title}"`)
      problems++
    }

    for (const [a, b] of dupes) {
      console.log(`   ! posible duplicado: "${a}"  vs  "${b}"`)
      problems++
    }

    console.log()
  }

  const totalLive = events.filter((e) => e.is_active && e.end_date > now).length
  console.log(
    problems === 0
      ? `Todo en orden: ${totalLive} eventos activos, ${checklist.length} items de checklist.`
      : `${problems} cosa(s) que mirar (arriba, marcadas con !).`
  )
}

main().catch((err) => {
  console.error('No se pudo leer el estado:', err.message)
  process.exit(1)
})
