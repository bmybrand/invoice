import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { applyRateLimit, getRateLimitIdentity } from '@/lib/rate-limit'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildAdminNotificationEmail({
  name,
  email,
  phone,
  agentName,
}: {
  name: string
  email: string
  phone: string
  agentName: string
}) {
  const details = [
    { label: 'Client name', value: name },
    { label: 'Client email', value: email },
    { label: 'Phone', value: phone || 'Not provided' },
    { label: 'Assigned sales agent', value: agentName || 'Not assigned' },
  ]

  return `
    <div style="margin:0;padding:32px 16px;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e6eaf0;border-radius:18px;overflow:hidden;">
        <div style="padding:24px 28px;border-bottom:1px solid #e6eaf0;background:#20254b;color:#ffffff;">
          <div style="font-size:24px;font-weight:800;line-height:1.2;">New Client Registration Request</div>
          <div style="margin-top:8px;font-size:14px;line-height:1.6;color:#d9e1f2;">
            A new client has created a pending account in Invoice CRM.
          </div>
        </div>
        <div style="padding:28px;">
          <table role="presentation" style="width:100%;border-collapse:collapse;">
            ${details
              .map(
                (item, index) => `
                  <tr>
                    <td style="padding:12px 0;font-size:14px;line-height:1.6;font-weight:700;color:#20254b;vertical-align:top;white-space:nowrap;${index > 0 ? 'border-top:1px solid #eef2f7;' : ''}">
                      ${escapeHtml(item.label)}
                    </td>
                    <td style="padding:12px 0 12px 20px;font-size:14px;line-height:1.6;color:#1f2937;text-align:right;vertical-align:top;word-break:break-word;${index > 0 ? 'border-top:1px solid #eef2f7;' : ''}">
                      ${escapeHtml(item.value)}
                    </td>
                  </tr>
                `
              )
              .join('')}
          </table>
          <p style="margin:24px 0 0;font-size:15px;line-height:1.8;color:#1f2937;">
            Review the request in the clients dashboard and approve or reject it as needed.
          </p>
        </div>
      </div>
    </div>
  `
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendApiKey = process.env.RESEND_API_KEY
  const resendFromEmail = process.env.RESEND_FROM_EMAIL
  const contactToEmail = process.env.CONTACT_TO_EMAIL?.trim() || ''
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server auth is not configured' }, { status: 503 })
  }

  if (!resendApiKey || !resendFromEmail || !contactToEmail) {
    return NextResponse.json({ skipped: true }, { status: 200 })
  }

  if (!token) {
    return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 })
  }

  const rateLimit = applyRateLimit({
    key: `client-request-email:${getRateLimitIdentity(request)}`,
    limit: 5,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json({ error: 'Too many notification requests. Please try again shortly.' }, { status: 429 })
  }

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(token)

  if (userError || !user) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const { data: clientRow, error: clientError } = await supabase
    .from('clients')
    .select('id, name, email, phone, handler_id, status, isdeleted')
    .eq('auth_id', user.id)
    .eq('status', 'pending')
    .neq('isdeleted', true)
    .order('created_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (clientError) {
    return NextResponse.json({ error: clientError.message || 'Failed to load registration request' }, { status: 500 })
  }

  if (!clientRow) {
    return NextResponse.json({ error: 'Pending registration request not found' }, { status: 404 })
  }

  const handlerId = String((clientRow as { handler_id?: string | null }).handler_id || '').trim()
  let agentName = ''

  if (handlerId) {
    const { data: agentRow } = await supabase
      .from('employees')
      .select('employee_name, agent_name')
      .eq('auth_id', handlerId)
      .neq('isdeleted', true)
      .maybeSingle()

    const row = agentRow as { employee_name?: string | null; agent_name?: string | null } | null
    agentName = String(row?.agent_name || row?.employee_name || '').trim()
  }

  const resend = new Resend(resendApiKey)
  await resend.emails.send({
    from: resendFromEmail,
    to: contactToEmail,
    subject: `New client registration request: ${String((clientRow as { name?: string | null }).name || 'Client').trim() || 'Client'}`,
    html: buildAdminNotificationEmail({
      name: String((clientRow as { name?: string | null }).name || '').trim() || 'Client',
      email: String((clientRow as { email?: string | null }).email || '').trim() || user.email || 'No email',
      phone: String((clientRow as { phone?: string | null }).phone || '').trim(),
      agentName,
    }),
  })

  return NextResponse.json({ success: true })
}
