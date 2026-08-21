import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANTE: NO QUITAR. Refresca el token de auth.
  const { data: { user } } = await supabase.auth.getUser()

  // Proteger rutas privadas
  if (!user && isProtected(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', request.nextUrl.pathname)

    // getUser() puede haber escrito cookies refrescadas en supabaseResponse.
    // Un redirect nuevo las descartaría, así que hay que trasladarlas a mano.
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie)
    })
    return redirectResponse
  }

  return supabaseResponse
}

/**
 * Solo /cuenta exige sesión. El resto degrada bien sin ella: /hoy y las
 * páginas de juego se ven en modo lectura, y el checklist se muestra
 * deshabilitado con su propia invitación a entrar.
 */
function isProtected(pathname: string) {
  return pathname === '/cuenta' || pathname.startsWith('/cuenta/')
}

export const config = {
  matcher: [
    /*
     * Todo excepto:
     * - rutas de API (los crons se autentican con CRON_SECRET, no con cookie)
     * - assets de Next y estáticos que no necesitan refresco de sesión
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
