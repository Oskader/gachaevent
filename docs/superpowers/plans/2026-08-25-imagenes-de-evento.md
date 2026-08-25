# Imágenes automáticas por evento — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada evento llegue a la app con una imagen representativa puesta por el scraper, sin intervención manual.

**Architecture:** La imagen sale del **mismo HTML que el parser ya descarga** para leer título y fechas — cero peticiones extra, cero LLM. Se guarda solo la URL (`events.image_url`) y se enlaza al CDN de la wiki. En la fila se dibuja como miniatura 16:9 de 96×54. La cadena de preferencia deja el primer eslabón reservado al banner oficial de HoYoverse, que **no se implementa en este plan**.

**Tech Stack:** Next.js 16 · React 19 · TypeScript · Cheerio · Supabase (PostgREST + MCP) · Tailwind v4

**Spec:** `docs/superpowers/specs/2026-08-25-imagenes-de-evento-design.md`

## Global Constraints

Se aplican a **todas** las tareas:

- **`--webpack` es obligatorio en `dev` y en `build`.** `npm run dev` = `next dev --webpack`, `npm run build` = `next build --webpack`. Sin el flag, `@serwist/next` inyecta config de webpack, Next 16 usa Turbopack por defecto y aborta con "webpack config and no turbopack config". No "limpiar" esos scripts.
- **Esto es Next.js 16 + React 19.** Antes de escribir código de routing/caching/params/imagen, leer `node_modules/next/dist/docs/`. En concreto: **`priority` está deprecado en v16** (se sustituye por `preload`); `width`/`height` son obligatorios salvo con `fill` o import estático.
- **`src/lib/supabase/types.ts` se regenera, nunca se edita a mano.**
- **Nunca filtrar por título en PostgREST.** Hay eventos con comillas dobles en el nombre; `in`/`not.in` construyen la lista como cadena y esas filas no casan.
- **La copia de interfaz es en español.** Identificadores y comentarios, mezcla ES/EN, como el resto del repo.
- **Color saturado = solo urgencia.** El color del juego es identidad (franja de 3px). Radio 2px (`rounded-sm`), sin blur, sin sombra, sin glassmorphism.
- **No hay test runner ni ficheros de test.** `scratch-*.mjs` son sondas manuales de un solo uso y están en `.gitignore` y `.vercelignore`. La verificación real de este repo es: `npm run scrape -- --dry-run`, `npm run dev`, `npm run build` (que **es** el typecheck: `tsc` no está cableado a ningún script) y `npm run lint` (está limpio, tiene que seguirlo).
- Todos los comandos se ejecutan desde `gachadash/`.
- Rama de trabajo: `feat/imagenes-de-evento`.

---

### Task 1: Columna `image_url` y tipos regenerados

**Files:**
- Modify (por MCP de Supabase, no por fichero): tabla `events`
- Modify: `src/lib/supabase/types.ts` (regenerado, no editado)

**Interfaces:**
- Consumes: nada.
- Produces: `Database['public']['Tables']['events']['Row'].image_url: string | null`, y las variantes `Insert`/`Update` con `image_url?: string | null`. Las tareas 2, 3 y 4 dependen de que este tipo exista.

**Por qué por MCP y no por script:** `CLAUDE.md` es explícito — los `scripts/*.mjs` de migración son one-shots históricos con el project ref cableado, sirven para *leer* el esquema, y lo nuevo va por dashboard o MCP. No añadir otro script.

- [ ] **Step 1: Aplicar la migración**

Con la herramienta `apply_migration` del MCP de Supabase, nombre `add_events_image_url`:

```sql
ALTER TABLE events ADD COLUMN image_url TEXT;
```

Nullable, sin defecto. **Las políticas RLS no se tocan**: son por fila, no por columna, así que `image_url` hereda la de `events` (lectura pública solo donde `is_active = TRUE`).

- [ ] **Step 2: Comprobar que la columna existe**

