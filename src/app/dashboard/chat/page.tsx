'use client'

import { ClientChatPage } from '@/components/ClientChatPage'
import { EmployeeChatsPage } from '@/components/EmployeeChatsPage'
import { useDashboardProfile } from '@/components/DashboardLayout'

export default function DashboardChatPage() {
  const { accountType, profileLoaded } = useDashboardProfile()

  if (!profileLoaded || accountType === null) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-slate-400">
        Loading...
      </div>
    )
  }

  if (accountType === 'client') {
    return <ClientChatPage />
  }

  return <EmployeeChatsPage />
}
