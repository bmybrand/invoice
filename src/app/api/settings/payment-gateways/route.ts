import { NextResponse } from 'next/server'
import { requirePaymentGatewayAdmin } from '@/lib/server-payment-gateway-auth'

function normalizeStatus(value: unknown): string {
  return String(value ?? 'Active').trim() || 'Active'
}

function parseAmount(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(request: Request) {
  const auth = await requirePaymentGatewayAdmin(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data, error } = await auth.supabase
    .from('payment_gateways')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ gateways: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await requirePaymentGatewayAdmin(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const name = String(body?.name ?? '').trim()
  const testingPublishableKey = String(body?.testingPublishableKey ?? '').trim()
  const testingSecretKey = String(body?.testingSecretKey ?? '').trim()

  if (!name) {
    return NextResponse.json({ error: 'Gateway name is required' }, { status: 400 })
  }

  const minimumDepositAmount = parseAmount(body?.minimumDepositAmount)
  const maximumDepositAmount = parseAmount(body?.maximumDepositAmount)

  if (minimumDepositAmount == null || maximumDepositAmount == null) {
    return NextResponse.json({ error: 'Minimum and maximum deposit amounts are required' }, { status: 400 })
  }

  if (!testingPublishableKey) {
    return NextResponse.json({ error: 'Gateway testing publishable key is required' }, { status: 400 })
  }

  if (!testingSecretKey) {
    return NextResponse.json({ error: 'Gateway testing secret key is required' }, { status: 400 })
  }

  if (minimumDepositAmount < 0 || maximumDepositAmount < 0 || maximumDepositAmount < minimumDepositAmount) {
    return NextResponse.json({ error: 'Deposit amounts are invalid' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('payment_gateways')
    .insert({
      name,
      minimum_deposit_amount: minimumDepositAmount,
      maximum_deposit_amount: maximumDepositAmount,
      testing_publishable_key: testingPublishableKey,
      testing_secret_key: testingSecretKey,
      live_publishable_key: String(body?.livePublishableKey ?? '').trim(),
      live_secret_key: String(body?.liveSecretKey ?? '').trim(),
      status: normalizeStatus(body?.status),
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ gateway: data }, { status: 201 })
}
