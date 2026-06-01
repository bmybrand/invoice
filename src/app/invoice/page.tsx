import InvoiceRouteShell from '@/components/InvoiceRouteShell'
import { decryptInvoiceToken, readInvoiceToken } from '@/lib/invoice-token'

export default async function PublicInvoicePage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string; token?: string }> | { id?: string; token?: string }
}) {
  const resolvedParams = searchParams instanceof Promise ? await searchParams : searchParams
  const tokenParam = resolvedParams?.token

  let invoiceId: number
  let invoiceToken: string | null = tokenParam ?? null
  let tokenExpired = false

  if (tokenParam) {
    const activeInvoiceId = decryptInvoiceToken(tokenParam)
    if (activeInvoiceId) {
      invoiceId = activeInvoiceId
    } else {
      const expiredPayload = readInvoiceToken(tokenParam, { allowExpired: true })
      invoiceId = expiredPayload?.id ?? 0
      tokenExpired = !!expiredPayload
    }
  } else {
    invoiceId = 0
  }

  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    return (
      <div className="min-h-screen bg-white p-6 text-slate-600">
        Invalid invoice link.
      </div>
    )
  }

  return (
    <InvoiceRouteShell invoiceId={invoiceId} invoiceToken={invoiceToken} tokenExpired={tokenExpired} />
  )
}
