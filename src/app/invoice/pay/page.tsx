import InvoicePayRouteShell from '@/components/InvoicePayRouteShell'
import { encryptInvoiceId, decryptInvoiceToken } from '@/lib/invoice-token'

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

  if (idParam) {
    invoiceId = Number(idParam)
    // Do not require a token; leave invoiceToken null for public access.
    invoiceToken = null
  } else if (tokenParam) {
    // Try to read invoice id from token, but don't enforce token validity here.
    invoiceId = decryptInvoiceToken(tokenParam) ?? 0
    invoiceToken = null
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
