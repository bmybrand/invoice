import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

export default async function InvoicePayReturnPage({
  searchParams,
}: {
  searchParams?: Promise<{ invoice_id?: string; payment_intent?: string }> | { invoice_id?: string; payment_intent?: string }
}) {
  const params = searchParams instanceof Promise ? await searchParams : searchParams
  const invoiceId = Number(params?.invoice_id)

  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    redirect('/')
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  )

  await supabase.from('invoices').update({ status: 'Paid' }).eq('id', invoiceId)

  redirect(`/invoice?id=${invoiceId}&payment=success`)
}
