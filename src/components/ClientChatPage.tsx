'use client'

import { useClientDashboardData } from '@/context/ClientDashboardDataContext'
import { ClientChatModal } from '@/components/ClientChatModal'

export function ClientChatPage() {
  const clientData = useClientDashboardData()

  if (!clientData || clientData.loading) {
    return null
  }

  if (clientData.error) {
    return (
      <div className="rounded-[32px] border border-red-500/30 bg-red-500/10 p-8">
        <h1 className="text-xl font-black text-white">Unable to load chat</h1>
        <p className="mt-2 text-sm text-red-300">{clientData.error}</p>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-4 sm:gap-6">
      <div className="min-w-0">
        <h1 className="text-xl font-black leading-tight text-white sm:text-2xl md:text-3xl lg:text-4xl">
          Chat with Your Handler
        </h1>
        <p className="mt-1 text-xs font-medium leading-5 text-slate-500 sm:text-sm md:text-base md:leading-6">
          Message your assigned handler, share files, and review recent invoices in one place.
        </p>
      </div>

      <ClientChatModal
        open={Boolean(clientData.client?.id)}
        clientId={clientData.client?.id ?? null}
        title={clientData.client?.name || 'Chat'}
        subtitle={clientData.clientEmail}
        onClose={() => {}}
        variant="page"
      />
    </div>
  )
}
