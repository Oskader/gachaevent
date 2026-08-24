# 🔐 Guía: Configuración de Google OAuth para GachaEvent

Esta guía te llevará paso a paso para habilitar el botón **"Continuar con Google"** en GachaEvent, conectando Google Cloud Console con Supabase Auth.

---

## Requisitos Previos

- Una cuenta de Google (la misma que uses para desarrollo)
- Acceso al [Dashboard de Supabase](https://supabase.com/dashboard) de tu proyecto GachaEvent
- Tu URL de Supabase (la encuentras en **Settings → API** de tu proyecto)

---

## Paso 1: Crear un Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Haz clic en el selector de proyectos (parte superior izquierda) → **"Nuevo Proyecto"**
3. Nombra el proyecto: `GachaEvent` (o el nombre que prefieras)
4. Haz clic en **"Crear"** y espera a que se cree
5. Asegúrate de tener seleccionado el proyecto recién creado

---

## Paso 2: Configurar la Pantalla de Consentimiento OAuth

1. En el menú lateral, navega a **APIs & Services → OAuth consent screen**
2. Selecciona **"External"** como tipo de usuario → **"Create"**
3. Completa los campos obligatorios:

| Campo | Valor |
|-------|-------|
| **App name** | `GachaEvent` |
| **User support email** | Tu email |
| **Developer contact email** | Tu email |

4. Haz clic en **"Save and Continue"**

### Scopes (Permisos)

5. En la pantalla de **Scopes**, haz clic en **"Add or Remove Scopes"**
6. Selecciona los siguientes scopes básicos:
   - `openid`
   - `email`
   - `profile`
7. Haz clic en **"Update"** → **"Save and Continue"**

### Test Users

8. En la sección de **Test Users**, agrega tu email de Google
9. Haz clic en **"Save and Continue"** → **"Back to Dashboard"**

> **Nota:** Mientras la app esté en modo **"Testing"**, solo los emails que agregues como Test Users podrán autenticarse. Para permitir cualquier email, deberás publicar la app (ver Paso 6).

---

## Paso 3: Crear las Credenciales OAuth 2.0

1. Ve a **APIs & Services → Credentials**
2. Haz clic en **"+ Create Credentials"** → **"OAuth client ID"**
3. Configura los siguientes campos:

| Campo | Valor |
|-------|-------|
| **Application type** | `Web application` |
| **Name** | `GachaEvent Web Client` |

### Authorized JavaScript Origins

4. Agrega las siguientes URLs:

```
http://localhost:3000
https://tu-dominio-de-produccion.vercel.app
```

### Authorized Redirect URIs

5. Agrega la **Redirect URI de Supabase**. La encuentras en tu Dashboard de Supabase:
   - Ve a **Authentication → Providers → Google**
   - Copia el valor de **"Callback URL (for OAuth)"**
   - Tiene el formato: `https://<TU-PROJECT-REF>.supabase.co/auth/v1/callback`

6. Haz clic en **"Create"**

> **IMPORTANTE:** Guarda el `Client ID` y `Client Secret` que aparecen en el modal. Los necesitarás en el siguiente paso.

---

## Paso 4: Conectar Google OAuth con Supabase

1. Ve al [Dashboard de Supabase](https://supabase.com/dashboard)
2. Selecciona tu proyecto GachaEvent
3. Navega a **Authentication → Providers**
4. Busca **Google** en la lista y haz clic para expandirlo
5. Activa el toggle **"Enable Sign in with Google"**
6. Completa los campos:

| Campo | Valor |
|-------|-------|
| **Client ID** | El `Client ID` del Paso 3 |
| **Client Secret** | El `Client Secret` del Paso 3 |

7. Haz clic en **"Save"**

---

## Paso 5: Verificar la Configuración

### Test Local

1. Asegúrate de que tu app esté corriendo en `http://localhost:3000`:
   ```bash
   npm run dev
   ```

2. Ve a `http://localhost:3000/login`
3. Haz clic en el botón **"Google"**
4. Deberías ver la pantalla de consentimiento de Google
5. Selecciona tu cuenta de test
6. Deberías ser redirigido de vuelta a `/dashboard` autenticado

### Verificar en Supabase

1. Ve a **Authentication → Users** en tu Dashboard de Supabase
2. Deberías ver tu usuario con el provider `google`

---

## Paso 6: Publicar la App (Producción)

> **⚠️ WARNING:** Este paso es **necesario** para permitir que cualquier usuario (no solo test users) pueda autenticarse con Google.

1. Vuelve a **APIs & Services → OAuth consent screen** en Google Cloud Console
2. Haz clic en **"Publish App"**
3. Confirma la publicación

> **Nota:** Para apps que solo usan scopes básicos (`email`, `profile`, `openid`), Google **no requiere verificación**. La publicación es instantánea.

### Actualizar Authorized Origins (Producción)

4. Ve a **APIs & Services → Credentials** → tu OAuth Client
5. Agrega tu dominio de producción en **Authorized JavaScript Origins**:
   ```
   https://tu-app.vercel.app
   ```
6. Verifica que el **Redirect URI de Supabase** ya esté agregado

---

## Troubleshooting

### "Error 403: access_denied"
- **Causa:** Tu email no está en la lista de Test Users
- **Solución:** Agrega tu email en OAuth consent screen → Test Users, o publica la app

### "Error: redirect_uri_mismatch"
- **Causa:** La Redirect URI no coincide exactamente
- **Solución:** Verifica que la URL en Google Cloud sea **exactamente** igual a la Callback URL de Supabase (incluyendo el protocolo `https://`)

### "Error 400: invalid_client"
- **Causa:** Client ID o Client Secret incorrectos
- **Solución:** Regenera las credenciales en Google Cloud y actualízalas en Supabase

### El botón no hace nada
- **Causa:** El provider Google no está habilitado en Supabase
- **Solución:** Ve a Authentication → Providers → Google y verifica que esté habilitado

---

## Resumen de URLs Necesarias

| Concepto | Ejemplo |
|----------|---------|
| **Supabase Callback URL** | `https://<ref>.supabase.co/auth/v1/callback` |
| **JS Origin (dev)** | `http://localhost:3000` |
| **JS Origin (prod)** | `https://tu-app.vercel.app` |
| **Redirect URI** | Igual que Supabase Callback URL |
