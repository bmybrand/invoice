import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { applyRateLimit, getRateLimitIdentity } from '@/lib/rate-limit'
import { requireAdminOrSuperAdmin } from '@/lib/server-admin-auth'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildEmailTemplate({
  name,
  title,
  subtitle,
  intro,
  steps,
  closing,
  credentials,
}: {
  name: string
  title: string
  subtitle: string
  intro: string
  steps: string[]
  closing: string
  credentials?: Array<{ label: string; value: string }>
}): string {
  const brandNavy = '#11122f'
  const brandInk = '#1f2937'
  const brandSurface = '#f8fafc'
  const brandLine = '#e6eaf0'
  const brandSoft = '#fdf2ea'

  const renderedSteps = steps.length
    ? `
      <div style="margin: 0 0 24px; padding: 22px 24px; background: ${brandSurface}; border: 1px solid ${brandLine}; border-radius: 16px;">
        <p style="margin: 0 0 14px; font-size: 13px; line-height: 1.4; color: ${brandNavy}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">
          Next Steps
        </p>
        <ul style="margin: 0; padding-left: 20px; color: ${brandInk};">
        ${steps
          .map(
            (step) =>
              `<li style="margin: 0 0 12px; font-size: 15px; line-height: 1.7;">${escapeHtml(step)}</li>`
          )
          .join('')}
        </ul>
      </div>
    `
    : ''

  const renderedCredentials = credentials?.length
    ? `
      <div style="margin: 0 0 24px; padding: 22px 24px; background: ${brandSoft}; border: 1px solid #f3d7c8; border-radius: 16px;">
        <p style="margin: 0 0 14px; font-size: 13px; line-height: 1.4; color: ${brandNavy}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">
          Account Details
        </p>
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          ${credentials
            .map(
              (item, index) => `
                <tr>
                  <td style="padding: 12px 0; font-size: 14px; line-height: 1.6; font-weight: 700; color: ${brandNavy}; vertical-align: top; white-space: nowrap; ${index > 0 ? 'border-top: 1px solid #f1dfd4;' : ''}">
                    ${escapeHtml(item.label)}
                  </td>
                  <td style="padding: 12px 0 12px 24px; font-size: 14px; line-height: 1.6; color: ${brandInk}; text-align: right; vertical-align: top; word-break: break-word; ${index > 0 ? 'border-top: 1px solid #f1dfd4;' : ''}">
                    ${escapeHtml(item.value)}
                  </td>
                </tr>
              `
            )
            .join('')}
        </table>
      </div>
    `
    : ''

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background-color:#f3f4f6">
      <tbody>
        <tr>
          <td align="center" style="padding:32px 16px">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:720px;background-color:#ffffff">
              <tbody>
                <tr>
                  <td style="padding:0">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
                      <tbody>
                        <tr>
                          <td width="58%" style="background-color:#231f20;padding:28px 28px 26px;color:#ffffff;font-family:Arial,sans-serif;vertical-align:top">
                            <div style="font-size:15px;line-height:1.9">
                              <div>PO BOX 605 Allen, TX 75013</div>
                              <div><a href="mailto:info@bmybrand.com" style="color:#ffffff;text-decoration:none" target="_blank">info@bmybrand.com</a></div>
                              <div>+1 469 501 1401</div>
                            </div>
                          </td>
                          <td width="10%" style="background:linear-gradient(60deg,#231f20 0%,#231f20 36%,#f45b25 36%,#ff843e 58%,#11122f 58%,#11122f 74%,#ffffff 74%,#ffffff 100%);font-size:0;line-height:0">&nbsp;</td>
                          <td width="32%" align="center" style="background-color:#ffffff;padding:18px 20px 10px;font-family:Arial,sans-serif;vertical-align:middle;text-align:center">
                            <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 auto">
                              <tbody>
                                <tr>
                                  <td style="padding-right:12px;vertical-align:middle">
                                    <div style="width:44px;height:44px;background:linear-gradient(135deg,#f45b25 0%,#ff843e 100%);border-radius:10px;color:#ffffff;font-size:28px;line-height:44px;font-weight:700;text-align:center">B</div>
                                  </td>
                                  <td style="vertical-align:middle;text-align:left">
                                    <div style="font-size:24px;line-height:1;font-weight:700;color:#11122f;letter-spacing:0.2px">BmyBrand</div>
                                    <div style="margin-top:6px;font-size:12px;line-height:1;color:#6b7280">Design. Build. Grow.</div>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td colspan="3" style="background:linear-gradient(90deg,#11122f 0%,#1a1d4a 40%,#f45b25 100%);padding:9px 24px;text-align:right;font-family:Arial,sans-serif;font-size:14px;color:#ffffff">
                            <a href="https://bmybrand.com" style="color:#ffffff;text-decoration:none" target="_blank">bmybrand.com</a>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 32px 0;font-family:Arial,sans-serif;color:#11122f;font-size:18px;line-height:1.8">
                    <p style="margin:0 0 22px">Hi ${escapeHtml(name)},</p>
                    <p style="margin:0 0 14px;font-size:28px;line-height:1.25;font-weight:700;color:#11122f">${escapeHtml(title)}</p>
                    <p style="margin:0 0 22px">${subtitle === 'You\'re Approved' ? 'Your account is ready and your access details are below.' : escapeHtml(subtitle)}</p>
                    <p style="margin:0 0 22px">${intro}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 32px;font-family:Arial,sans-serif;color:#11122f;font-size:16px;line-height:1.8">
                    ${renderedCredentials}
                    ${renderedSteps}
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 32px 36px;font-family:Arial,sans-serif;color:#11122f;font-size:18px;line-height:1.8">
                    <p style="margin:0 0 22px">${closing}</p>
                    <p style="margin:0 0 18px">Kind regards,</p>
                    <p style="margin:0"><strong>BmyBrand Team</strong><br>Design. Build. Grow.</p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color:#111111;border-top:6px solid #f45b25;padding:20px 32px;text-align:center;font-family:Arial,sans-serif">
                    <div style="margin:0 0 10px;font-size:14px;color:#ffffff;font-weight:700">BmyBrand</div>
                    <div style="font-size:13px;line-height:1.8">
                      <a href="https://www.instagram.com/" style="color:#ffffff;text-decoration:none;margin:0 8px" target="_blank">Instagram</a>
                      <a href="https://www.linkedin.com/" style="color:#ffffff;text-decoration:none;margin:0 8px" target="_blank">LinkedIn</a>
                      <a href="https://www.youtube.com/" style="color:#ffffff;text-decoration:none;margin:0 8px" target="_blank">YouTube</a>
                      <a href="mailto:info@bmybrand.com" style="color:#ffffff;text-decoration:none;margin:0 8px" target="_blank">Contact</a>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  `
}

export async function POST(req: NextRequest) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY?.trim()
    const resendFromEmail = process.env.RESEND_FROM_EMAIL?.trim() || 'noreply@resend.dev'

    if (!resendApiKey) {
      return NextResponse.json({ error: 'Missing RESEND_API_KEY' }, { status: 503 })
    }

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

    const safeName = String(name).trim()
    const safeStatus = String(status).trim()
    const safePassword = password ? String(password) : ''

    let subject = 'Welcome to BMYBrand'
    let html = ''
    if (status === 'approved' || status === 'accepted') {
      const steps = ['Use your approved email address to sign in to your BMYBrand client dashboard.']
      if (safePassword) steps.push(`Use this temporary password for your first login: ${safePassword}`)
      steps.push('After signing in, update your password if you want a personal one.')

      html = buildEmailTemplate({
        name: safeName,
        title: 'Your Account Has Been Approved',
        subtitle: "You're Approved",
        intro:
          'We are pleased to let you know that your BMYBrand client account has been approved and is now ready to use.',
        steps,
        credentials: [
          { label: 'Email', value: String(email).trim() },
          ...(safePassword ? [{ label: 'Temporary password', value: safePassword }] : []),
        ],
        closing: 'If you have any trouble signing in, reply to this email and we will help you get back in quickly.',
      })
    } else if (status === 'rejected') {
      subject = 'Your BMYBrand Registration Status'
      html = buildEmailTemplate({
        name: safeName,
        title: 'Registration Status Update',
        subtitle: 'Application Reviewed',
        intro:
          'We reviewed your registration request and are unable to approve access at this time.',
        steps: [
          'Review your submitted details and confirm they are complete and accurate.',
          'Contact the BMYBrand team if you want clarification or would like to re-apply.',
        ],
        closing: 'If you believe this decision was made in error, reply to this email and include any relevant details for review.',
      })
    } else {
      html = buildEmailTemplate({
        name: safeName,
        title: 'Account Status Update',
        subtitle: 'Status Update',
        intro: `Your BMYBrand registration status is currently: <strong>${escapeHtml(safeStatus)}</strong>.`,
        steps: ['Keep this email for your records.', 'Contact the BMYBrand team if you need help with your account.'],
        closing: 'We will keep you updated if anything changes.',
      })
    }

    const resend = new Resend(resendApiKey)
    await resend.emails.send({
      from: resendFromEmail,
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
