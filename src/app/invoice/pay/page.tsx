import InvoicePayRouteShell from '@/components/InvoicePayRouteShell'

export default async function InvoicePayPage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string }> | { id?: string }
}) {
  const resolvedParams = searchParams instanceof Promise ? await searchParams : searchParams
  const invoiceId = Number(resolvedParams?.id)

  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 p-6 text-slate-400">
        Invalid invoice link.
      </div>
    )
  }

  return <InvoicePayRouteShell invoiceId={invoiceId} />
}
