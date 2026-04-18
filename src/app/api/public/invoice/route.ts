import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { verifyInvoiceToken } from '@/lib/invoice-token'

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token')?.trim() ?? ''
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const payload = verifyInvoiceToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  const [{ data: invoice, error: invoiceError }, { data: brands, error: brandsError }] = await Promise.all([
    supabase
      .from('invoices')
      .select('*, employees!invoice_creator_id(employee_name), clients!client_id(name)')
      .eq('id', payload.id)
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