Con `execute_sql` del MCP:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'events' AND column_name = 'image_url';
```

Esperado: una fila, `image_url | text | YES`.

- [ ] **Step 3: Regenerar los tipos**

Con `generate_typescript_types` del MCP, y volcar el resultado a `src/lib/supabase/types.ts`.

**Ojo:** el fichero actual empieza con un BOM (`﻿`) antes de `export type Json`. Conservarlo o no da igual funcionalmente, pero no introducir otros cambios: el diff debe ser únicamente las tres apariciones de `image_url` en `Row`, `Insert` y `Update` de `events`.

- [ ] **Step 4: Verificar que el tipo llegó**

Run: `grep -n "image_url" src/lib/supabase/types.ts`
Expected: 3 líneas, dentro del bloque `events` (`image_url: string | null`, `image_url?: string | null`, `image_url?: string | null`).

- [ ] **Step 5: Verificar que compila**

Run: `npm run build`
Expected: build correcto. Es el typecheck real del repo.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/types.ts
git commit -m "feat(db): columna image_url en events"
```

---

### Task 2: El scraper extrae la imagen y la guarda

Esta tarea junta el parseo y la resolución **a propósito**: un cambio en el parser sin salida observable no es revisable por sí solo. El entregable es que `npm run scrape -- --dry-run` imprima una URL absoluta por evento.

**Files:**
- Modify: `src/lib/scraper/parsers.ts` (interfaz `ParsedEvent` en :20-35, `parseFandomTables` en :98-146, `parseEndfieldCards` en :148-169)
- Modify: `src/lib/scraper/scraper-runner.ts` (`ScrapeResult` en :10-24, `collectEvents` en :35-60, el `select` de `existing` en :129-132, el `map` de `rows` en :175-212, los dos `return` de resultado)
- Modify: `src/lib/scraper/hoyo-announcements.ts` (interfaz `Enrichment` en :39-56)
- Modify: `scripts/run-scrapers.mjs` (bloque de impresión en seco)

**Interfaces:**
- Consumes: `Database['public']['Tables']['events']['Insert'].image_url` (Task 1).
- Produces:
  - `ParsedEvent.image_url?: string` — URL absoluta y a ancho 480 cuando la fuente lo permite.
  - `parseEndfieldCards(html: string, section: string, host: string): ParsedEvent[]` — **gana un tercer parámetro**; el único sitio que la llama es `collectEvents`.
  - `Enrichment.banner?: string | null` — declarado y **nunca rellenado** en este plan.
  - `ScrapeResult.eventsWithoutImage?: number`.
  - Cada fila del upsert lleva `image_url: string | null`.

- [ ] **Step 1: Añadir el campo a `ParsedEvent`**

En `src/lib/scraper/parsers.ts`, dentro de la interfaz `ParsedEvent`, después de `pageTitle`:

```ts
  /**
   * Banner del evento, tal cual lo trae la propia lista.
   *
   * Sale del mismo HTML que el título y las fechas: no cuesta ninguna
   * petición. `undefined` cuando la wiki no tiene la imagen subida — pasa de
   * verdad, y `mw-broken-media` no emite `<img>`, así que cae solo.
   */
  image_url?: string
```

- [ ] **Step 2: Añadir los dos helpers de imagen**

En `src/lib/scraper/parsers.ts`, justo debajo de `pageTitleFromCell` (que acaba en :49):

```ts
/**
 * Ancho al que se piden las miniaturas.
 *
 * La fila las dibuja a 96 CSS px, que en pantalla de densidad doble son 192
 * reales. 480 deja margen sin pedir el original entero.
 */
const THUMB_WIDTH = 480

/**
 * URL absoluta y a resolución utilizable.
 *
 * Fandom sirve por `scale-to-width-down/<n>` y Wuthering entrega 200 px, que
 * se ve blando al doble de densidad; por eso se reescribe el ancho.
 *
 * Endfield NO usa ese formato —su ruta es `/images/thumb/<f>/480px-<f>`, ya a
 * 480— pero SÍ la devuelve relativa, así que lo único que necesita es el host
 * delante. Sin eso la URL guardada es inservible.
 */
function absoluteImageUrl(src: string, host?: string): string | undefined {
  if (src.startsWith('//')) return `https:${src}`
  if (src.startsWith('/')) return host ? `https://${host}${src}` : undefined
  return src.replace(/\/scale-to-width-down\/\d+/, `/scale-to-width-down/${THUMB_WIDTH}`)
}

/**
 * Primera imagen real de un contenedor.
 *
 * Comprobado el 2026-08-25 contra las cuatro wikis: `action=parse` devuelve el
 * `src` definitivo y `data-src` no aparece en ninguna imagen — el placeholder
 * de carga diferida de Fandom es cosa de la página web renderizada, no de la
 * API. Se mira `data-src` de todas formas porque cuesta una línea, y se
 * descartan los `data:` por si alguna vez sí llega un placeholder.
 */
