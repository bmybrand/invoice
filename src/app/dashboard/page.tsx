'use client'

import { useDashboardProfile } from '@/components/DashboardLayout'
import { Dashboard } from '@/components/Dashboard'
import ClientDashboard from '@/components/clientdashboard'

export default function DashboardPage() {
  const { accountType, profileLoaded } = useDashboardProfile()

  if (!profileLoaded) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-slate-400">
        Loading...
      </div>
    )
  }

  if (accountType === 'client') {
    return <ClientDashboard />
  }

  if (accountType === 'employee') {
    return <Dashboard />
  }

  return (
    <div className="flex min-h-[200px] items-center justify-center text-slate-400">
      Loading...
    </div>
  )
}
