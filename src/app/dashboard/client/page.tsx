'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDashboardProfile } from '@/components/DashboardLayout'
import ClientDashboard from '@/components/clientdashboard'

export default function ClientPage() {
  const router = useRouter()
  const { accountType } = useDashboardProfile()

  useEffect(() => {
    if (accountType === 'employee') {
      router.replace('/dashboard')
    }
  }, [accountType, router])

  if (accountType === 'employee') {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-slate-400">
        Redirecting…
      </div>
    )
  }

  if (accountType === null) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-slate-400">
        Loading…
      </div>
    )
  }

  return <ClientDashboard />
}
