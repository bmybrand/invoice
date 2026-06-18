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

function renderBrandLogo(): string {
  const logoUrl =
    process.env.BMYBRAND_EMAIL_LOGO_URL?.trim() ||
    'https://drive.google.com/uc?export=view&id=1V3caFY_GBeXkOO1h67arJiMqISZ5786r'

  return `<img src="${escapeHtml(logoUrl)}" alt="BmyBrand" width="44" height="44" style="display:block; width:44px; height:44px; border-radius:10px; object-fit:contain;" />`
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
  const detailRows = [
    ...(credentials ?? []),
    ...steps.map((step, index) => ({ label: index === 0 ? 'Next step' : `Step ${index + 1}`, value: step })),
  ]

  const renderedDetails = detailRows.length
    ? `
          <tr>
            <td style="padding:8px 32px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate; border-spacing:0; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden;">
                <tr>
                  <td colspan="2" style="padding:16px 20px; background-color:#11122f; color:#ffffff; font-family:Arial,sans-serif; font-size:16px; font-weight:700;">Account Details</td>
                </tr>
                ${detailRows
                  .map(
                    (item) => `
                      <tr>
                        <td style="width:160px; padding:14px 20px; border-top:1px solid #e5e7eb; font-family:Arial,sans-serif; font-size:14px; color:#6b7280; font-weight:700;">${escapeHtml(item.label)}</td>
                        <td style="padding:14px 20px; border-top:1px solid #e5e7eb; font-family:Arial,sans-serif; font-size:15px; color:#11122f;">${escapeHtml(item.value)}</td>
                      </tr>
                    `
                  )
                  .join('')}
              </table>
            </td>
          </tr>
    `
    : ''

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
                      <td width="58%" align="center" style="background-color:#11122F; padding:28px 28px 26px; color:#ffffff; font-family:Arial,sans-serif; vertical-align:middle; text-align:center;">
                        <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse; margin:0 auto;">
                          <tr>
                            <td style="padding-right:12px; vertical-align:middle;">
                              ${renderBrandLogo()}
                            </td>
                            <td style="vertical-align:middle; text-align:left;">
                              <div style="font-size:24px; line-height:1; font-weight:700; color:#ffffff; letter-spacing:0.2px;">BmyBrand</div>
                              <div style="margin-top:6px; font-size:12px; line-height:1; color:#ffffff;">Design. Build. Grow.</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td width="10%" style="background:linear-gradient(60deg, #11122F 0%, #11122F 36%, #f45b25 36%, #ff843e 58%, #11122f 58%, #11122f 74%, #ffffff 74%, #ffffff 100%); font-size:0; line-height:0;">&nbsp;</td>
                      <td width="32%" style="background-color:#ffffff; padding:18px 20px 10px; font-family:Arial,sans-serif; vertical-align:middle;">
                        <div style="font-size:15px; line-height:1.9;">
                          <div style="color:#11122f;">PO BOX 605 Allen, TX 75013</div>
                          <div><a href="mailto:info@bmybrand.com" style="color:#11122f; text-decoration:none;">info@bmybrand.com</a></div>
                          <div style="color:#11122f;">+1 469 501 1401</div>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td colspan="3" style="background-color:#f45b25; padding:9px 24px; text-align:right; font-family:Arial,sans-serif; font-size:14px; color:#ffffff;">
                        <a href="https://bmybrand.com" style="color:#ffffff; text-decoration:none;">bmybrand.com</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 32px 0; font-family:Arial,sans-serif; color:#11122f; font-size:18px; line-height:1.8;">
                  <p style="margin:0 0 22px;">Hi ${escapeHtml(name)},</p>
                  <p style="margin:0 0 22px;"><strong>${escapeHtml(title)}</strong></p>
                  <p style="margin:0 0 22px;">${subtitle === 'You\'re Approved' ? 'Your account is ready and your access details are below.' : escapeHtml(subtitle)}</p>
                  <p style="margin:0 0 22px;">${intro}</p>
                </td>
              </tr>
              ${renderedDetails}
              <tr>
                <td style="padding:0 32px 36px; font-family:Arial,sans-serif; color:#11122f; font-size:18px; line-height:1.8;">
                  <p style="margin:0 0 22px;">${closing}</p>
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
