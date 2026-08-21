import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/hoy'

  // Detrás del proxy de Vercel, `origin` es el host interno. El host público
  // llega en x-forwarded-host, y sin esto el usuario acaba redirigido a una
  // URL que no es la suya.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const baseUrl =
    process.env.NODE_ENV === 'development' || !forwardedHost
      ? origin
      : `${forwardedProto}://${forwardedHost}`

  // El proveedor OAuth puede devolver el error aquí, no como excepción.
  const oauthError = searchParams.get('error_description') ?? searchParams.get('error')
  if (oauthError) {
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent(oauthError)}`
    )
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // `next` viene de la URL: solo se aceptan rutas relativas, nunca un
      // host externo, o sería un redirect abierto.
      const target = next.startsWith('/') && !next.startsWith('//') ? next : '/hoy'
      return NextResponse.redirect(`${baseUrl}${target}`)
    }
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent(error.message)}`
    )
  }

  return NextResponse.redirect(`${baseUrl}/login?error=missing_code`)
}
