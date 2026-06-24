import { NextResponse } from 'next/server'
import { listActiveStripeGatewayOptions } from '@/lib/server-stripe-gateways'
import { requireActiveEmployee } from '@/lib/server-employee-auth'

export async function GET(request: Request) {
  const auth = await requireActiveEmployee(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const gatewayList = await listActiveStripeGatewayOptions()
  if (!gatewayList.ok) {
    return NextResponse.json({ error: gatewayList.error }, { status: gatewayList.status })
  }

  return NextResponse.json({ gateways: gatewayList.gateways })
}
