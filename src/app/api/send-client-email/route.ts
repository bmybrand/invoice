import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { env } from '@/lib/env'
import { applyRateLimit, getRateLimitIdentity } from '@/lib/rate-limit'
import { requireAdminOrSuperAdmin } from '@/lib/server-admin-auth'

const resend = new Resend(env.RESEND_API_KEY)

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminOrSuperAdmin(req)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const rateLimit = applyRateLimit({
      key: `send-client-email:${auth.user.id}:${getRateLimitIdentity(req)}`,
      limit: 20,
      windowMs: 60_000,
    })
    if (!rateLimit.ok) {
      return NextResponse.json({ error: 'Too many email requests. Please try again shortly.' }, { status: 429 })
    }

    const { email, name, status, password } = await req.json()
    if (!email || !name || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const safeName = escapeHtml(String(name))
    const safeStatus = escapeHtml(String(status))
    const safePassword = password ? escapeHtml(String(password)) : ''

    let subject = 'Welcome to Invoice CRM'
    let html = `<p>Hi <b>${safeName}</b>,</p>`
    if (status === 'approved' || status === 'accepted') {
      html += `<p>Your account has been <b>approved</b>! You can now log in.</p>`
      if (safePassword) {
        html += `<p>Your temporary password: <b>${safePassword}</b></p>`
      }
    } else if (status === 'rejected') {
      subject = 'Your Invoice CRM Registration Status'
      html += `<p>We regret to inform you that your registration was <b>rejected</b>. Please contact support for more information.</p>`
    } else {
      html += `<p>Your registration status: <b>${safeStatus}</b></p>`
    }
    html += `<p>Thank you,<br/>Invoice CRM Team</p>`

    await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: String(email).trim(),
      subject,
      html,
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error || 'Failed to send email')
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
