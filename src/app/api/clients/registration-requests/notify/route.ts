import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { applyRateLimit, getRateLimitIdentity } from '@/lib/rate-limit'
import { isEmailSendingEnabled } from '@/lib/server-app-settings'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderBrandLogo(): string {
  const logoUrl =
    process.env.BMYBRAND_EMAIL_LOGO_URL?.trim() ||
    'http://bmybrand.com/bmyb-services-brand-bmybrand-01-01.svg?dpl=dpl_E3BqAnZ5brZJwUG3yvtPpDntgK2e'

  return `<img src="${escapeHtml(logoUrl)}" alt="BmyBrand" width="170" style="display:block; width:170px; max-height:150px; height:auto; border-radius:12px; object-fit:contain;" />`
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
  const renderedDetails = details
    .map(
      (item) => `
        <tr>
          <td style="width:180px; padding:14px 20px; border-top:1px solid #e5e7eb; font-family:Arial,sans-serif; font-size:14px; color:#6b7280; font-weight:700;">${escapeHtml(item.label)}</td>
          <td style="padding:14px 20px; border-top:1px solid #e5e7eb; font-family:Arial,sans-serif; font-size:15px; color:#11122f;">${escapeHtml(item.value)}</td>
        </tr>
      `
    )
    .join('')

  return `
    <div style="margin:0; padding:0; background-color:#f3f4f6;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; background-color:#f3f4f6;">
        <tr>
          <td align="center" style="padding:32px 16px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; max-width:720px; background-color:#ffffff;">
              <tr>
                <td style="padding:0;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                    <tr>
                      <td width="50%" align="left" style="background-color:#11122F; padding:28px 28px 26px; color:#ffffff; font-family:Arial,sans-serif; vertical-align:middle; text-align:left;">
                        <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse; margin:0;">
                          <tr>
                            <td style="vertical-align:middle;">${renderBrandLogo()}</td>
                          </tr>
                        </table>
                      </td>
                      <td width="50%" align="right" style="background-color:#11122f; padding:18px 28px 10px; font-family:Arial,sans-serif; vertical-align:middle; text-align:right;">
                        <div style="font-size:15px; line-height:1.9; text-align:right;">
                          <div style="color:#ffffff;">PO BOX 605 Allen, TX 75013</div>
                          <div><a href="mailto:info@bmybrand.com" style="color:#ffffff; text-decoration:none;">info@bmybrand.com</a></div>
                          <div style="color:#ffffff;">+1 469 501 1401</div>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td colspan="2" style="background-color:#f45b25; padding:9px 24px; text-align:right; font-family:Arial,sans-serif; font-size:14px; color:#ffffff;">
                        <a href="https://bmybrand.com" style="color:#ffffff; text-decoration:none;">bmybrand.com</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 32px 0; font-family:Arial,sans-serif; color:#11122f; font-size:18px; line-height:1.8;">
                  <p style="margin:0 0 22px;"><strong>New Client Registration Request</strong></p>
                  <p style="margin:0 0 22px;">A new client has created a pending account in Invoice CRM.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 32px 24px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate; border-spacing:0; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden;">
                    <tr>
                      <td colspan="2" style="padding:16px 20px; background-color:#11122f; color:#ffffff; font-family:Arial,sans-serif; font-size:16px; font-weight:700;">Request Details</td>
                    </tr>
                    ${renderedDetails}
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:0 32px 36px; font-family:Arial,sans-serif; color:#11122f; font-size:18px; line-height:1.8;">
                  <p style="margin:0 0 22px;">Review the request in the clients dashboard and approve or reject it as needed.</p>
                  <p style="margin:0 0 18px;">Kind regards,</p>
                  <p style="margin:0;"><strong>BmyBrand Team</strong><br />Design. Build. Grow.</p>
                </td>
              </tr>
              <tr>
                <td style="background-color:#11122F; border-top:6px solid #f45b25; padding:20px 32px; text-align:center; font-family:Arial,sans-serif;">
                  <div style="margin:0 0 10px; font-size:14px; color:#ffffff; font-weight:700;">BmyBrand</div>
                  <div style="font-size:13px; line-height:1.8;">
                    <a href="https://www.instagram.com/bmybrand_official/" style="color:#ffffff; text-decoration:none; margin:0 8px;">Instagram</a>
                    <a href="https://www.linkedin.com/company/bmy-brand/" style="color:#ffffff; text-decoration:none; margin:0 8px;">LinkedIn</a>
                    <a href="https://www.facebook.com/bmybrandofficial/" style="color:#ffffff; text-decoration:none; margin:0 8px;">Facebook</a>
                    <a href="https://www.youtube.com/@BMyBrandofficial" style="color:#ffffff; text-decoration:none; margin:0 8px;">YouTube</a>
                    <a href="mailto:info@bmybrand.com" style="color:#ffffff; text-decoration:none; margin:0 8px;">Reply</a>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
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

  if (!(await isEmailSendingEnabled(supabase))) {
    return NextResponse.json({ success: true, skipped: true, reason: 'email_disabled' })
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
