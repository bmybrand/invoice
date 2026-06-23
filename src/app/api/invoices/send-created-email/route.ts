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
  brand_id?: number | string | null
}

function normalizeRole(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, '')
}

function normalizeBrandName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isBmyBrand(value: string): boolean {
  const normalized = normalizeBrandName(value)
  return normalized === 'bmybrand' || normalized === 'bmy'
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeDriveImageUrl(value: string): string {
  const trimmed = value.trim()
  const fileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([^/]+)/)
  if (fileMatch?.[1]) {
    return `https://drive.google.com/uc?export=view&id=${fileMatch[1]}`
  }
  return trimmed
}

function normalizeWebsiteUrl(value: string | null | undefined): string {
  const trimmed = (value || '').trim()
  if (!trimmed) return 'https://bmybrand.com'
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function getWebsiteLabel(value: string): string {
  try {
    const url = new URL(value)
    return url.hostname.replace(/^www\./i, '')
  } catch {
    return value.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
  }
}

function renderBrandLogo(logoUrlValue?: string | null, altText = 'BmyBrand'): string {
  const fallbackLogoUrl =
    process.env.BMYBRAND_EMAIL_LOGO_URL?.trim() ||
    'http://bmybrand.com/bmyb-services-brand-bmybrand-01-01.svg?dpl=dpl_E3BqAnZ5brZJwUG3yvtPpDntgK2e'
  const logoUrl = logoUrlValue?.trim() ? normalizeDriveImageUrl(logoUrlValue) : fallbackLogoUrl

  return `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(altText)}" width="170" style="display:block; width:170px; max-height:150px; height:auto; border-radius:12px; object-fit:contain;" />`
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function formatMoney(value: unknown, currency: string): string {
  const amount = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^0-9.-]/g, ''))
  const safeAmount = Number.isFinite(amount) ? amount : 0
  const currencyCode = currency === 'CAD' ? 'CAD' : 'USD'
  const formattedAmount = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(safeAmount)

  return `$${formattedAmount} ${currencyCode}`
}

function getServiceLines(value: unknown): InvoiceServiceLine[] {
  if (!Array.isArray(value)) return []
  return value.filter((line): line is InvoiceServiceLine => typeof line === 'object' && line !== null)
}

