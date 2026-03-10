import InvoiceRouteShell from '@/components/InvoiceRouteShell'

export default async function PublicInvoicePage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string }> | { id?: string }
}) {
  const resolvedParams = searchParams instanceof Promise ? await searchParams : searchParams
  const invoiceId = Number(resolvedParams?.id)

  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    return (
      <div className="min-h-screen bg-white p-6 text-slate-600">
        Invalid invoice link.
      </div>
    )
  }

  return (
    <InvoiceRouteShell invoiceId={invoiceId} />
  )
}
