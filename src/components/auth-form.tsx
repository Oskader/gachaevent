'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

type Mode = 'login' | 'register'

/**
 * Login y registro compartían ~120 líneas idénticas (campos, botón de
 * Google, toggle de contraseña). Una sola pieza con dos modos.
 */
export function AuthForm({ mode }: { mode: Mode }) {
  const isRegister = mode === 'register'
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const next = searchParams.get('next') ?? '/hoy'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    if (isRegister && password !== confirm) {
      toast.error('Las contraseñas no coinciden')
      setLoading(false)
      return
    }

    if (isRegister) {
      const { data, error } = await supabase.auth.signUp({ email, password })

      if (error) {
        toast.error(error.message)
        setLoading(false)
        return
      }

      // Con "Confirm email" activo, un alta CORRECTA devuelve session:null.
      // Antes se reportaba como error y el usuario se quedaba sin saber que
      // tenía que ir a su bandeja de entrada.
      if (!data.session) {
        toast.success('Cuenta creada. Confirma tu correo para entrar.', {
          description: `Te hemos enviado un enlace a ${email}.`,
          duration: 8000,
        })
        setLoading(false)
        return
      }

      toast.success('Cuenta creada')
      router.push(next)
      router.refresh()
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error(
        error.message.includes('Email not confirmed')
          ? 'Todavía no has confirmado tu correo. Revisa tu bandeja de entrada.'
          : 'Correo o contraseña incorrectos.'
      )
      setLoading(false)
      return
    }

    router.push(next)
    router.refresh()
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (error) toast.error('No se pudo abrir el acceso con Google')
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          id="email"
          label="Correo"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="tu@correo.com"
          autoComplete="email"
        />

        <Field
          id="password"
          label="Contraseña"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={setPassword}
          placeholder="Mínimo 6 caracteres"
          minLength={6}
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="text-dim transition-colors hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          }
        />

        {isRegister && (
          <Field
            id="confirm"
            label="Repite la contraseña"
            type={showPassword ? 'text' : 'password'}
            value={confirm}
            onChange={setConfirm}
            placeholder="Mínimo 6 caracteres"
            minLength={6}
            autoComplete="new-password"
          />
        )}

        <Button
          type="submit"
          disabled={loading}
          className="mt-1 w-full rounded-none bg-foreground py-5 text-sm font-semibold text-background hover:bg-foreground/85"
        >
          {loading
            ? 'Un momento…'
            : isRegister
              ? 'Crear cuenta'
              : 'Entrar'}
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        {/* Sin mayúsculas ni mono: la "O" de JetBrains Mono se confunde
            con un cero. */}
        <span className="text-[11px] text-dim">o</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={handleGoogle}
        className="w-full rounded-none border-line-strong py-5 text-sm hover:bg-panel"
      >
        <GoogleMark />
        Continuar con Google
      </Button>

      <p className="text-center text-xs text-dim">
        {isRegister ? '¿Ya tienes cuenta? ' : '¿Todavía no tienes cuenta? '}
        <Link
          href={isRegister ? '/login' : '/register'}
          className="text-foreground underline underline-offset-4 hover:text-[var(--urgency-low)]"
        >
          {isRegister ? 'Inicia sesión' : 'Créala'}
        </Link>
      </p>
    </div>
  )
}

function Field({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  minLength,
  autoComplete,
  trailing,
}: {
  id: string
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minLength?: number
  autoComplete?: string
  trailing?: React.ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="tabular mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-dim"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          minLength={minLength}
          autoComplete={autoComplete}
          required
          className="w-full border border-line-strong bg-panel px-3 py-2.5 text-sm text-foreground placeholder:text-[var(--text-faint)] focus:border-foreground focus:outline-none"
        />
        {trailing && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {trailing}
          </span>
        )}
      </div>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}
