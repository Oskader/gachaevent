# Diseño: la app en español, con selector ES/EN

Fecha: 2026-08-24 · Estado: aprobado, pendiente de plan de implementación

## Objetivo

Hoy la app está a medias: la copia de la interfaz está en español, las descripciones de
los eventos llegan en inglés de las wikis, y el checklist está en español. El resultado
es una mezcla. El objetivo es que **todo lo traducible esté en el idioma elegido** y que
haya un **selector ES/EN** real, no un placeholder.

Los nombres propios no se traducen: un evento de la colaboración con Fate se sigue
llamando "Fate Gift", no "Regalo del Destino".

## Punto de partida (verificado en vivo el 2026-08-24)

Las fuentes **no** pueden dar el español por sí solas:

| Fuente | Cobertura en español |
|---|---|
| Tablón HoYoverse `lang=es` | Nativo del estudio, pero solo Zenless: 8 de 16. Honkai no publica eventos |
| Wikis en español | Existen las tres, mucho menos mantenidas. La de HSR lista 2 eventos donde la inglesa lista 10, y con otra estructura de tabla |
| Enlaces interlingüísticos (`prop=langlinks`) | 2 de 6 en la muestra. Solo cubren recurrentes veteranos |

Sin traducción propia, la cobertura caería de 38/38 a unos 10/38.

## Decisiones tomadas

1. **Se traduce al scrapear con LLM**, prefiriendo el español oficial donde exista.
2. **Alcance completo**: i18n de la interfaz, no solo de los datos.
3. **Cookie, sin tocar las URLs.** Nada de segmento `[locale]`: el `CLAUDE.md` avisa de
   que `/hoy`, `/juegos` y `/cuenta` deben seguir ganando al dinámico `/[game]`, y meter
   un segmento en la raíz es justo lo que pone eso en riesgo.
4. **El checklist se traduce a mano** al sembrar. Son 38 filas estáticas con nombres
   oficiales de modos de juego ("Caverna de Corrosión" es "Cavern of Corrosion"): es
   donde un modelo se inventa cosas y donde sí existe una respuesta correcta.
5. **Groq**, reutilizando `groq-sdk` y la `GROQ_API_KEY` que ya están puestas en
   `.env.local` y en Vercel.

## 1. Modelo de datos

Columnas nuevas, **sin renombrar nada**, para que no haya ventana en la que el código
desplegado lea una columna que ya no existe:

```sql
ALTER TABLE events
  ADD COLUMN description_en TEXT,
  ADD COLUMN description_es TEXT;
UPDATE events SET description_en = description;

ALTER TABLE checklist_items
  ADD COLUMN title_es TEXT,
  ADD COLUMN title_en TEXT;
UPDATE checklist_items SET title_es = title;
```

`events.description` y `checklist_items.title` quedan muertas. **No se borran en esta
entrega**: se limpian aparte, una vez confirmado que nada las lee. Las políticas RLS no
cambian, porque son por fila y no por columna.

`checklist_items.description` **no se toca**: está vacía en las 38 filas y nada la
renderiza. Si algún día se usa, se le dará el mismo tratamiento que a `title`.

Se aplica por el dashboard o el MCP de Supabase, **no** con otro script suelto en
`scripts/`: el `CLAUDE.md` dice que esos son históricos y que lo nuevo va por ahí.
Después, regenerar `src/lib/supabase/types.ts`.

## 2. El español de las descripciones, en tres capas

Mismo patrón que ya usa `descriptions.ts`, por orden de preferencia:

1. **Tablón oficial en español.** Se pide el mismo endpoint con `lang=es` y se cruza con
   el inglés **por `ann_id`** (verificado: casa 15 de 15). Esto es lo que evita el
   problema de fondo: el tablón español también traduce los *nombres* («Las vacaciones de
   una peligrosa fugitiva»), así que cruzar por nombre daría cero. Cruzando por `ann_id`
   seguimos emparejando contra el título inglés de la wiki, que ya funciona, y sacamos el
   español del anuncio hermano.
2. **Traducción con Groq** de la frase inglesa ya extraída.
3. **Nada**: `description_es` queda a `null` y la interfaz cae al inglés.

### `src/lib/scraper/translate.ts`

Módulo nuevo, mismo contrato que `descriptions.ts`: **nunca lanza**, concurrencia 5,
`AbortSignal.timeout` por llamada, y un fallo deja ese evento sin traducir en vez de
tumbar el scraping entero.

```ts
export async function translateDescriptions(
  items: { key: string; textEn: string }[],
): Promise<Map<string, string>>
```

