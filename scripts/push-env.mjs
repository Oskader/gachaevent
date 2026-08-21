/**
 * Sube a Vercel las variables de entorno de producción leyéndolas de
 * `.env.local`, que es la fuente de verdad.
 *
 *   npx vercel login          # una vez, abre el navegador
 *   node scripts/push-env.mjs --dry-run
 *   node scripts/push-env.mjs
 *
 * Sustituye a `upload-env.js`, que llevaba un token de Vercel y los valores
 * en texto plano dentro del propio fichero. Aquí no hay ningún secreto
 * escrito: los valores salen de .env.local y la autenticación es la de tu
 * sesión del CLI.
 *
 * Los valores se pasan por stdin, nunca como argumento, para que no acaben
 * en el historial del shell ni en la lista de procesos.
 */

import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const DRY_RUN = process.argv.includes('--dry-run')

/**
 * GROQ_API_KEY no está: el scraper dejó de usar el LLM, así que ya no la lee
 * nadie. Si la subes, es una credencial viva sin motivo.
 */
const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CRON_SECRET',
]

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const missing = REQUIRED.filter((k) => !env[k])
if (missing.length) {
  console.error(`Faltan en .env.local: ${missing.join(', ')}`)
  process.exit(1)
}

const run = (args, input) =>
  spawnSync('npx', ['vercel', ...args], {
    input,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })

console.log(
  DRY_RUN
    ? 'DRY RUN — no se escribe nada en Vercel\n'
    : 'Subiendo variables a Production\n'
)

let ok = 0
for (const key of REQUIRED) {
  // Solo se enseña la longitud: el valor nunca se imprime.
  console.log(`  ${key}  (${env[key].length} caracteres)`)
  if (DRY_RUN) continue

  // Quitar la anterior si existe; si no existe, el error se ignora.
  run(['env', 'rm', key, 'production', '--yes'], '')

  const res = run(['env', 'add', key, 'production'], env[key])
  if (res.status === 0) {
    ok++
  } else {
    console.error(`     falló: ${(res.stderr || '').trim().split('\n').pop()}`)
  }
}

if (DRY_RUN) {
  console.log('\nQuita --dry-run para aplicarlo.')
} else {
  console.log(`\n${ok}/${REQUIRED.length} subidas.`)
  console.log(
    'Las variables solo se aplican en un build NUEVO: haz push (o redespliega)\n' +
      'después de esto, no antes.'
  )
}
