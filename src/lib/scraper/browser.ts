export interface FetchedPage {
  /** HTML renderizado de la página, con su estructura intacta. */
  html: string
  sourceUrl: string
}

/**
 * Descarga una página vía la API `action=parse` de MediaWiki (Fandom, wiki.gg).
 *
 * Este endpoint existe para consumo programático: no aplica el bloqueo por bot
 * que devuelve 403 en las páginas web normales y en hoyoverse.com, y entrega
 * el HTML ya renderizado.
 *
 * Devuelve HTML, no texto. Aplastarlo a texto plano —como hacía la versión
 * anterior— destruye las tablas que son justamente el dato que se quiere.
 */
export async function fetchMediaWiki(url: string): Promise<FetchedPage> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'GachaDashBot/1.0 (https://gachadash.vercel.app)',
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`MediaWiki fetch failed: ${res.status} ${res.statusText}`)
  }

  const json = await res.json()

  // La API responde 200 con el error dentro del cuerpo.
  if (json?.error) {
    throw new Error(`MediaWiki API error: ${json.error.code} — ${json.error.info}`)
  }

  const html: string = json?.parse?.text?.['*'] ?? ''

  // `action=parse` NO sigue redirecciones: devuelve el stub de redirección con
  // HTTP 200. Sin este guard, apuntar a un nombre de página equivocado parece
  // "no hay eventos" en vez de un error.
  if (/class="redirectText"/i.test(html)) {
    throw new Error(
      `MediaWiki page "${json?.parse?.title}" is a redirect; apunta el scraper a la página real`
    )
  }

  if (!html) {
    throw new Error(`MediaWiki returned empty content for ${url}`)
  }

  return { html, sourceUrl: url }
}