function buildInvoiceCreatedEmail({
  clientName,
  brandName,
  invoiceUrl,
  amount,
  payableAmount,
  currency,
  services,
  brandLogoUrl,
  brandWebsiteUrl,
}: {
  clientName: string
  brandName: string
  invoiceUrl: string
  amount: unknown
  payableAmount: unknown
  currency: string
  services: InvoiceServiceLine[]
  brandLogoUrl?: string | null
  brandWebsiteUrl?: string | null
}): string {
  const useBmyBranding = isBmyBrand(brandName)
  const colors = useBmyBranding
    ? {
        header: '#11122F',
        accent: '#f45b25',
        accentSoft: '#ff843e',
        dividerEnd: '#11122f',
        heading: '#11122f',
        muted: '#6b7280',
        linkBar: '#f45b25',
        button: '#f45b25',
        footer: '#11122F',
      }
    : {
        header: '#111111',
        accent: '#6b7280',
        accentSoft: '#9ca3af',
        dividerEnd: '#111111',
        heading: '#111111',
        muted: '#6b7280',
        linkBar: '#4b5563',
        button: '#111111',
        footer: '#111111',
      }
  const websiteUrl = normalizeWebsiteUrl(useBmyBranding ? 'https://bmybrand.com' : brandWebsiteUrl)
  const websiteLabel = getWebsiteLabel(websiteUrl)
  const footerLinks = useBmyBranding
    ? `
                    <a href="https://www.instagram.com/bmybrand_official/" style="color:#ffffff; text-decoration:none; margin:0 8px;">Instagram</a>
                    <a href="https://www.linkedin.com/company/bmy-brand/" style="color:#ffffff; text-decoration:none; margin:0 8px;">LinkedIn</a>
                    <a href="https://www.facebook.com/bmybrandofficial/" style="color:#ffffff; text-decoration:none; margin:0 8px;">Facebook</a>
                    <a href="https://www.youtube.com/@BMyBrandofficial" style="color:#ffffff; text-decoration:none; margin:0 8px;">YouTube</a>
                    <a href="mailto:billing@bmybrand.com" style="color:#ffffff; text-decoration:none; margin:0 8px;">Reply</a>
    `
    : `
                    <a href="${escapeHtml(websiteUrl)}" style="color:#ffffff; text-decoration:none; margin:0 8px;">${escapeHtml(websiteLabel)}</a>
    `
  const totalLabel = payableAmount != null && Number(payableAmount) > 0 ? 'Payable now' : 'Invoice total'
  const totalValue = payableAmount != null && Number(payableAmount) > 0 ? payableAmount : amount
  const renderedServices = services.length
    ? `
      <ul style="margin:0; padding-left:20px; color:${colors.heading};">
        ${services
          .map((line) => {
            const description = String(line.description || 'Service').trim()
            const price = line.price != null ? ` - ${escapeHtml(formatMoney(line.price, currency))}` : ''
            return `<li style="margin:0 0 10px; font-size:15px; line-height:1.6;">${escapeHtml(description)}${price}</li>`
          })
          .join('')}
      </ul>
    `
    : `<p style="margin:0; font-size:15px; line-height:1.6; color:${colors.heading};">Your invoice details are available from the secure link below.</p>`
  const headerContact = useBmyBranding
    ? `
                      <td width="50%" align="right" style="background-color:${colors.header}; padding:18px 28px 10px; font-family:Arial,sans-serif; vertical-align:middle; text-align:right;">
                        <div style="font-size:15px; line-height:1.9; text-align:right;">
                          <div><a href="mailto:billing@bmybrand.com" style="color:#ffffff; text-decoration:none;">billing@bmybrand.com</a></div>
                          <div style="color:#ffffff;">+1 469 501 1401</div>
                        </div>
                      </td>`
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
                      <td width="${useBmyBranding ? '50%' : '100%'}" align="left" style="background-color:${colors.header}; padding:28px 28px 26px; color:#ffffff; font-family:Arial,sans-serif; vertical-align:middle; text-align:left;">
                        <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse; margin:0;">
                          <tr>
                            <td style="vertical-align:middle;">
                              ${renderBrandLogo(brandLogoUrl, brandName)}
                            </td>
                          </tr>
                        </table>
                      </td>
${headerContact}
                    </tr>
                    <tr>
                      <td colspan="2" style="background-color:${colors.linkBar}; padding:9px 24px; text-align:right; font-family:Arial,sans-serif; font-size:14px; color:#ffffff;">
                        <a href="${escapeHtml(websiteUrl)}" style="color:#ffffff; text-decoration:none;">${escapeHtml(websiteLabel)}</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 32px 0; font-family:Arial,sans-serif; color:${colors.heading}; font-size:18px; line-height:1.8;">
                  <p style="margin:0 0 22px;">Hi ${escapeHtml(clientName)},</p>
                  <p style="margin:0 0 22px;"><strong>Your invoice has been created</strong></p>
                  <p style="margin:0 0 22px;">An invoice has been created under your name. You can view it securely using the button below.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 32px 24px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate; border-spacing:0; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden;">
                    <tr>
                      <td colspan="2" style="padding:16px 20px; background-color:${colors.heading}; color:#ffffff; font-family:Arial,sans-serif; font-size:16px; font-weight:700;">Invoice Details</td>
                    </tr>
                    <tr>
                      <td style="width:160px; padding:14px 20px; border-top:1px solid #e5e7eb; font-family:Arial,sans-serif; font-size:14px; color:${colors.muted}; font-weight:700;">Brand</td>
                      <td style="padding:14px 20px; border-top:1px solid #e5e7eb; font-family:Arial,sans-serif; font-size:15px; color:${colors.heading};">${escapeHtml(brandName)}</td>
                    </tr>
                    <tr>
                      <td style="width:160px; padding:14px 20px; border-top:1px solid #e5e7eb; font-family:Arial,sans-serif; font-size:14px; color:${colors.muted}; font-weight:700;">${escapeHtml(totalLabel)}</td>
                      <td style="padding:14px 20px; border-top:1px solid #e5e7eb; font-family:Arial,sans-serif; font-size:15px; color:${colors.heading};">${escapeHtml(formatMoney(totalValue, currency))}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:0 32px 24px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate; border-spacing:0; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden;">
                    <tr>
                      <td style="padding:16px 20px; background-color:${colors.heading}; color:#ffffff; font-family:Arial,sans-serif; font-size:16px; font-weight:700;">Services</td>
                    </tr>
                    <tr>
                      <td style="padding:18px 20px; font-family:Arial,sans-serif;">${renderedServices}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:0 32px 36px; font-family:Arial,sans-serif; color:${colors.heading}; font-size:18px; line-height:1.8;">
                  <p style="margin:0 0 24px;">
                    <a href="${escapeHtml(invoiceUrl)}" style="display:inline-block; padding:13px 22px; background-color:${colors.button}; color:#ffffff; text-decoration:none; border-radius:8px; font-size:15px; line-height:1; font-weight:700;">View Invoice</a>
                  </p>
                  <p style="margin:0 0 22px; font-size:14px; line-height:1.7; color:#4b5563; word-break:break-word;">
                    If the button does not work, copy and paste this link into your browser:<br />
                    ${escapeHtml(invoiceUrl)}
                  </p>
                  <p style="margin:0 0 18px;">Kind regards,</p>
                  <p style="margin:0;"><strong>${escapeHtml(useBmyBranding ? 'BmyBrand Team' : brandName)}</strong>${useBmyBranding ? '<br />Design. Build. Grow.' : ''}</p>
                </td>
              </tr>
              <tr>
                <td style="background-color:${colors.footer}; border-top:6px solid ${colors.accent}; padding:20px 32px; text-align:center; font-family:Arial,sans-serif;">
                  <div style="margin:0 0 10px; font-size:14px; color:#ffffff; font-weight:700;">${escapeHtml(useBmyBranding ? 'BmyBrand' : brandName)}</div>
                  <div style="font-size:13px; line-height:1.8;">
${footerLinks}
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
        .select('id, invoice_creator_id, client_name, brand_id, brand_name, email, service, amount, payable_amount, status, currency, invoice_type')
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
    const brandName = String(invoiceRow.brand_name || '').trim() || 'BMYBrand'
    if (!isBmyBrand(brandName)) {
      return NextResponse.json({ success: true, skipped: true })
    }
    const brandId = invoiceRow.brand_id == null ? null : Number(invoiceRow.brand_id)
    let brandLogoUrl: string | null = null
    let brandWebsiteUrl: string | null = null

    if (Number.isFinite(brandId) && brandId && brandId > 0) {
      const { data: brand } = await auth.supabase
        .from('brands')
        .select('logo_url, brand_url')
        .eq('id', brandId)
        .maybeSingle()

      brandLogoUrl = typeof (brand as { logo_url?: unknown } | null)?.logo_url === 'string'
        ? String((brand as { logo_url?: string }).logo_url || '').trim() || null
        : null
      brandWebsiteUrl = typeof (brand as { brand_url?: unknown } | null)?.brand_url === 'string'
        ? String((brand as { brand_url?: string }).brand_url || '').trim() || null
        : null
    }

    if ((!brandLogoUrl || !brandWebsiteUrl) && brandName) {
      const { data: brand } = await auth.supabase
        .from('brands')
        .select('logo_url, brand_url')
        .eq('brand_name', brandName)
        .neq('isdeleted', true)
        .maybeSingle()

      if (!brandLogoUrl) {
        brandLogoUrl = typeof (brand as { logo_url?: unknown } | null)?.logo_url === 'string'
          ? String((brand as { logo_url?: string }).logo_url || '').trim() || null
          : null
      }
      if (!brandWebsiteUrl) {
        brandWebsiteUrl = typeof (brand as { brand_url?: unknown } | null)?.brand_url === 'string'
          ? String((brand as { brand_url?: string }).brand_url || '').trim() || null
          : null
      }
    }

    const resend = new Resend(env.RESEND_API_KEY)

    await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: toEmail,
      subject: `Your invoice #${invoiceCode} has been created`,
      html: buildInvoiceCreatedEmail({
        clientName,
        brandName,
        invoiceUrl,
        amount: invoiceRow.amount,
        payableAmount: invoiceRow.payable_amount,
        currency: String(invoiceRow.currency || 'USD').trim().toUpperCase(),
        services: getServiceLines(invoiceRow.service),
        brandLogoUrl,
        brandWebsiteUrl,
      }),
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error || 'Failed to send invoice email')
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
