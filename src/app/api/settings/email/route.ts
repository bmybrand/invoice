import { NextResponse } from 'next/server'
import { getEmailSendingSettings, setEmailSendingEnabled } from '@/lib/server-app-settings'
import { requirePaymentGatewayAdmin } from '@/lib/server-payment-gateway-auth'

export async function GET(request: Request) {
  const auth = await requirePaymentGatewayAdmin(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const settings = await getEmailSendingSettings()
  if (!settings.ok) {
    return NextResponse.json({ error: settings.error }, { status: settings.status })
  }

  return NextResponse.json({ enabled: settings.enabled })
}

export async function PATCH(request: Request) {
  const auth = await requirePaymentGatewayAdmin(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => null)) as { enabled?: unknown } | null
  if (typeof body?.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 })
  }

  const result = await setEmailSendingEnabled(auth.supabase, body.enabled)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ enabled: body.enabled })
}