function imageFrom(
  $: cheerio.CheerioAPI,
  scope: unknown,
  host?: string
): string | undefined {
  const img = $(scope as never).find('img').first()
  const src = img.attr('src') ?? img.attr('data-src')
  if (!src || src.startsWith('data:')) return undefined
  return absoluteImageUrl(src, host)
}
```

- [ ] **Step 3: Leer la imagen en las tablas de Fandom**

En `parseFandomTables`, en el `out.push` (:139-144), añadir la última propiedad:

```ts
      out.push({
        title,
        ...dates,
        section,
        pageTitle: pageTitleFromCell($, cells.get(eventCol)),
        image_url: imageFrom($, cells.get(eventCol)),
      })
```

**Se pasa la celda `Event`, no la fila.** Es la diferencia entre el banner y un icono de recompensa: las otras columnas llevan iconos y `$(row).find('img')` cogería el primero que encontrara.

- [ ] **Step 4: Leer la imagen en las tarjetas de Endfield**

En `parseEndfieldCards`, cambiar la firma y el `out.push`:

```ts
export function parseEndfieldCards(
  html: string,
  section: string,
  host: string
): ParsedEvent[] {
```

y al final del `each`, sustituir `out.push({ title, ...dates, section, pageTitle })` por:

```ts
    out.push({
      title,
      ...dates,
      section,
      pageTitle,
      // La wiki devuelve ruta relativa; sin el host la URL no vale para nada.
      image_url: imageFrom($, card, host),
    })
```

- [ ] **Step 5: Pasar el host desde `collectEvents`**

En `src/lib/scraper/scraper-runner.ts`, dentro de la rama `endfield-cards` de `collectEvents` (:56):

```ts
      collected.push(...parseEndfieldCards(html, label, source.wikiHost))
```

`source.wikiHost` ya existe en `GameSource` y vale `endfield.wiki.gg`.

- [ ] **Step 6: Declarar el hueco del banner oficial**

En `src/lib/scraper/hoyo-announcements.ts`, dentro de la interfaz `Enrichment`, después de `description_es`:

```ts
  /**
   * Banner oficial del anuncio. **Hoy nadie lo rellena, a propósito.**
   *
   * `getAnnContent` —el mismo endpoint del que salen estas descripciones— ya
   * devuelve el campo `banner` en cada item, así que activarlo no costará
   * ninguna petición nueva: será leer `item.banner` en el bucle de
   * `fetchHoyoEnrichment`. El cruce por `dedupKey` ya está resuelto y lo
   * hereda gratis.
   *
   * Queda declarado para que la cadena de preferencia de `scraper-runner.ts`
   * esté escrita de una vez y encenderlo sea rellenar un campo, no rehacerla.
   * Lo que sí hará falta: el `remotePattern` de `sdk.hoyoverse.com`.
   * Ver §6 del diseño.
   */
  banner?: string | null
```

- [ ] **Step 7: Traer `image_url` de lo ya guardado**

En `scraper-runner.ts`, en el `select` de `existing` (:130):

```ts
    .select('title, description_en, description_es, rewards, image_url')
```

- [ ] **Step 8: Resolver la imagen y contarla**

En el `map` que construye `rows`, junto a `missingDescription`, añadir el contador. Antes del bucle, junto a `let missingDescription = 0` (:157):

```ts
  let missingImage = 0
```

Y dentro del `map` de `rows`, después del bloque de `description_es` y antes de `const start_date`:

```ts
    // Cadena de preferencia. El primer eslabón es el banner oficial, que hoy
    // vale siempre `undefined` — ver el comentario de `Enrichment.banner`.
    // El último es lo guardado: una pasada sin imagen NO puede borrar una
    // buena, igual que con las descripciones. Una wiki puede romper una
    // imagen un día y arreglarla al siguiente.
    const image_url = extra?.banner ?? event.image_url ?? prev?.image_url ?? null
    if (!image_url) missingImage++
```

Y en el objeto devuelto, junto a `source_url`:

```ts
      image_url,
```

- [ ] **Step 9: Exponer el contador**

En la interfaz `ScrapeResult`, junto a `eventsWithoutDescription`:

```ts
  eventsWithoutImage?: number
```

Y añadir `eventsWithoutImage: missingImage,` a **los dos** `return` de éxito: el de `dryRun` (:196-207) y el final (:290-300). Si se olvida uno, el modo en seco y el real informan distinto.

- [ ] **Step 10: Imprimir la imagen en el modo en seco**

En `scripts/run-scrapers.mjs`, en el bloque `if (res.ok && body.success && dryRun)`, añadir al resumen `${body.eventsWithoutImage ?? 0} sin imagen,` y dentro del bucle de filas, después de la línea `ES:`:

```js
        console.log(`      IMG: ${r.image_url ?? '(ninguna)'}`)
```

- [ ] **Step 11: Verificar que compila y pasa lint**

Run: `npm run build`
Expected: build correcto.

Run: `npm run lint`
Expected: sin errores ni avisos.

- [ ] **Step 12: Verificar contra las wikis de verdad, sin escribir**

En una terminal: `npm run dev`
En otra: `npm run scrape -- --dry-run`

Expected, y hay que mirarlo fila a fila:
- **Toda** URL impresa empieza por `https://`. Ninguna empieza por `/` — eso sería Endfield sin host, el fallo más probable de esta tarea.
- Las de Fandom llevan `/scale-to-width-down/480`.
- Las de Endfield llevan `endfield.wiki.gg/images/thumb/`.
- `sin imagen` sale **0** en Honkai, Wuthering y Endfield, y **hasta 2** en Zenless. Esas dos son enlaces rojos en la wiki (`mw-broken-media`): el banner no existe en ninguna parte, no es un fallo del parser.
- Ninguna URL es un icono de recompensa. Si aparecen varias filas con la misma imagen pequeña, se está leyendo la fila entera en vez de la celda `Event`.

- [ ] **Step 13: Commit**

```bash
git add src/lib/scraper/parsers.ts src/lib/scraper/scraper-runner.ts src/lib/scraper/hoyo-announcements.ts scripts/run-scrapers.mjs
git commit -m "feat(scraper): extrae el banner del evento de la propia lista"
```

---

### Task 3: La miniatura en la fila de evento

**Files:**
- Modify: `src/components/event-row.tsx` (:52-102)

**Interfaces:**
- Consumes: `EventRow.image_url` de la fila (Task 1). El componente ya recibe `event: Database['public']['Tables']['events']['Row']` entero, así que **no hay que tocar ninguna consulta**: `/hoy` y `/[game]` hacen `select('*')` los dos.
- Produces: nada que consuman otras tareas.

**Por qué `fill` y no `width`/`height`:** las proporciones de origen no son homogéneas —Fandom entrega 16:9, Endfield 5.5:1— así que no hay un `width`/`height` intrínseco correcto que pasar. Los docs de Next 16 lo dicen tal cual: "If the height and width are unknown, we recommend using the `fill` property".

**La carga diferida no se escribe: ya es el comportamiento por defecto** de `next/image` cuando no se pide lo contrario. Y lo que se pide en contra **no es `priority`**: en Next 16 ese prop está **deprecado** y lo sustituye `preload`. Aquí no queremos ninguno de los dos — una miniatura de fila no es LCP.

**No tocar `next.config.ts`.** `**.nocookie.net` y `**.wiki.gg` ya están en `remotePatterns`, y `**.example.com` cubre subdominios como `image.example.com` según los docs. Y **no añadir `search: ''`** a esos patrones: al omitir `search` se implica el comodín, que es lo que hace falta — las URLs de Fandom llevan `?cb=...` y las de Endfield `?6149ac`.

- [ ] **Step 1: Importar `next/image`**

En `src/components/event-row.tsx`, arriba del todo:

```tsx
import Image from 'next/image'
```

- [ ] **Step 2: Envolver el bloque de texto y meter la miniatura**

Sustituir todo lo que hay entre el bloque `{gameName && (...)}` y el `<Fuse ... />` por:

```tsx
      <div className="flex gap-3">
        {event.image_url && (
          // 96×54 = 16:9, la proporción nativa de tres de las cuatro fuentes.
          // Endfield entrega 5.5:1 y se recorta por los lados: sigue siendo
          // reconocible, cosa que en una miniatura cuadrada no pasaría.
          <div className="relative h-[54px] w-24 shrink-0 overflow-hidden rounded-sm border border-line">
            <Image
              src={event.image_url}
              // Decorativa: el título va justo al lado y repetirlo solo
              // ensucia el lector de pantalla.
              alt=""
              fill
              sizes="96px"
              className="object-cover"
            />
          </div>
        )}

        {/* min-w-0 para que el line-clamp de la descripción pueda encoger. */}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-start justify-between gap-4">
            <h3 className="flex-1 text-sm font-semibold leading-snug text-foreground">
              {event.title}
            </h3>
            <CountdownLabel
              startDate={upcoming ? event.start_date : undefined}
              endDate={event.end_date}
              className="shrink-0"
              words={words}
            />
          </div>

          {description && (
            <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-dim">
              {description}
            </p>
          )}

          {items.length > 0 && (
            <ul className="mb-3 flex flex-wrap gap-x-3 gap-y-1">
              {items.slice(0, 4).map((reward, i) => (
                <li
                  key={`${reward}-${i}`}
                  className="tabular text-[11px] text-dim before:mr-1.5 before:text-[var(--text-faint)] before:content-['+']"
                >
                  {reward}
                </li>
              ))}
              {items.length > 4 && (
                <li className="tabular text-[11px] text-[var(--text-faint)]">
                  {andMore.replace('{n}', String(items.length - 4))}
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
```

Tres cosas deliberadas:
- **`<Fuse />` se queda fuera del `flex`**, después del cierre, para que la mecha siga cruzando la fila entera. Si entra dentro, se queda encogida bajo el texto y pierde la lectura de un vistazo.
- **Sin imagen no hay caja gris.** El `{event.image_url && ...}` hace que el texto ocupe el ancho completo, exactamente como hoy. Son ~2 filas de 34 y una fila irregular es mejor que un hueco muerto.
- **La miniatura no lleva color propio.** El borde es `border-line`, el radio `rounded-sm` (2px). La franja del juego y la mecha de urgencia siguen siendo lo único con color.

- [ ] **Step 3: Verificar que compila y pasa lint**

Run: `npm run build`
Expected: build correcto. Si sale `Invalid src prop`, es `remotePatterns` — pero no debería, ver la nota de arriba.

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 4: Mirarlo en pantalla, las dos formas**

Run: `npm run dev`, y abrir:
- `http://localhost:3000/hoy`
- `http://localhost:3000/zenless-zone-zero` — es donde están las filas **sin** imagen
- `http://localhost:3000/arknights-endfield` — es donde se ve el recorte del 5.5:1

Expected:
- Miniatura a la izquierda, cuenta atrás alineada arriba a la derecha, mecha cruzando la fila entera.
- Las filas sin imagen no dejan hueco: el texto empieza en el margen.
- El banner de Endfield se recorta por los lados y aún se reconoce.
- Sin salto de maquetación al cargar (eso lo da `fill` sobre la caja de tamaño fijo).
- La consola del navegador, sin errores de `next/image`.

**Nota:** una URL rota en el CDN dejaría una caja con borde vacía. `onError` exigiría convertir `EventRow` en componente de cliente, y eso arrastraría `/hoy` y `/[game]` con él. No se hace: el caso es raro y el coste, desproporcionado.

- [ ] **Step 5: Commit**

```bash
git add src/components/event-row.tsx
git commit -m "feat(ui): miniatura del evento en la fila"
```

---

### Task 4: Cobertura de imagen en `npm run status`

**Files:**
- Modify: `scripts/status.mjs` (el `get` de `events`, el cálculo de `withDesc`, la línea de resumen y el filtro `noDesc`)

**Interfaces:**
- Consumes: la columna `image_url` (Task 1), poblada por Task 2.
- Produces: nada que consuman otras tareas.

**Incluye un arreglo pequeño del fichero que se está tocando.** `status.mjs` mide `description`, que es la columna **muerta**: el `CLAUDE.md` dice que nada la lee y el scraper ya no la escribe (mira las filas del upsert en `scraper-runner.ts` — no está). Hoy informa 34/34 porque las filas antiguas conservan el valor viejo, pero **todo evento nuevo se contaría como "sin descripción"**. Es una línea y estamos editando justo esas líneas.

- [ ] **Step 1: Pedir las columnas correctas**

En `scripts/status.mjs`, en el `Promise.all`, sustituir el `get` de eventos:

```js
    get(
      'events?select=game_id,title,start_date,end_date,description_en,image_url,is_active&limit=1000'
    ),
```

- [ ] **Step 2: Contar descripción e imagen**

Sustituir `const withDesc = live.filter((e) => e.description).length` por:

```js
    // description_en, no description: esa segunda es la columna muerta que
    // el scraper ya no escribe, así que contaba como buenas las filas viejas
    // y como huecos todos los eventos nuevos.
    const withDesc = live.filter((e) => e.description_en).length
    const withImg = live.filter((e) => e.image_url).length
```

- [ ] **Step 3: Enseñarlo en la línea de resumen**

Sustituir el `console.log` del resumen por:

```js
    console.log(
      `   eventos activos ${String(live.length).padStart(3)}` +
        `   con descripción ${String(withDesc).padStart(3)}` +
        `   con imagen ${String(withImg).padStart(3)}` +
        `   checklist ${String(items).padStart(3)}` +
        `   filas totales ${String(all.length).padStart(4)}`
    )
```

- [ ] **Step 4: Arreglar el filtro de las que faltan**

Sustituir `const noDesc = live.filter((e) => !e.description)` por:

```js
    const noDesc = live.filter((e) => !e.description_en)
```

**Y no añadir el equivalente para imagen.** Los eventos sin banner lo están porque la wiki no lo tiene subido: marcarlos con `!` haría que `status` nunca dijera "Todo en orden" y avisara de algo que no se puede arreglar desde aquí. La cobertura se lee en el número de la línea de resumen, que para eso está.

- [ ] **Step 5: Verificar**

Run: `npm run status`
Expected: sale la columna `con imagen`, y `con descripción` sigue dando 5/13/16 en Endfield/Honkai/Zenless (o sea, el cambio a `description_en` no rompió el conteo). Wuthering sigue con 0 activos, que es lo conocido: sus tablas `Current` listan eventos ya terminados.

- [ ] **Step 6: Commit**

```bash
git add scripts/status.mjs
git commit -m "feat(scripts): cobertura de imagen en status, y mide description_en"
```

---

### Task 5: Poblar de verdad y verificar de punta a punta

Hasta aquí todo ha sido en seco. Esta tarea **escribe en la base de datos**.

**Files:** ninguno. Es ejecución y verificación.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: `events.image_url` poblada.

**Aviso:** `npm run scrape` escribe en el Supabase que también sirve producción — no hay base de datos aparte. El riesgo es bajo (es un upsert idempotente, exactamente lo que el cron hace solo cada día a las 6:00 UTC), pero es una escritura real. **Confirmar con la persona usuaria antes de ejecutarlo.**

- [ ] **Step 1: Repasar en seco por última vez**

Run: `npm run scrape -- --dry-run` (con `npm run dev` en otra terminal)
Expected: lo mismo que en la Task 2, Step 12. Si algo no cuadra, parar aquí — todavía no se ha escrito nada.

- [ ] **Step 2: Escribir**

Run: `npm run scrape`
Expected: cuatro líneas `OK`, sin ningún `FALLO`.

- [ ] **Step 3: Comprobar la cobertura**

Run: `npm run status`
Expected: `con imagen` cerca de `eventos activos` en Honkai, Zenless y Endfield. Zenless puede quedarse hasta 2 por debajo, por los enlaces rojos.

- [ ] **Step 4: Comprobarlo en pantalla**

Run: `npm run dev` y recorrer `/hoy` y las cuatro páginas de juego.
Expected: las miniaturas cargan desde el CDN, sin `Invalid src prop` en la consola del servidor ni 403 en la del navegador.

- [ ] **Step 5: Verificar el service worker**

Run: `npm run build` y luego `npm start`
Expected: build correcto y la página sirve. Serwist está desactivado en desarrollo, así que este es el único momento en que se ve el comportamiento real del service worker con imágenes remotas nuevas.

- [ ] **Step 6: Commit del estado final**

No hay cambios de código que commitear en esta tarea. Si los pasos anteriores obligaron a un arreglo, commitearlo con su propio mensaje.

---

## Fuera de este plan

- **El banner oficial de HoYoverse.** Aplazado a petición expresa. El hueco queda hecho: `Enrichment.banner` declarado y el primer eslabón de la cadena escrito. Lo que costará: leer `item.banner` en `fetchHoyoEnrichment`, y añadir `sdk.hoyoverse.com` a `remotePatterns` — sin eso `next/image` lanza `Invalid src prop`. Ver §6 del diseño.
- **Segunda capa desde la página propia del evento.** Probada y descartada: devuelve iconos de personaje y permisos de 55px. Ver §7 del diseño.
- **Copia en Supabase Storage.** El hotlink funciona en los cuatro hosts. Ver §7 del diseño.
- **Limpiar la columna muerta `events.description`.** La Task 4 deja de leerla, con lo que ya no la lee nadie — pero borrarla es una migración aparte, deliberadamente fuera de aquí.
