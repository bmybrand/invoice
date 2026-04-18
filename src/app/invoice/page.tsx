import InvoiceRouteShell from '@/components/InvoiceRouteShell'
import { decryptInvoiceToken, encryptInvoiceId } from '@/lib/invoice-token'

export default async function PublicInvoicePage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string; token?: string }> | { id?: string; token?: string }
}) {
  const resolvedParams = searchParams instanceof Promise ? await searchParams : searchParams
  const tokenParam = resolvedParams?.token
  const idParam = resolvedParams?.id

  let invoiceId: number
  let invoiceToken: string | null = null

  if (tokenParam) {
    invoiceId = decryptInvoiceToken(tokenParam) ?? 0
    if (invoiceId > 0) invoiceToken = tokenParam
  } else if (idParam) {
    invoiceId = Number(idParam)
    if (Number.isFinite(invoiceId) && invoiceId > 0) invoiceToken = encryptInvoiceId(invoiceId, 'view')
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
    <InvoiceRouteShell invoiceId={invoiceId} invoiceToken={invoiceToken} />
  )
}
