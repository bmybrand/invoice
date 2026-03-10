import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = serviceRoleKey
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
  : null

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const invoiceId = Number(id)

  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 })
  }

  if (!supabase) {
    return NextResponse.json(
      { error: 'Server not configured. Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase Dashboard → Project Settings → API → service_role)' },
      { status: 503 }
    )
  }

  const { error } = await supabase
    .from('invoices')
    .update({ status: 'Paid' })
    .eq('id', invoiceId)

  if (error) {
    console.error('Failed to update invoice status:', error)
    const msg = error.code === '23514'
      ? 'Database does not allow "Processing" status. Run the migration: supabase/migrations/20250310000000_add_processing_status.sql in Supabase SQL Editor.'
      : error.message ?? 'Failed to update status'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
