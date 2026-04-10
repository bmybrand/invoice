'use client'

import { Suspense, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DashboardLayout } from '@/components/DashboardLayout'
import InvoiceView from '@/components/InvoiceView'

export default function InvoiceRouteShell({ invoiceId, invoiceToken }: { invoiceId: number; invoiceToken: string | null }) {
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
    return <div className="min-h-screen bg-white p-6 text-sm text-slate-500">Loading invoice...</div>
  }

  if (isEmployee) {
    return (
      <DashboardLayout>
        <div className="border-b border-slate-700 px-4 py-4 sm:px-6">
          <h1 className="text-xl font-bold text-white mb-2">Invoice</h1>
        </div>
        <Suspense fallback={<div className="p-6 text-sm text-slate-400">Loading invoice...</div>}>
          <InvoiceView invoiceId={invoiceId} invoiceToken={invoiceToken} publicView={false} />
        </Suspense>
      </DashboardLayout>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Suspense fallback={<div className="min-h-screen bg-white p-6 text-sm text-slate-500">Loading invoice...</div>}>
        <InvoiceView invoiceId={invoiceId} invoiceToken={invoiceToken} publicView />
      </Suspense>
    </div>
  )
}
