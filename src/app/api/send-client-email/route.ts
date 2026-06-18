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
  const brandNavy = '#20254b'
  const brandOrange = '#ff6b2c'
  const brandInk = '#1f2937'
  const brandMuted = '#667085'
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
    <div style="margin: 0; padding: 40px 16px; background: #f3f6fb; font-family: Arial, Helvetica, sans-serif;">
      <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid ${brandLine}; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 32px rgba(16, 24, 40, 0.08);">
        <div style="height: 6px; background: linear-gradient(90deg, ${brandOrange} 0%, #ff9a64 100%);"></div>
        <div style="padding: 28px 32px 22px; border-bottom: 1px solid ${brandLine};">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="vertical-align: middle;">
                <table role="presentation" style="border-collapse: collapse;">
                  <tr>
                    <td style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #ff8f3d 0%, ${brandOrange} 100%); color: #ffffff; font-size: 26px; line-height: 44px; font-weight: 800; text-align: center;">
                      B
                    </td>
                    <td style="padding-left: 14px; vertical-align: middle;">
                      <div style="font-size: 23px; line-height: 1.1; font-weight: 800; color: ${brandNavy};">BMYBrand</div>
                      <div style="margin-top: 4px; font-size: 13px; line-height: 1.4; color: ${brandMuted};">Design. Build. Grow.</div>
                    </td>
                  </tr>
                </table>
              </td>
              <td style="vertical-align: top; text-align: right;">
                <span style="display: inline-block; padding: 8px 12px; background: ${brandSurface}; border: 1px solid ${brandLine}; border-radius: 999px; font-size: 11px; line-height: 1; font-weight: 700; color: ${brandOrange}; text-transform: uppercase; letter-spacing: 0.1em;">
                  ${escapeHtml(subtitle)}
                </span>
              </td>
            </tr>
          </table>
        </div>
        <div style="padding: 32px 32px 8px;">
          <div style="margin: 0 0 12px; font-size: 32px; line-height: 1.18; font-weight: 800; color: ${brandNavy}; letter-spacing: -0.02em;">
            ${escapeHtml(title)}
          </div>
          <div style="margin: 0 0 28px; font-size: 16px; line-height: 1.75; color: ${brandMuted};">
            ${subtitle === 'You\'re Approved' ? 'Your account is ready and your access details are below.' : escapeHtml(subtitle)}
          </div>
        </div>
        <div style="padding: 0 32px 34px;">
          <p style="margin: 0 0 16px; font-size: 17px; line-height: 1.7; color: ${brandInk};">
            Hi ${escapeHtml(name)},
          </p>
          <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.8; color: ${brandInk};">
            ${intro}
          </p>
          ${renderedCredentials}
          ${renderedSteps}
          <p style="margin: 0 0 28px; font-size: 16px; line-height: 1.8; color: ${brandInk};">
            ${closing}
          </p>
          <p style="margin: 0; font-size: 16px; line-height: 1.8; color: ${brandInk};">
            Regards,<br />
            <strong style="color: ${brandNavy};">The BMYBrand Team</strong>
          </p>
        </div>
      </div>
    </div>
  `
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

    const safeName = String(name).trim()
    const safeStatus = String(status).trim()
    const safePassword = password ? String(password) : ''

    let subject = 'Welcome to Invoice CRM'
    let html = ''
    if (status === 'approved' || status === 'accepted') {
      const steps = ['Use your approved email address to sign in to Invoice CRM.']
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
      subject = 'Your Invoice CRM Registration Status'
      html = buildEmailTemplate({
        name: safeName,
        title: 'Registration Status Update',
        subtitle: 'Application Reviewed',
        intro:
          'We reviewed your registration request and are unable to approve access at this time.',
        steps: [
          'Review your submitted details and confirm they are complete and accurate.',
          'Contact the Invoice CRM team if you want clarification or would like to re-apply.',
        ],
        closing: 'If you believe this decision was made in error, reply to this email and include any relevant details for review.',
      })
    } else {
      html = buildEmailTemplate({
        name: safeName,
        title: 'Account Status Update',
        subtitle: 'Status Update',
        intro: `Your Invoice CRM registration status is currently: <strong>${escapeHtml(safeStatus)}</strong>.`,
        steps: ['Keep this email for your records.', 'Contact the Invoice CRM team if you need help with your account.'],
        closing: 'We will keep you updated if anything changes.',
      })
    }

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
