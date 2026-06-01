import InvoicePayRouteShell from '@/components/InvoicePayRouteShell'
import { readInvoiceToken } from '@/lib/invoice-token'

export default async function InvoicePayPage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string; token?: string }> | { id?: string; token?: string }
}) {
  const resolvedParams = searchParams instanceof Promise ? await searchParams : searchParams
  const tokenParam = resolvedParams?.token

  let invoiceId: number
  let invoiceToken: string | null = tokenParam ?? null
  let tokenExpired = false
  let tokenExpiresAt: number | null = null

  if (tokenParam) {
    const activePayload = readInvoiceToken(tokenParam)
    if (activePayload) {
      invoiceId = activePayload.id
      tokenExpiresAt = activePayload.exp
    } else {
      const expiredPayload = readInvoiceToken(tokenParam, { allowExpired: true })
      invoiceId = expiredPayload?.id ?? 0
      tokenExpired = !!expiredPayload
      tokenExpiresAt = expiredPayload?.exp ?? null
      if (tokenExpired) {
        invoiceToken = null
      }
    }
  } else {
    invoiceId = 0
  }

  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 p-6 text-slate-400">
        Invalid invoice link.
      </div>
    )
  }

  return (
    <InvoicePayRouteShell
      invoiceId={invoiceId}
      invoiceToken={invoiceToken}
      tokenExpired={tokenExpired}
      tokenExpiresAt={tokenExpiresAt}
    />
  )
}
