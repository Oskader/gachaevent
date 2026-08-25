# Diseño: una imagen representativa por evento, automática

Fecha: 2026-08-25 · Estado: aprobado, pendiente de plan de implementación

## Objetivo

Cada evento debe llegar a la app con una imagen que lo represente, puesta **sin
intervención manual**: la trae el scraper en su pasada diaria, igual que ya trae título,
fechas y descripción. Un evento nuevo aparece con su imagen sin que nadie toque nada.

No es decoración por decoración: en un gacha el jugador reconoce el evento por su banner
antes que por su nombre, sobre todo cuando el nombre es "Threshold Simulation: Myriad
Endgame".

## Punto de partida (verificado en vivo el 2026-08-25)

Ninguna de las cuatro wikis tiene la extensión **PageImages** — la misma historia que con
`TextExtracts` y las descripciones. No hay forma de pedir la imagen por API: hay que
sacarla del HTML.

La buena noticia es que **ya está en el HTML que el parser descarga hoy**:

| Fuente | Dónde está la imagen | Cobertura | Proporción |
|---|---|---|---|
| HSR (Fandom) | En la celda `Event` de la tabla | 12/12 | 250×141 (16:9) |
| ZZZ (Fandom) | En la celda `Event` de la tabla | 16/18 | 250×141 (16:9) |
| WuWa (Fandom) | En la celda `Event` de la tabla | 4/4 | 200×113 (16:9) |
| Endfield (wiki.gg) | En la tarjeta `.mp-event` | 6/6 | 480×87 (**5.5:1**) |

**38 de 40.** Las dos ausencias son de Zenless y no son un fallo de parseo: la wiki emite
`<span class="mw-broken-media">` con enlace rojo a `Special:Upload`, es decir, el banner
**no existe en ninguna parte de la wiki**. `cleanTitle` ya limpia el `File:...png` que
esas filas dejan pegado al título, así que no hay nada roto que arreglar.

Dos comprobaciones más que cierran decisiones:

- **El hotlink funciona en los cuatro hosts**, incluida una petición desnuda de servidor
  sin cabeceras — que es lo que hace el optimizador de `next/image`. Un 403 que aparece al
  probar con `User-Agent: Mozilla/5.0` a secas es el Cloudflare de wiki.gg castigando un
  UA truncado, no protección anti-hotlink. Con UA realista, con el UA del bot o sin
  ninguno: 200.
- **La resolución es reescribible.** Fandom sirve por `scale-to-width-down/<n>`; pedir 480
  en vez de 250 devuelve 200 y ~42 KB.

## Decisiones tomadas

1. **Una sola capa: la imagen que la propia lista ya trae.** Cero peticiones extra, cero
   presupuesto del cron, cero LLM.
2. **Solo se guarda la URL, se enlaza al CDN de la wiki.** Es exactamente la postura que ya
   tiene `games.icon_url`.
3. **Miniatura 16:9 en la fila**, no banner ancho ni fondo atenuado.
4. **El banner oficial de HoYoverse queda aplazado, con el hueco hecho.** Ver §6.

## 1. Modelo de datos

```sql
ALTER TABLE events ADD COLUMN image_url TEXT;
```

Nullable, sin defecto, sin tabla aparte. Las políticas RLS no cambian: son por fila.

La migración va **por el MCP de Supabase**, no por otro script en `scripts/`. El
`CLAUDE.md` es explícito: esos ficheros son one-shots históricos con el project ref
cableado, sirven para leer el esquema, y lo nuevo va por dashboard o MCP.

Después, `src/lib/supabase/types.ts` **regenerado**, nunca editado a mano.

## 2. Extracción, en `parsers.ts`

`ParsedEvent` gana `image_url?: string`.

**Fandom (`parseFandomTables`)** — la imagen se busca **solo dentro de la celda `Event`**,
nunca en la fila entera. Las otras columnas llevan iconos de recompensa y un
`$(row).find('img')` los recogería como si fueran el banner del evento.

**Endfield (`parseEndfieldCards`)** — la imagen cuelga de la tarjeta. La wiki devuelve
**ruta relativa** (`/images/thumb/...`), así que hay que prefijar el host; sin eso la URL
guardada es inservible.

