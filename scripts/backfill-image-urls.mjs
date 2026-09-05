/**
 * Backfill de image_url en events: reemplaza /scale-to-width-down/480 por /960
 * para las filas activas.
 *
 * Por que existe: THUMB_WIDTH en parsers.ts subio de 480 a 960 en 2026-09-04
 * (commit 7b60717), pero el cambio solo aplica a filas NUEVAS que entren por el
 * scraper. Las filas que ya estaban en BD siguen con la URL vieja a 480, y eso
 * se nota: el servidor de next/image tiene que reescalar 480→384 hacia arriba,
 * con perdida visible en pantallas retina. Reemplazando el ancho en la URL
 * entregamos al servidor next/image un origen mas grande y el reescalado sale
 * con mas calidad.
 *
 *   node scripts/backfill-image-urls.mjs --dry-run   # imprime, no escribe
 *   node scripts/backfill-image-urls.mjs             # aplica (con confirmacion)
 *
 * El modo real lista las filas a tocar, pide confirmacion interactiva y solo
 * entonces aplica el UPDATE. Es idempotente: una segunda corrida no encuentra
 * filas con /480 (porque ya las cambio a /960) y sale en silencio.
 *
 * Servicio: SUPABASE_SERVICE_ROLE_KEY (admin, bypassa RLS).
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const dryRun = process.argv.includes('--dry-run')

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

// Solo filas activas y con imagen. Traemos game_id para imprimir a que juego
// pertenece cada cambio (util cuando hay que revertir).
const { data: rows, error } = await supabase
  .from('events')
  .select('id, title, image_url, game_id, games:game_id(slug)')
  .eq('is_active', true)
  .not('image_url', 'is', null)

if (error) {
  console.error('Error leyendo events:', error.message)
  process.exit(1)
}

const OLD = '/scale-to-width-down/480'
const NEW = '/scale-to-width-down/960'

const toUpdate = rows.filter((r) => r.image_url?.includes(OLD))
const skipped = rows.length - toUpdate.length

console.log(`Total filas activas con image_url: ${rows.length}`)
console.log(`Filas con /480 (a tocar): ${toUpdate.length}`)
console.log(`Filas ya en /960 o sin /480 (sin cambios): ${skipped}`)
console.log('')

if (toUpdate.length === 0) {
  console.log('Nada que hacer. El backfill es idempotente.')
  process.exit(0)
}

// Imprimir preview: juego, id, antes/despues.
for (const r of toUpdate) {
  const slug = r.games?.slug ?? '?'
  const before = r.image_url
  const after = before.replace(OLD, NEW)
  console.log(`[${slug}] ${r.title}`)
  console.log(`  ${before}`)
  console.log(`  -> ${after}`)
}

if (dryRun) {
  console.log('')
  console.log('Modo seco: no se ha escrito nada. Quita --dry-run para aplicar.')
  process.exit(0)
}

// Confirmacion interactiva (skip si stdin no es TTY, para no romper cron/CI).
const isTTY = process.stdin.isTTY
if (isTTY) {
  const reply = (await new Promise((resolve) => {
    process.stdout.write('\nAplicar? [s/N] ')
    process.stdin.once('data', (d) => resolve(d.toString().trim().toLowerCase()))
  }))
  if (reply !== 's' && reply !== 'si' && reply !== 'y' && reply !== 'yes') {
    console.log('Cancelado.')
    process.exit(0)
  }
}

let ok = 0
let fail = 0
for (const r of toUpdate) {
  const after = r.image_url.replace(OLD, NEW)
  const { error: updErr } = await supabase
    .from('events')
    .update({ image_url: after })
    .eq('id', r.id)
  if (updErr) {
    console.error(`FAIL ${r.id} (${r.title}):`, updErr.message)
    fail++
  } else {
    ok++
  }
}

console.log('')
console.log(`Hecho: ${ok} actualizadas, ${fail} fallidas.`)