**Solo se traduce lo que cambió.** El runner ya trae las filas guardadas para el merge;
si `previous.description_en` es idéntica a la nueva y ya hay `description_es`, ese evento
no se manda. En régimen normal son 0-3 llamadas al día, no 38. La primera pasada sí paga
las 38: con concurrencia 5 son unas 8 rondas, muy por debajo de los 60 s de la ruta de
cron.

El prompt exige: traducir a **español neutro** (sin voseo ni "vosotros", que es lo que
espera un público gacha hispanohablante mixto), **conservar en inglés los nombres
propios** (eventos, personajes, objetos y modos de juego), no traducir nada entre
comillas, y devolver solo la traducción sin preámbulo.

### Dónde encaja en el pipeline

En `scraper-runner.ts`, después de resolver las descripciones y antes del upsert. Las
filas pasan a llevar `description_en` y `description_es` en vez de `description`.

## 3. i18n de la interfaz

`src/lib/i18n/` con:

- `es.ts` y `en.ts`, diccionarios con la misma forma, tipada desde `es.ts` para que una
  clave que falte sea un error de compilación y no un hueco en pantalla.
- `getLocale()`, que lee la cookie con `cookies()` de `next/headers` — **asíncrono en
  Next 16**. Por defecto `es`.
- `getDictionary(locale)`.

`<html lang={locale}>` en `layout.tsx`, que hoy está fijo a `es`.

**Los componentes de cliente reciben sus textos por props desde el servidor.** Nada de
contexto global: obligaría a marcar como cliente páginas que hoy se renderizan en
servidor, que es justo lo que sostiene el rendimiento de la app. Afecta a
`bottom-nav.tsx`, `auth-form.tsx`, `ChecklistClient.tsx`, `ui/countdown.tsx`,
`ui/OfflineBanner.tsx` y `ui/SignOutButton.tsx`.

**Excepción: `src/app/error.tsx`.** Next lo renderiza con `error` y `reset` y nada más,
así que no puede recibir el diccionario de un padre servidor. Lee la cookie de
`document.cookie` en el cliente y cae a español si no la encuentra.

Las etiquetas de categoría del checklist, que hoy `ChecklistClient` mapea a español a
mano, se mudan al diccionario. El enum de Postgres sigue en inglés y sin migrar.

## 4. Pantalla de ajustes

Ruta nueva **`/ajustes`**. Comprobado que no choca con ningún valor del enum `game_slug`
(`honkai-star-rail`, `wuthering-waves`, `zenless-zone-zero`, `arknights-endfield`).

**Sin guardia en `proxy.ts`**: el idioma tiene que poder cambiarse sin sesión, así que no
puede vivir en `/cuenta`. Se añade una entrada en la navegación.

El selector llama a una Server Action que escribe la cookie `ge_lang` — un año,
`SameSite=Lax`, `httpOnly: false` para que `error.tsx` pueda leerla — y llama a
`revalidatePath('/', 'layout')` para que lo ya renderizado se regenere en el idioma
nuevo.

Guardar la preferencia en `profiles` queda **fuera de esta entrega**.

## 5. Qué no se traduce

Títulos de eventos, `games.name`, y los nombres propios dentro de las descripciones.

## 6. Verificación

No hay test runner y el proyecto dice explícitamente que no lo hay, así que:

- **Modo de prueba en la propia ruta de cron.** `runScraperForGame` acepta
  `{ dryRun: true }`: hace todo el trabajo —descarga, parseo, descripciones,
  traducción— y **devuelve las filas en la respuesta en vez de escribirlas**, saltándose
  también la reconciliación. La ruta lo activa con `?dryRun=1`, que sigue detrás del
  `CRON_SECRET`, y `npm run scrape` lo expone como `--dry-run`. Así se puede revisar la
  traducción tanto en local como contra producción sin tocar la base de datos. Es la red
  que caza el riesgo del punto 7.
- El banco de pruebas del scratchpad, que ejecuta el código real contra las fuentes vivas
  sin tocar la base de datos.
- `npm run build` (que es el typecheck real) y `npm run lint`.
- `npm run status` después de la primera pasada.
- Las pantallas a mano en `npm run dev`, cambiando el idioma en `/ajustes`.

## 7. Riesgos

**Groq y los nombres propios** es el riesgo real: `llama-3.3-70b` puede escribir
"Destino" pese al prompt. Por eso la etapa de traducción vive detrás de una función con
un contrato mínimo — cambiar de proveedor es tocar un fichero — y por eso existe el
`--dry-run`.

**El inglés del checklist es trabajo manual** de 38 filas. Si se hace deprisa, quedará
peor que las descripciones automáticas.

## 8. Fuera de alcance

- Persistir el idioma en `profiles`.
- Borrar las columnas viejas `description` y `title`.
- Más idiomas que ES y EN.
- El filtro de qué eventos de HSR entran, que es una petición aparte.
