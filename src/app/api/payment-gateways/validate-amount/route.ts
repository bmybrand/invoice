import { NextResponse } from 'next/server'
import { listActiveStripeGatewayLimits, validateStripeGatewayAmount } from '@/lib/server-stripe-gateways'
import { requireActiveEmployee } from '@/lib/server-employee-auth'

export async function GET(req: Request) {
  const auth = await requireActiveEmployee(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(req.url)
  const amount = Number(url.searchParams.get('amount') ?? '')

  const gatewayLookup = await validateStripeGatewayAmount(amount)
  if (!gatewayLookup.ok) {
    const gatewayLimits = await listActiveStripeGatewayLimits()

    return NextResponse.json(
      {
        error: gatewayLookup.error,
        gateways: gatewayLimits.ok ? gatewayLimits.gateways : [],
      },
      { status: gatewayLookup.status }
    )
  }

  return NextResponse.json({
    gateway: gatewayLookup.gateway.name,
    minAmount: gatewayLookup.gateway.minAmount,
    maxAmount: gatewayLookup.gateway.maxAmount,
  })
}
