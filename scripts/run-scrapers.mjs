/**
 * Dispara los cuatro scrapers a mano, sin esperar al cron de las 6:00 UTC.
 *
 *   npm run dev                      # en otra terminal
 *   node scripts/run-scrapers.mjs
 *
 *   node scripts/run-scrapers.mjs --prod    # contra el despliegue de Vercel
 *   node scripts/run-scrapers.mjs honkai    # solo un juego
 *
 * Lee CRON_SECRET de .env.local, que es lo que las rutas exigen en la
 * cabecera Authorization.
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

const args = process.argv.slice(2)
const useProd = args.includes('--prod')
const base = useProd ? 'https://gachaevent.vercel.app' : 'http://localhost:3000'

const ALL = ['honkai', 'zenless', 'wuthering', 'arknights']
const picked = args.filter((a) => ALL.includes(a))
const games = picked.length ? picked : ALL

if (!env.CRON_SECRET) {
  console.error('Falta CRON_SECRET en .env.local')
  process.exit(1)
}

console.log(`Disparando ${games.length} scraper(s) contra ${base}\n`)

let failed = 0

for (const game of games) {
  const started = Date.now()
  try {
    const res = await fetch(`${base}/api/cron/scrape-${game}`, {
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    })
    const body = await res.json().catch(() => ({}))
    const secs = ((Date.now() - started) / 1000).toFixed(1)

    if (res.ok && body.success) {
      console.log(
        `  OK   ${game.padEnd(10)} ${String(body.eventsUpserted).padStart(3)} eventos` +
          `  (${body.duplicatesCollapsed ?? 0} duplicados fusionados,` +
          ` ${body.eventsEnriched ?? 0} con descripción,` +
          ` ${body.eventsDeactivated ?? 0} retirados)  ${secs}s`
      )
    } else {
      failed++
      console.log(`  FALLO ${game.padEnd(10)} HTTP ${res.status} — ${body.error ?? 'sin detalle'}`)
    }
  } catch (err) {
    failed++
    console.log(`  FALLO ${game.padEnd(10)} ${err.message}`)
    if (!useProd) {
      console.log('         ¿está corriendo `npm run dev`?')
    }
  }
}

console.log(
  failed === 0
    ? '\nTodos correctos. Comprueba el resultado con: node scripts/status.mjs'
    : `\n${failed} scraper(s) fallaron.`
)
process.exit(failed === 0 ? 0 : 1)