Dos detalles que valen por sí solos:

- **Hay que leer `src` Y `data-src`, en ese orden y con cuidado.** Fandom sirve la tabla
  con carga diferida a partir de la cuarta fila: esas imágenes llevan `class="lazyload"`,
  un `src="data:image/gif;base64,…"` de relleno y la URL real en `data-src`. En la página
  de eventos de HSR son **25 de 28**. Solo las primeras filas llegan con `src` real.

  El matiz que cuesta un bug: `img.attr('src') ?? img.attr('data-src')` **no vale**. `??`
  solo cae al segundo operando con `null`/`undefined`, y el placeholder `data:` es una
  cadena con valor, así que nunca se llega a `data-src` y la fila se pierde entera. Hay
  que preferir el `src` **solo si no es un `data:`**:

  ```ts
  const src = img.attr('src')
  const real = src && !src.startsWith('data:') ? src : img.attr('data-src')
  ```

  Este párrafo estuvo mal escrito hasta el 2026-08-25: afirmaba que `data-src` no aparecía
  nunca. Salía de una sonda que solo miraba las tres primeras imágenes de la página —
  justo las tres únicas que se cargan en caliente. Con la versión ingenua, la cobertura
  caía de 38/40 a 18/40.
- `mw-broken-media` **no emite `<img>`**, así que un banner inexistente cae solo en
  `undefined`. No hace falta filtro para las dos filas de Zenless.

La resolución se normaliza a ancho 480, y esto es **solo para Fandom**: sirve por
`scale-to-width-down/<n>` y WuWa entrega 200, insuficiente para una miniatura en pantalla
de densidad doble. **Endfield no entra en esa reescritura**: su URL es
`/images/thumb/<fichero>/480px-<fichero>`, otro formato distinto, y ya viene a 480.

## 3. Resolución de la imagen final, en `scraper-runner.ts`

La imagen se resuelve con una **cadena de preferencia explícita**, en el mismo sitio donde
ya se resuelven las descripciones:

```ts
const image_url = extra?.banner ?? event.image_url ?? prev?.image_url ?? null
```

Tres eslabones, y los tres importan:

- `extra?.banner` — el banner oficial. **Hoy siempre es `undefined`**, porque
  `fetchHoyoEnrichment` todavía no lo rellena. Está escrito ya a propósito: es el hueco del
  §6, y dejarlo puesto convierte "añadir el banner oficial" en rellenar un campo en vez de
  en tocar la cadena.
- `event.image_url` — lo que trae la wiki. La fuente real de hoy.
- `prev?.image_url` — lo guardado. **Una pasada sin imagen no puede borrar una buena**, por
  el mismo motivo que las descripciones hacen ese merge: la wiki puede romper una imagen un
  día y arreglarla al siguiente.

La reconciliación no cambia: `image_url` viaja dentro de la misma fila del upsert.

## 4. UI

La miniatura es **16:9 con `object-cover`**, no cuadrada. Es la proporción nativa de tres
de las cuatro fuentes; Endfield, que entrega 5.5:1, se recorta por los lados y sigue siendo
legible. Una miniatura cuadrada convertiría el banner de Endfield en una tira
irreconocible.

Tamaño: **96×54 CSS px**, a la izquierda del bloque de texto de la fila. Con densidad
doble son 192 px reales, que es de donde sale el ancho 480 pedido al CDN — hay margen de
sobra sin pedir un original enorme.

- `next/image` con `sizes` y carga diferida.
- **`next.config.ts` no se toca.** `**.nocookie.net` y `**.wiki.gg` ya están en
  `remotePatterns`, puestos en su día para `games.icon_url`.
- `alt=""`. La imagen es decorativa: el título va justo al lado y repetirlo solo ensucia el
  lector de pantalla.
- Radio 2px, sin blur, sin sombra. **La miniatura no lleva color propio**: la franja de
  identidad del juego y la mecha de urgencia siguen siendo lo único con color en la fila.
  El sistema dice que el color saturado solo significa urgencia, y una imagen no es una
  excepción a eso: es contenido, no señal.
- **Un evento sin imagen no lleva caja gris vacía**: el texto ocupa el ancho completo, como
  hoy. Son 2 de 40 y una fila irregular es mejor que un hueco muerto.

