'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function RegisterPendingPage() {
  const router = useRouter()

  useEffect(() => {
    let active = true

    const timeoutId = window.setTimeout(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!active || !session?.user) return

      const authId = session.user.id
      const normalizedEmail = (session.user.email ?? '').trim()

      const [
        { data: employeeData, error: employeeError },
        { data: clientData, error: clientError },
        { data: latestRequest, error: requestError },
      ] = await Promise.all([
        supabase.from('employees').select('id').eq('auth_id', authId).maybeSingle(),
        supabase
          .from('clients')
          .select('id')
          .eq('status', 'approved')
          .neq('isdeleted', true)
          .or(`handler_id.eq.${authId},email.eq.${normalizedEmail}`)
          .maybeSingle(),
        supabase
          .from('clients')
          .select('status')
          .neq('isdeleted', true)
          .or(`handler_id.eq.${authId},email.eq.${normalizedEmail}`)
          .order('created_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      if (!active || employeeError || clientError || requestError) return

      if (employeeData || clientData) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
        if (!active) return
        router.replace('/login?reason=approved')
        return
      }

      const requestStatus = (latestRequest as { status?: string } | null)?.status?.trim().toLowerCase()

      if (requestStatus === 'rejected') {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
        if (!active) return
        router.replace('/login?reason=rejected')
      }
    }, 0)

    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [router])

  return (
    <main className="flex h-screen min-h-screen flex-col items-center justify-center bg-gray-900 p-4">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-700 bg-slate-800/80 p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20">
          <svg className="h-8 w-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white">Account Pending Approval</h1>
        <p className="mt-2 text-slate-400">
          Your registration has been submitted. An administrator will review and approve your account shortly.
          You will receive access to the dashboard once approved.
        </p>
        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
            router.replace('/login')
          }}
          className="mt-6 inline-block rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-600 transition"
        >
          Back to Sign In
        </button>
      </div>
    </main>
  )
}



