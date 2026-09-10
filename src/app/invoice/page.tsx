import InvoiceRouteShell from '@/components/InvoiceRouteShell'
import { decryptInvoiceToken, readInvoiceToken } from '@/lib/invoice-token'
import { buildInvoiceMetadata } from '@/lib/server-invoice-metadata'

type InvoiceSearchParams = { id?: string; token?: string }

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<InvoiceSearchParams> | InvoiceSearchParams
}) {
  const resolvedParams = searchParams instanceof Promise ? await searchParams : searchParams
  return buildInvoiceMetadata(resolvedParams?.token, 'view')
}

export default async function PublicInvoicePage({
  searchParams,
}: {
  searchParams?: Promise<InvoiceSearchParams> | InvoiceSearchParams
}) {
  const resolvedParams = searchParams instanceof Promise ? await searchParams : searchParams
  const tokenParam = resolvedParams?.token

  let invoiceId: number
  const invoiceToken: string | null = tokenParam ?? null
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