Toca `src/components/event-row.tsx`, que es el componente compartido por `/hoy` y
`/[game]`. No hay que duplicar nada.

## 5. Visibilidad

- `ScrapeResult` gana `eventsWithoutImage`, en paralelo a `eventsWithoutDescription`.
- `scripts/status.mjs` gana una línea de cobertura de imagen. Sigue siendo solo lectura.
- `npm run scrape -- --dry-run` ya imprime `rows`, así que la URL se revisa antes de que
  llegue a la base de datos sin añadir nada.

## 6. Pendiente: el banner oficial de HoYoverse

Aplazado a propósito, **no descartado**. Es la mejor imagen que existe —la publica el
estudio— y el hueco queda hecho en la cadena del §3.

Lo que se sabe hoy, para que "luego" no haya que volver a investigarlo:

- **El banner ya viaja en el endpoint que el scraper llama.** `getAnnContent` —el mismo del
  que salen las descripciones— devuelve `banner` en **cada** item, junto a `ann_id`,
  `title`, `subtitle`, `content`. Activarlo **no cuesta ninguna petición nueva**: es leer
  `item.banner` dentro del bucle que `fetchHoyoEnrichment` ya recorre.
- El cruce contra los títulos de la wiki **ya está resuelto**: el índice por `dedupKey` es el
  mismo que empareja las descripciones. El banner hereda ese emparejamiento gratis.
- Las URLs están en `sdk.hoyoverse.com`. **Eso sí exige tocar `next.config.ts`**: ese host no
  está en `remotePatterns` y sin él `next/image` lanza "Invalid src prop".

Con lo cual el cambio futuro son tres cosas: `banner?: string | null` en `Enrichment`,
leerlo en `fetchHoyoEnrichment`, y el `remotePattern`. La cadena del §3 ya lo prefiere.

Dos avisos para cuando se haga, que son la razón de no hacerlo ahora:

- **Solo rinde en Zenless.** Comprobado el 2026-08-25, igual que con las descripciones:
  `getAnnContent` devuelve para Honkai un grupo de notas de parche y mantenimientos, no
  eventos. La cobertura real serían ~8 filas de 40.
- **Hay que verificar la proporción antes de activarlo.** El banner del tablón es arte
  promocional ancho, no un icono de evento; con `object-cover` en una caja 16:9 debería
  recortar bien, pero eso hay que mirarlo en pantalla, no suponerlo. Si desentona, la salida
  limpia es usarlo solo donde la fila lo muestre en grande, no en la miniatura.

## 7. Fuera de alcance, y por qué

**Segunda capa desde la página propia del evento.** Sería lo simétrico a las descripciones,
que sí tienen dos capas. Se probó y **no funciona**: en la página del evento, el primer
candidato de infobox es un icono de personaje ("The Final Callback"), un permiso de 55px
(Endfield) o directamente nada ("Ding-Dong! Delivery Training in Progress"). Daría imágenes
equivocadas más veces que acertadas, y exigiría la misma cadena de heurísticas de tres
pasadas que costó `descriptions.ts`. Además no rescataría las dos filas que faltan: su
banner no existe.

**Copia en Supabase Storage.** El hotlink funciona en los cuatro hosts, incluida la petición
desnuda del optimizador. Un bucket añadiría políticas, limpieza de huérfanas y presupuesto
del cron a cambio de un riesgo que hoy no se materializa. El esquema guarda una URL y le da
igual de quién sea, así que migrar más tarde no tocaría la UI.

## 8. Verificación

No hay test runner: `scratch-*.mjs` son sondas manuales, no una suite.

1. `npm run scrape -- --dry-run` — la pasada entera sin escribir. Se revisa que las URLs
   sean absolutas (sobre todo las de Endfield) y que salgan 38 de 40.
2. `npm run dev` — `/hoy` y `/[game]`, mirando las dos formas: fila con imagen y las dos
   filas sin ella.
3. `npm run build` — es el typecheck real, `tsc` no está cableado a ningún script. Recuerda:
   `--webpack` es obligatorio y no es decoración.
4. `npm run lint` — está limpio y tiene que seguir estándolo.
5. `npm run status` — cobertura de imagen final.
