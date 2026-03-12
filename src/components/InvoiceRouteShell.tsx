'use client'

import { useEffect, useState } from 'react'
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
      <DashboardLayout title="Invoice">
        <InvoiceView invoiceId={invoiceId} invoiceToken={invoiceToken} publicView={false} />
      </DashboardLayout>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <InvoiceView invoiceId={invoiceId} invoiceToken={invoiceToken} publicView />
    </div>
  )
}
