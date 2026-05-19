'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import VideoAnimationBriefForm from '@/components/VideoAnimationBriefForm'
import type { BriefFormPrefill } from '@/lib/brief-form-prefill'

export default function VideoAnimationBriefRouteShell({ embedInDashboard = false }: { embedInDashboard?: boolean }) {
  const [resolved, setResolved] = useState(false)
  const [isPortalUser, setIsPortalUser] = useState(false)
  const [isEmployee, setIsEmployee] = useState(false)
  const [prefill, setPrefill] = useState<BriefFormPrefill>({})

  useEffect(() => {
    async function resolveViewer() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user?.id) {
        setIsPortalUser(false)
        setIsEmployee(false)
        setPrefill({})
        setResolved(true)
        return
      }

      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('auth_id', user.id)
        .neq('isdeleted', true)
        .maybeSingle()

      const employeeMatch = !!employee
      setIsPortalUser(employeeMatch)
      setIsEmployee(employeeMatch)

      if (!employeeMatch) {
        const { data: client } = await supabase
          .from('clients')
          .select('name, email, phone')
          .eq('auth_id', user.id)
          .neq('isdeleted', true)
          .maybeSingle()

        const clientRow = client as { name?: string | null; email?: string | null; phone?: string | null } | null
        const clientMatch = !!clientRow
        setIsPortalUser(clientMatch)
        setPrefill({
          contactPerson: clientRow?.name?.trim() || '',
          email: clientRow?.email?.trim() || user.email || '',
          phone: clientRow?.phone?.trim() || '',
        })
      } else {
        setPrefill({})
      }

      setResolved(true)
    }

    resolveViewer()
  }, [])

  if (!resolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f172a] p-6 text-sm text-slate-400">
        Loading form...
      </div>
    )
  }

  if (isPortalUser) {
    return isEmployee ? (
      <VideoAnimationBriefForm backHref="/dashboard/brief-forms" backLabel="Back to Brief Forms" />
    ) : (
      <VideoAnimationBriefForm backHref="/dashboard/brief-forms" backLabel="Back to Brief Forms" prefill={prefill} showCopyAction={false} />
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-[920px] border border-slate-200 bg-white">
        <VideoAnimationBriefForm publicView prefill={prefill} />
      </div>
    </div>
  )
}
