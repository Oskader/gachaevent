import Groq from 'groq-sdk'

/**
 * Traducción EN→ES de las descripciones de evento.
 *
 * El pipeline dejó de usar un LLM a propósito para EXTRAER: pedirle que
 * reconstruyera la lista de eventos a partir de prosa destruía la estructura
 * que la fuente ya traía hecha, y devolvía duplicados y fechas inventadas.
 *
 * Traducir es otro trabajo. La frase entra ya extraída, limpia y verificada, y
 * lo único que se le pide al modelo es cambiarla de idioma. La entrada y la
 * salida son comparables, que es justo lo que no pasaba antes.
 *
 * Nunca lanza: un fallo deja ese evento sin traducir y la interfaz cae al
 * inglés, igual que un evento sin descripción cae a no enseñar ninguna.
 */

/**
 * Groq retira modelos sin avisar: `llama-3.3-70b-versatile`, que es el que
 * documentaba el proyecto desde la época del LLM, devuelve hoy un 404
 * `model_not_found`. Por eso el modelo es configurable — para poder cambiarlo
 * sin desplegar — con un valor por defecto que sí existe.
 *
 * Si vuelve a fallar, `GET https://api.groq.com/openai/v1/models` con la misma
 * clave dice cuáles hay disponibles.
 */
const MODEL = process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b'

/**
 * Bajo a propósito, y no por cortesía: el nivel gratuito de Groq limita a
 * **8000 tokens por minuto**. Con 5 en paralelo, las cuatro rutas de cron
 * seguidas devolvían 429 y la mitad de los eventos se quedaba sin traducir.
 */
const CONCURRENCY = 2

/**
 * Generoso porque el SDK reintenta por dentro respetando el `retry-after` del
 * 429, y este timeout abarca TODOS los reintentos. Con 15 s abortaba la
 * operación entera antes de que el primer reintento llegara a completarse.
 */
const TIMEOUT_MS = 45_000

const MAX_RETRIES = 4

/**
 * Tope de traducciones por pasada.
 *
 * Las rutas de cron tienen `maxDuration = 60`, y con el límite de 8000 TPM no
 * caben 38 traducciones en ese presupuesto. En vez de reventar el timeout, se
 * traduce un puñado por pasada y **el resto entra en las siguientes**: como el
 * cron corre a diario y lo ya traducido no se vuelve a mandar, la cola se
 * vacía sola en un par de días. Para llenarla hoy, basta con lanzar
 * `npm run scrape` un par de veces.
 */
const MAX_PER_RUN = 8

/**
 * La regla de los nombres propios es la que sostiene todo esto. Sin ella el
 * modelo traduce "Fate Gift" como "Regalo del Destino", y un jugador no
 * reconoce el evento que tiene abierto en el juego.
 */
const SYSTEM = [
  'Traduces descripciones de eventos de videojuegos gacha del inglés al español neutro.',
  '',
  'REGLAS ESTRICTAS:',
  '1. NO traduzcas nombres propios. Los nombres de eventos, personajes, objetos,',
  '   monedas del juego, modos de juego y títulos de juegos se quedan EN INGLÉS,',
  '   tal cual aparecen. Ejemplos de lo que NO se traduce: Fate Gift, Light Cone,',
  '   Warps, Planar Ornament, Simulated Universe, Shiyu Defense, Combat Bangboo,',
  '   Arknights: Endfield.',
  '2. NO traduzcas nada que vaya entre comillas.',
  '3. Español neutro: sin "vosotros" y sin voseo.',
  '4. Mantén el mismo registro y una longitud parecida a la original.',
  '5. Devuelve SOLO la traducción. Sin preámbulo, sin comillas alrededor, sin notas.',
].join('\n')

export interface TranslationTarget {
  /** Clave con la que se devolverá el resultado (el título del evento). */
  key: string
  textEn: string
}

function getClient(): Groq | null {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    console.warn('[translate] falta GROQ_API_KEY; se deja todo sin traducir')
    return null
  }
  // El SDK reintenta solo y respeta el `retry-after` que trae el 429, que es
  // justo lo que hace falta contra el limite de tokens por minuto.
  return new Groq({ apiKey, maxRetries: MAX_RETRIES })
}

async function translateOne(client: Groq, textEn: string): Promise<string | null> {
  try {
    const res = await client.chat.completions.create(
      {
        model: MODEL,
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: textEn },
        ],
      },
      { signal: AbortSignal.timeout(TIMEOUT_MS) }
    )

    const out = res.choices[0]?.message?.content?.trim()
    if (!out) return null

    // Una respuesta mucho más larga que la entrada casi siempre significa que
    // el modelo se ha puesto a explicar o ha añadido notas. Mejor nada que
    // meter basura en la tarjeta.
    if (out.length > textEn.length * 2.5) {
      console.warn('[translate] respuesta desproporcionada, se descarta')
      return null
    }

    // A veces envuelve la traducción en comillas pese a pedirle que no.
    // `[\s\S]` en vez del flag `s`, que exige target es2018 y este tsconfig
    // apunta más abajo.
    const unwrapped = out.match(/^"([\s\S]+)"$/)
    return (unwrapped ? unwrapped[1] : out).trim() || null
  } catch (err) {
    console.warn(`[translate] fallo traduciendo: ${err}`)
    return null
  }
}

/**
 * Traduce en lotes. La clave del mapa devuelto es la `key` de cada objetivo;
 * los que fallen simplemente no aparecen, y quien llame decide qué hacer.
 */
export async function translateToSpanish(
  items: TranslationTarget[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (items.length === 0) return out

  const client = getClient()
  if (!client) return out

  const batchable = items.slice(0, MAX_PER_RUN)
  if (items.length > batchable.length) {
    console.log(
      `[translate] ${items.length} pendientes, se traducen ${batchable.length} ` +
        `en esta pasada; el resto entra en la siguiente`
    )
  }

  for (let i = 0; i < batchable.length; i += CONCURRENCY) {
    const batch = batchable.slice(i, i + CONCURRENCY)
    await Promise.all(
      batch.map(async (item) => {
        const es = await translateOne(client, item.textEn)
        if (es) out.set(item.key, es)
      })
    )
  }

  return out
}
