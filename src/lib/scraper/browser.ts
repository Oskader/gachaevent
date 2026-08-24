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
      'User-Agent': 'GachaEventBot/1.0 (https://gachaevent.vercel.app)',
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

/**
 * Índice de secciones de una página, por nombre visible en minúsculas.
 *
 * Existe para no cablear números de sección. `&section=4` es cómodo hasta que
 * la wiki inserta una sección más arriba: entonces el scraper lee otra cosa
 * **en silencio**, porque la sección equivocada sí devuelve filas y el guard
 * de "0 filas = error" nunca salta.
 */
export async function fetchSectionIndex(
  sourceUrl: string
): Promise<Map<string, string>> {
  const url = `${sourceUrl}&prop=sections`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'GachaEventBot/1.0 (https://gachaevent.vercel.app)',
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`MediaWiki sections fetch failed: ${res.status} ${res.statusText}`)
  }

  const json = await res.json()
  if (json?.error) {
    throw new Error(`MediaWiki API error: ${json.error.code} — ${json.error.info}`)
  }

  const sections: { index?: string; line?: string }[] = json?.parse?.sections ?? []
  return new Map(
    sections
      .filter((s) => s.index && s.line)
      .map((s) => [s.line!.trim().toLowerCase(), s.index!])
  )
}
