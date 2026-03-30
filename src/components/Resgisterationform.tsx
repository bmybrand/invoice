'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { clearRequiredFieldInvalid, handleRequiredFieldInvalid } from '@/lib/form-validation'

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

function UserIcon() {
  return (
    <svg className="h-5 w-5 shrink-0 text-slate-400 sm:h-6 sm:w-6 lg:h-7 lg:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a8.25 8.25 0 0114.998 0" />
    </svg>
  )
}

export function RegisterForm() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    })

    if (signUpError) {
      setLoading(false)
      setError(signUpError.message)
      return
    }

    const user = data.user

    if (user) {
      const { error: requestError } = await supabase.from('clients').insert([
        {
          name,
          email,
          auth_id: user.id,
          handler_id: user.id,
          status: 'pending',
          isdeleted: false,
        },
      ])

      if (requestError) {
        setLoading(false)
        setError(requestError.message)
        return
      }
    }

    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    setLoading(false)
    router.replace('/register/pending')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="flex min-h-175 w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-700 shadow-xl sm:rounded-3xl">
        <div className="flex w-full flex-col justify-center bg-slate-800/80 px-5 py-8 sm:w-1/2 sm:px-8 sm:py-12 md:px-10 lg:px-20 lg:py-12 xl:px-24 xl:py-14">
          <div className="mx-auto w-full max-w-md sm:max-w-lg lg:max-w-xl">
            <h1 className="text-3xl font-bold text-white sm:text-4xl lg:text-4xl xl:text-5xl">Create Account</h1>
            <p className="mt-2 text-sm text-slate-400 sm:mt-3 sm:text-base lg:text-base xl:text-lg">
              Register to start managing your invoices.
            </p>

            <form
              onSubmit={handleSubmit}
              onInvalidCapture={handleRequiredFieldInvalid}
              onInputCapture={clearRequiredFieldInvalid}
              onChangeCapture={clearRequiredFieldInvalid}
              className="mt-4 flex flex-col gap-3 sm:mt-5 sm:gap-4 lg:gap-4 xl:gap-5"
            >
              <div className="flex flex-col gap-1">
                <label htmlFor="name" className="text-sm font-medium text-slate-300 sm:text-base lg:text-base xl:text-lg">
                  Name
                </label>
                <div className="flex items-center gap-3 rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 sm:rounded-xl sm:px-5 sm:py-4 lg:px-6 lg:py-4 xl:py-[18px]">
                  <UserIcon />
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                    autoComplete="name"
                    className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none sm:text-base lg:text-base xl:text-lg"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="email" className="text-sm font-medium text-slate-300 sm:text-base lg:text-base xl:text-lg">
                  Email
                </label>
                <div className="flex items-center gap-3 rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 sm:rounded-xl sm:px-5 sm:py-4 lg:px-6 lg:py-4 xl:py-[18px]">
                  <EnvelopeIcon />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    required
                    autoComplete="email"
                    className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none sm:text-base lg:text-base xl:text-lg"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="password" className="text-sm font-medium text-slate-300 sm:text-base lg:text-base xl:text-lg">
                  Password
                </label>
                <div className="flex items-center gap-3 rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 sm:rounded-xl sm:px-5 sm:py-4 lg:px-6 lg:py-4 xl:py-[18px]">
                  <LockIcon />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="********"
                    required
                    autoComplete="new-password"
                    className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none sm:text-base lg:text-base xl:text-lg"
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
                className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-orange-600 disabled:opacity-50 sm:mt-2 sm:rounded-xl sm:px-5 sm:py-4 sm:text-base lg:px-6 lg:py-4 lg:text-base xl:py-5 xl:text-lg"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>

              <p className="text-center text-sm text-slate-400 sm:text-base">
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-orange-500 hover:text-orange-400">
                  Sign in
                </Link>
              </p>
            </form>
          </div>
        </div>

        <div className="relative hidden w-1/2 overflow-hidden bg-[#0b0f1c] sm:block">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)`,
              backgroundSize: '24px 24px',
            }}
          />
          <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
          <div className="absolute bottom-1/4 right-0 h-48 w-48 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center">
              <div className="absolute z-0 h-44 w-56 rounded-xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-sm" style={{ transform: 'rotate(-12deg) translateX(-80px)' }} />
              <div className="absolute z-0 h-56 w-28 rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-sm" style={{ transform: 'rotate(8deg) translateX(60px)' }} />
              <div className="relative z-10 flex h-44 w-44 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/95 shadow-2xl shadow-orange-500/20 lg:h-48 lg:w-48">
                <Image
                  src="/bmybrand-B.svg"
                  alt="Invoice CRM logo"
                  width={136}
                  height={136}
                  className="h-28 w-28 object-contain lg:h-32 lg:w-32"
                  priority
                />
              </div>
            </div>
            <Link href="/" className="z-10 mt-8 text-4xl font-black tracking-tight text-white lg:text-5xl">
              <span className="text-white">Invoice</span> <span className="text-orange-500">CRM</span>
            </Link>
            <p className="mt-4 text-sm font-medium uppercase tracking-widest text-white/90 z-10">
              Creative Agency Solutions
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}




