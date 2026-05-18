'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DashboardLayout } from '@/components/DashboardLayout'
import SeoQuestionnaireForm from '@/components/SeoQuestionnaireForm'

export default function SeoQuestionnaireRouteShell() {
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
        <SeoQuestionnaireForm backHref="/dashboard/brief-forms" backLabel="Back to Brief Forms" />
      </DashboardLayout>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <SeoQuestionnaireForm publicView />
    </div>
  )
}
