'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DashboardLayout } from '@/components/DashboardLayout'
import LogoDesignBriefForm from '@/components/LogoDesignBriefForm'

export default function LogoDesignBriefRouteShell() {
  const [resolved, setResolved] = useState(false)
  const [isEmployee, setIsEmployee] = useState(false)

  useEffect(() => {
    async function resolveViewer() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user?.id) {
        setIsEmployee(false)
        setResolved(true)
        return
      }

      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('auth_id', user.id)
        .neq('isdeleted', true)
        .maybeSingle()

      setIsEmployee(!!employee)
      setResolved(true)
    }

    resolveViewer()
  }, [])

  if (!resolved) {
    return <div className="min-h-screen bg-white p-6 text-sm text-slate-500">Loading form...</div>
  }

  if (isEmployee) {
    return (
      <DashboardLayout>
        <LogoDesignBriefForm backHref="/dashboard/brief-forms" backLabel="Back to Brief Forms" />
      </DashboardLayout>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-[920px] border border-slate-200 bg-white">
        <LogoDesignBriefForm publicView />
      </div>
    </div>
  )
}
