import InvoicePayRouteShell from '@/components/InvoicePayRouteShell'
import { encryptInvoiceId, verifyInvoiceToken } from '@/lib/invoice-token'

export default async function InvoicePayPage({
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
    const payload = verifyInvoiceToken(tokenParam)
    invoiceId = payload?.id ?? 0
    if (invoiceId > 0) {
      invoiceToken = payload?.purpose === 'pay' ? tokenParam : encryptInvoiceId(invoiceId, 'pay')
    }
  } else if (idParam) {
    invoiceId = Number(idParam)
    if (Number.isFinite(invoiceId) && invoiceId > 0) invoiceToken = encryptInvoiceId(invoiceId, 'pay')
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

  return <InvoicePayRouteShell invoiceId={invoiceId} invoiceToken={invoiceToken} />
}
