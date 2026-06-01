import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

export async function GET(req: Request) {
  const url = new URL(req.url)
  const idParam = url.searchParams.get('id')?.trim() ?? ''

  if (!idParam) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const invoiceId = Number(idParam)
  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    return NextResponse.json({ error: 'Invalid invoice id' }, { status: 400 })
  }

  const [{ data: invoice, error: invoiceError }, { data: brands, error: brandsError }] = await Promise.all([
    supabase
      .from('invoices')
      .select('*, employees!invoice_creator_id(employee_name), clients!client_id(name)')
      .eq('id', invoiceId as number)
      .maybeSingle(),
    supabase
      .from('brands')
      .select('id, brand_name, brand_url, logo_url')
      .neq('isdeleted', true)
      .order('brand_name'),
  ])

  if (invoiceError) {
    return NextResponse.json({ error: invoiceError.message }, { status: 500 })
  }

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  if (brandsError) {
    return NextResponse.json({ error: brandsError.message }, { status: 500 })
  }

  return NextResponse.json({
    invoice,
    brands: brands ?? [],
  })
}
