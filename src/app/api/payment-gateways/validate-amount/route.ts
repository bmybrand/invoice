import { NextResponse } from 'next/server'
import { listActiveStripeGatewayLimits, validateStripeGatewayAmount } from '@/lib/server-stripe-gateways'

export async function GET(req: Request) {
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
