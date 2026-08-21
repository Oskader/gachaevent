/**
 * Siembra `checklist_items` con la rutina de endgame de cada juego.
 *
 * A diferencia del resto de scripts de esta carpeta, esto NO es una migración
 * de un solo uso: es contenido, es idempotente y se puede volver a ejecutar.
 * La clave natural es (game_id, title); reejecutarlo actualiza categoría y
 * orden sin duplicar filas ni tocar el progreso de nadie, porque
 * `user_checklist_progress` apunta al id del item, que no cambia.
 *
 *   node scripts/seed-checklist.mjs           # aplica
 *   node scripts/seed-checklist.mjs --dry-run # solo enseña lo que haría
 *
 * Los nombres de los modos están verificados contra las wikis de cada juego
 * (2026-08-21). El texto es el de la rutina, no el del modo: lo que importa
 * es qué tienes que acordarte de hacer antes del reset.
 */

import { readFileSync } from 'node:fs'

const DRY_RUN = process.argv.includes('--dry-run')

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

/**
 * category usa el enum de Postgres: qué estás farmeando, no cada cuánto.
 *   other       rutina diaria/semanal
 *   artifact    reliquias / ecos / discos
 *   weapon      armas, conos de luz, motores W
 *   character   subir al personaje en curso
 *   achievement retos de endgame puntuables
 *   story       historia
 * is_permanent: true = parte fija del juego; false = depende de la versión.
 */
const CHECKLISTS = {
  'honkai-star-rail': [
    ['Gastar el Poder de Travesía antes de que rebose', 'other'],
    ['Completar el Entrenamiento Diario', 'other'],
    ['Recoger y relanzar las Asignaciones', 'other'],
    ['Eco de Guerra: 3 intentos de la semana', 'other'],
    ['Universo Simulado de la semana', 'other'],
    ['Farmear reliquias en la Caverna de Corrosión', 'artifact'],
    ['Farmear material de Conos de Luz', 'weapon'],
    ['Subir al personaje que estés trabajando', 'character'],
    ['Memoria del Caos: cerrar las 12 plantas', 'achievement'],
    ['Ficción Pura y Sombra Apocalíptica del ciclo', 'achievement'],
  ],

  'zenless-zone-zero': [
    ['Gastar la Batería antes de que llegue al tope', 'other'],
    ['Completar las comisiones diarias de Inter-Knot', 'other'],
    ['Recoger los ingresos del videoclub', 'other'],
    ['Ridu Weekly: tareas de la semana', 'other'],
    ['Zona Hueca (Hollow Zero) de la semana', 'other'],
    ['Farmear discos de impulso', 'artifact'],
    ['Farmear material de motores W', 'weapon'],
    ['Ascender al Agente en curso', 'character'],
    ['Defensa de Shiyu: cerrar el piso crítico', 'achievement'],
    ['Asalto Letal del ciclo', 'achievement'],
  ],

  'wuthering-waves': [
    ['Gastar el Waveplate antes de que se llene', 'other'],
    ['Completar las actividades diarias', 'other'],
    ['Reclamar el Pioneer Podcast', 'other'],
    ['Desafío Semanal: jefes de la semana', 'other'],
    ['Entrenamiento de Simulación de la semana', 'other'],
    ['Farmear Ecos en los Campos Tácitos', 'artifact'],
    ['Forgery Challenge: material de armas', 'weapon'],
    ['Ascender al Resonador en curso', 'character'],
    ['Torre de Adversidad: cerrar los tres sectores', 'achievement'],
    ['Yermos Gimientes del ciclo', 'achievement'],
  ],

  // Endfield es el más reciente de los cuatro y su wiki aún está incompleta.
  // Solo se siembran sistemas verificados como páginas existentes
  // (Sanity, Operational Manual, Regional Development, Acquisition Center,
  // Arsenal Exchange, Protocol Pass, Findings), redactados de forma que
  // siguen siendo ciertos aunque cambien los detalles.
  'arknights-endfield': [
    ['Gastar la Cordura antes de que llegue al tope', 'other'],
    ['Completar el Manual de Operaciones del día', 'other'],
    ['Recoger la producción de la base', 'other'],
    ['Reclamar el Centro de Adquisiciones', 'other'],
    ['Canjear lo pendiente en el Arsenal', 'other'],
    ['Avanzar el Protocol Pass', 'other'],
    ['Subir al operador en el que estés trabajando', 'character'],
    ['Avanzar la historia principal', 'story'],
  ],
}

async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

async function main() {
  const games = await rest('games?select=id,slug,name')
  const bySlug = Object.fromEntries(games.map((g) => [g.slug, g]))

  let inserted = 0
  let updated = 0

  for (const [slug, items] of Object.entries(CHECKLISTS)) {
    const game = bySlug[slug]
    if (!game) {
      console.warn(`  ! ${slug}: no existe en la tabla games, se salta`)
      continue
    }

    const existing = await rest(
      `checklist_items?select=id,title&game_id=eq.${game.id}`
    )
    const byTitle = new Map(existing.map((r) => [r.title, r.id]))

    console.log(`\n${game.name} — ${items.length} items`)

    for (const [index, [title, category]] of items.entries()) {
      const row = {
        game_id: game.id,
        title,
        category,
        sort_order: index,
        is_permanent: true,
        description: null,
      }

      const existingId = byTitle.get(title)
      const verb = existingId ? 'actualiza' : 'inserta '
      console.log(`  ${verb} [${category.padEnd(11)}] ${title}`)

      if (DRY_RUN) continue

      if (existingId) {
        await rest(`checklist_items?id=eq.${existingId}`, {
          method: 'PATCH',
          body: JSON.stringify({ category, sort_order: index }),
        })
        updated++
      } else {
        await rest('checklist_items', {
          method: 'POST',
          body: JSON.stringify(row),
        })
        inserted++
      }
    }
  }

  console.log(
    DRY_RUN
      ? '\n(dry-run: no se ha escrito nada)'
      : `\nHecho: ${inserted} insertados, ${updated} actualizados.`
  )
}

main().catch((err) => {
  console.error('Falló el seed:', err.message)
  process.exit(1)
})
