'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function EnvelopeIcon() {
  return (
    <svg className="h-5 w-5 shrink-0 text-slate-400 sm:h-6 sm:w-6 lg:h-7 lg:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg className="h-5 w-5 shrink-0 text-slate-400 sm:h-6 sm:w-6 lg:h-7 lg:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  )
}

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setLoading(false)
      setError(signInError.message)
      return
    }

    let sessionReady = false

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        sessionReady = true
        break
      }

      await new Promise((resolve) => setTimeout(resolve, 150))
    }

    if (!sessionReady) {
      setLoading(false)
      setError('Sign-in completed, but the session is still syncing. Please try again.')
      return
    }

    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <main className="flex h-screen min-h-screen flex-col items-center justify-center bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="flex min-h-0 w-full flex-1 max-w-6xl overflow-hidden rounded-2xl border border-slate-700 shadow-xl sm:rounded-3xl">
        {/* Left column - form */}
        <div className="flex w-full flex-col justify-center bg-slate-800/80 px-5 py-8 sm:w-1/2 sm:px-12 sm:py-12 md:px-16 lg:px-20 lg:py-16 xl:px-24 xl:py-20">
        <div className="mx-auto w-full max-w-md sm:max-w-lg lg:max-w-xl">
          <Link href="/" className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            <span className="text-white">Invoice</span> <span className="text-orange-500">CRM</span>
          </Link>

          <h1 className="mt-6 text-3xl font-bold text-white sm:mt-8 sm:text-4xl lg:text-5xl">Welcome Back</h1>
          <p className="mt-2 text-sm text-slate-400 sm:mt-3 sm:text-base lg:text-lg">
            Enter your credentials to access your dashboard.
          </p>

          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4 sm:mt-6 sm:gap-5 lg:gap-6">
            <div className="flex flex-col gap-1.5 sm:gap-2">
              <label htmlFor="email" className="text-sm font-medium text-slate-300 sm:text-base lg:text-lg">
                Email
              </label>
              <div className="flex items-center gap-3 rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 sm:rounded-xl sm:px-5 sm:py-4 lg:px-6 lg:py-5">
                <EnvelopeIcon />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  autoComplete="email"
                  className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none sm:text-base lg:text-lg"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 sm:gap-2">
              <label htmlFor="password" className="text-sm font-medium text-slate-300 sm:text-base lg:text-lg">
                Password
              </label>
              <div className="flex items-center gap-3 rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 sm:rounded-xl sm:px-5 sm:py-4 lg:px-6 lg:py-5">
                <LockIcon />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none sm:text-base lg:text-lg"
                />
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400 sm:rounded-xl sm:text-base">
                {error}
              </p>
            )}

           <button
  type="submit"
  disabled={loading}
  className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-orange-600 disabled:opacity-50 sm:mt-2 sm:rounded-xl sm:px-5 sm:py-4 sm:text-base lg:py-5 lg:px-6 lg:text-lg"
>
  {loading ? 'Signing in…' : 'Sign In'}
</button>

<p className="text-center text-sm text-slate-400 sm:text-base">
  Don’t have an account?{' '}
  <Link href="/register" className="font-medium text-orange-500 hover:text-orange-400">
    Create one
  </Link>
</p>

          </form>
        </div>
      </div>

      {/* Right column - branding */}
      <div className="relative hidden w-1/2 overflow-hidden bg-[#0b0f1c] sm:block">
        {/* Subtle dot pattern */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />
        {/* Soft glows */}
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute bottom-1/4 right-0 h-48 w-48 rounded-full bg-orange-500/10 blur-3xl" />
        {/* Center: I, Power Your Brand, Creative Agency Solutions */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="relative flex items-center justify-center">
            <div className="absolute z-0 h-44 w-56 rounded-xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-sm" style={{ transform: 'rotate(-12deg) translateX(-80px)' }} />
            <div className="absolute z-0 h-56 w-28 rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-sm" style={{ transform: 'rotate(8deg) translateX(60px)' }} />
            <div className="relative z-10 flex h-40 w-40 shrink-0 items-center justify-center rounded-full bg-orange-500 shadow-2xl shadow-orange-500/30">
              <span className="text-6xl font-bold text-white">I</span>
            </div>
          </div>
          <h2 className="mt-8 text-3xl font-bold uppercase tracking-wider z-10 text-white lg:text-4xl">
            Power Your Brand
          </h2>
          <div className="mt-2 h-1 w-16 rounded-full bg-orange-500" />
          <p className="mt-3 text-sm font-medium uppercase tracking-widest text-white/90 z-10">
            Creative Agency Solutions
          </p>
        </div>
      </div>
      </div>
    </main>
  )
}
