import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { env } from '@/lib/env'
import { formatInvoiceCode } from '@/lib/invoice-code'
import { getInvoiceLink } from '@/lib/invoice-token'
import { applyRateLimit, getRateLimitIdentity } from '@/lib/rate-limit'
import { requireActiveEmployee } from '@/lib/server-employee-auth'

type InvoiceServiceLine = {
  description?: string | null
  qty?: number | string | null
  price?: number | string | null
}

type InvoiceEmailRow = {
  id?: number | null
  invoice_creator_id?: number | null
  client_name?: string | null
  brand_name?: string | null
  email?: string | null
  service?: unknown
  amount?: number | string | null
  payable_amount?: number | string | null
  status?: string | null
  currency?: string | null
  invoice_type?: string | null
}

function normalizeRole(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, '')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function formatMoney(value: unknown, currency: string): string {
  const amount = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^0-9.-]/g, ''))
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency === 'CAD' ? 'CAD' : 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

function getServiceLines(value: unknown): InvoiceServiceLine[] {
  if (!Array.isArray(value)) return []
  return value.filter((line): line is InvoiceServiceLine => typeof line === 'object' && line !== null)
}

function buildInvoiceCreatedEmail({
  clientName,
  invoiceCode,
  brandName,
  invoiceUrl,
  amount,
  payableAmount,
  currency,
  services,
}: {
  clientName: string
  invoiceCode: string
  brandName: string
  invoiceUrl: string
  amount: unknown
  payableAmount: unknown
  currency: string
  services: InvoiceServiceLine[]
}): string {
  const brandNavy = '#20254b'
  const brandOrange = '#ff6b2c'
  const brandInk = '#1f2937'
  const brandMuted = '#667085'
  const brandLine = '#e6eaf0'
  const brandSurface = '#f8fafc'
  const totalLabel = payableAmount != null && Number(payableAmount) > 0 ? 'Payable now' : 'Invoice total'
  const totalValue = payableAmount != null && Number(payableAmount) > 0 ? payableAmount : amount
  const renderedServices = services.length
    ? `
      <ul style="margin: 0; padding-left: 20px; color: ${brandInk};">
        ${services
          .map((line) => {
            const description = String(line.description || 'Service').trim()
            const qty = line.qty != null ? ` x ${escapeHtml(String(line.qty))}` : ''
            const price = line.price != null ? ` - ${escapeHtml(formatMoney(line.price, currency))}` : ''
            return `<li style="margin: 0 0 10px; font-size: 15px; line-height: 1.6;">${escapeHtml(description)}${qty}${price}</li>`
          })
          .join('')}
      </ul>
    `
    : `<p style="margin: 0; font-size: 15px; line-height: 1.6; color: ${brandInk};">Your invoice details are available from the secure link below.</p>`

  return `
    <div style="margin: 0; padding: 40px 16px; background: #f3f6fb; font-family: Arial, Helvetica, sans-serif;">
      <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid ${brandLine}; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 32px rgba(16, 24, 40, 0.08);">
        <div style="height: 6px; background: linear-gradient(90deg, ${brandOrange} 0%, #ff9a64 100%);"></div>
        <div style="padding: 28px 32px 22px; border-bottom: 1px solid ${brandLine};">
          <div style="font-size: 23px; line-height: 1.1; font-weight: 800; color: ${brandNavy};">BMYBrand</div>
          <div style="margin-top: 4px; font-size: 13px; line-height: 1.4; color: ${brandMuted};">Design. Build. Grow.</div>
        </div>
        <div style="padding: 32px;">
          <p style="margin: 0 0 16px; font-size: 17px; line-height: 1.7; color: ${brandInk};">
            Hi ${escapeHtml(clientName)},
          </p>
          <h1 style="margin: 0 0 12px; font-size: 30px; line-height: 1.2; font-weight: 800; color: ${brandNavy};">
            Your invoice has been created
          </h1>
          <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.8; color: ${brandInk};">
            An invoice has been created under your name. You can view it securely using the button below.
          </p>
          <div style="margin: 0 0 24px; padding: 22px 24px; background: ${brandSurface}; border: 1px solid ${brandLine}; border-radius: 16px;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-size: 14px; font-weight: 700; color: ${brandNavy};">Invoice</td>
                <td style="padding: 8px 0; font-size: 14px; color: ${brandInk}; text-align: right;">#${escapeHtml(invoiceCode)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-size: 14px; font-weight: 700; color: ${brandNavy};">Brand</td>
                <td style="padding: 8px 0; font-size: 14px; color: ${brandInk}; text-align: right;">${escapeHtml(brandName)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-size: 14px; font-weight: 700; color: ${brandNavy};">${escapeHtml(totalLabel)}</td>
                <td style="padding: 8px 0; font-size: 14px; color: ${brandInk}; text-align: right;">${escapeHtml(formatMoney(totalValue, currency))}</td>
              </tr>
            </table>
          </div>
          <div style="margin: 0 0 28px; padding: 22px 24px; border: 1px solid ${brandLine}; border-radius: 16px;">
            <p style="margin: 0 0 14px; font-size: 13px; line-height: 1.4; color: ${brandNavy}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">
              Services
            </p>
            ${renderedServices}
          </div>
          <a href="${escapeHtml(invoiceUrl)}" style="display: inline-block; margin: 0 0 24px; padding: 14px 22px; background: ${brandOrange}; color: #ffffff; text-decoration: none; border-radius: 12px; font-size: 15px; line-height: 1; font-weight: 800;">
            View Invoice
          </a>
          <p style="margin: 0 0 26px; font-size: 14px; line-height: 1.7; color: ${brandMuted}; word-break: break-word;">
            If the button does not work, copy and paste this link into your browser:<br />
            ${escapeHtml(invoiceUrl)}
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

export async function POST(request: NextRequest) {
  try {
    const auth = await requireActiveEmployee(request)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const rateLimit = applyRateLimit({
      key: `invoice-created-email:${auth.user.id}:${getRateLimitIdentity(request)}`,
      limit: 30,
      windowMs: 60_000,
    })
    if (!rateLimit.ok) {
      return NextResponse.json({ error: 'Too many invoice email requests. Please try again shortly.' }, { status: 429 })
    }

    const body = await request.json().catch(() => null)
    const invoiceId = Number((body as { invoiceId?: unknown } | null)?.invoiceId)
    if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
      return NextResponse.json({ error: 'Valid invoice ID is required' }, { status: 400 })
    }

    const [{ data: employee, error: employeeError }, { data: invoice, error: invoiceError }] = await Promise.all([
      auth.supabase
        .from('employees')
        .select('id, role')
        .eq('auth_id', auth.user.id)
        .neq('isdeleted', true)
        .maybeSingle(),
      auth.supabase
        .from('invoices')
        .select('id, invoice_creator_id, client_name, brand_name, email, service, amount, payable_amount, status, currency, invoice_type')
        .eq('id', invoiceId)
        .maybeSingle(),
    ])

    if (employeeError) {
      return NextResponse.json({ error: 'Failed to verify employee access' }, { status: 500 })
    }
    if (invoiceError) {
      return NextResponse.json({ error: invoiceError.message || 'Failed to load invoice' }, { status: 500 })
    }
    if (!employee || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const employeeRow = employee as { id?: number | null; role?: string | null }
    const invoiceRow = invoice as InvoiceEmailRow
    const role = normalizeRole(employeeRow.role)
    const canSend = role === 'admin' || role === 'superadmin' || invoiceRow.invoice_creator_id === employeeRow.id
    if (!canSend) {
      return NextResponse.json({ error: 'You do not have permission to email this invoice' }, { status: 403 })
    }

    const toEmail = String(invoiceRow.email || '').trim()
    if (!isValidEmail(toEmail)) {
      return NextResponse.json({ error: 'Invoice does not have a valid client email address' }, { status: 400 })
    }

    const invoiceUrl = new URL(getInvoiceLink(invoiceId), request.nextUrl.origin).toString()
    const invoiceCode = formatInvoiceCode(invoiceId)
    const clientName = String(invoiceRow.client_name || '').trim() || 'there'
    const resend = new Resend(env.RESEND_API_KEY)

    await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: toEmail,
      subject: `Your invoice #${invoiceCode} has been created`,
      html: buildInvoiceCreatedEmail({
        clientName,
        invoiceCode,
        brandName: String(invoiceRow.brand_name || '').trim() || 'BMYBrand',
        invoiceUrl,
        amount: invoiceRow.amount,
        payableAmount: invoiceRow.payable_amount,
        currency: String(invoiceRow.currency || 'USD').trim().toUpperCase(),
        services: getServiceLines(invoiceRow.service),
      }),
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error || 'Failed to send invoice email')
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
