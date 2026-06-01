import InvoiceRouteShell from '@/components/InvoiceRouteShell'

export default async function PublicInvoicePage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string; token?: string }> | { id?: string; token?: string }
}) {
  const resolvedParams = searchParams instanceof Promise ? await searchParams : searchParams
  const idParam = resolvedParams?.id

  let invoiceId: number
  let invoiceToken: string | null = null

  // Only allow access by ?id= for public invoices. Token support removed.
  if (idParam) {
    invoiceId = Number(idParam)
    invoiceToken = null
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
