'use client'

import { useDashboardProfile } from '@/components/DashboardLayout'
import { Dashboard } from '@/components/Dashboard'
import ClientDashboard from '@/components/clientdashboard'

export default function DashboardPage() {
  const { accountType } = useDashboardProfile()

  if (accountType === 'client') {
    return <ClientDashboard />
  }

  return <Dashboard />
}
