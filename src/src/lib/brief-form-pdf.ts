import type { BriefFormSubmissionRow } from '@/lib/cpanel-brief-forms-bridge'
import { getBriefFormLabel } from '@/lib/brief-form-labels'
import type { jsPDF } from 'jspdf'

type PayloadValue = string | string[]

const BRAND = {
  slate900: [15, 23, 42] as const,
  slate800: [30, 41, 59] as const,
  slate600: [71, 85, 105] as const,
  slate500: [100, 116, 139] as const,
  slate200: [226, 232, 240] as const,
  slate100: [241, 245, 249] as const,
  slate50: [248, 250, 252] as const,
  orange500: [249, 115, 22] as const,
  white: [255, 255, 255] as const,
}

const LOGO_PATH = '/bmybrand-B.svg'
const HEADER_HEIGHT_MM = 22
const FOOTER_HEIGHT_MM = 10

const CLIENT_INFO_KEY_EXACT = new Set([
  'client_name',
  'contact_person',
  'your_full_name',
  'full_name',
  'designation',
  'email',
  'email_address',
  'phone',
  'phone_number',
  'mobile',
  'mobile_number',
])

function normalizePayloadKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, '_')
}

/** Fields that identify the client (excluded from PDF export). */
export function isClientInfoPayloadKey(key: string): boolean {
  const normalized = normalizePayloadKey(key)

  if (CLIENT_INFO_KEY_EXACT.has(normalized)) {
    return true
  }

  if (normalized.includes('email') || normalized.includes('phone') || normalized.includes('mobile')) {
    return true
  }

  if (
    normalized.includes('client_name') ||
    normalized.includes('contact_person') ||
    normalized.includes('full_name') ||
    normalized.includes('primary_contact') ||
    normalized.includes('business_email') ||
    normalized.includes('business_address')
  ) {
    return true
  }

  return false
}

export function getBriefFormPdfEntries(
  payload: Record<string, PayloadValue>
): Array<{ key: string; label: string; value: string }> {
  return Object.entries(payload)
    .filter(([key]) => !isClientInfoPayloadKey(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      key,
      label: key.replace(/_/g, ' '),
      value: formatPayloadValueForPdf(value),
    }))
    .filter((entry) => entry.value !== '—')
}

function formatPayloadValueForPdf(value: PayloadValue): string {
  if (Array.isArray(value)) {
    const joined = value.filter(Boolean).join(', ')
    return joined.trim() || '—'
  }
  return value.trim() || '—'
}

function formatSubmittedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

async function loadBrandLogoDataUrl(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null
  }

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const width = img.naturalWidth || 120
        const height = img.naturalHeight || 120
        const maxSide = 200
        const scale = Math.min(1, maxSide / Math.max(width, height))
        canvas.width = Math.max(1, Math.round(width * scale))
        canvas.height = Math.max(1, Math.round(height * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = `${window.location.origin}${LOGO_PATH}`
  })
}

type PdfLayout = {
  pdf: jsPDF
  pageWidth: number
  pageHeight: number
  marginX: number
  contentTop: number
  contentBottom: number
  contentWidth: number
  logoDataUrl: string | null
  formLabel: string
}

function drawPageHeader(layout: PdfLayout) {
  const { pdf, pageWidth, marginX, logoDataUrl, formLabel } = layout

  pdf.setFillColor(...BRAND.slate900)
  pdf.rect(0, 0, pageWidth, HEADER_HEIGHT_MM, 'F')

  const logoSize = 11
  const logoY = (HEADER_HEIGHT_MM - logoSize) / 2

  if (logoDataUrl) {
    pdf.addImage(logoDataUrl, 'PNG', marginX, logoY, logoSize, logoSize)
  }

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(...BRAND.white)
  pdf.text('BMYBrand', marginX + (logoDataUrl ? logoSize + 4 : 0), HEADER_HEIGHT_MM / 2 + 1.5)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(...BRAND.orange500)
  pdf.text(formLabel, pageWidth - marginX, HEADER_HEIGHT_MM / 2 + 1.5, { align: 'right' })

  pdf.setFillColor(...BRAND.orange500)
  pdf.rect(0, HEADER_HEIGHT_MM - 0.8, pageWidth, 0.8, 'F')
}

function drawPageFooter(layout: PdfLayout, pageNumber: number, totalPages: number) {
  const { pdf, pageWidth, pageHeight, marginX } = layout
  const footerY = pageHeight - FOOTER_HEIGHT_MM + 4

  pdf.setDrawColor(...BRAND.slate200)
  pdf.setLineWidth(0.2)
  pdf.line(marginX, footerY - 2, pageWidth - marginX, footerY - 2)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(...BRAND.slate500)
  pdf.text('BMYBrand — Brief form intake (client contact details omitted)', marginX, footerY + 2)
  pdf.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - marginX, footerY + 2, { align: 'right' })
}

function addPage(layout: PdfLayout) {
  layout.pdf.addPage()
  drawPageHeader(layout)
}

function ensureSpace(layout: PdfLayout, needed: number, y: number): number {
  if (y + needed <= layout.contentBottom) {
    return y
  }
  addPage(layout)
  return layout.contentTop
}

function drawMetaCard(
  layout: PdfLayout,
  y: number,
  row: BriefFormSubmissionRow
): number {
  const { pdf, marginX, contentWidth } = layout
  const cardHeight = 22
  y = ensureSpace(layout, cardHeight + 4, y)

  pdf.setFillColor(...BRAND.slate50)
  pdf.setDrawColor(...BRAND.slate200)
  pdf.setLineWidth(0.3)
  pdf.roundedRect(marginX, y, contentWidth, cardHeight, 2, 2, 'FD')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.setTextColor(...BRAND.slate800)
  pdf.text(getBriefFormLabel(row.formType), marginX + 4, y + 8)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(...BRAND.slate600)
  pdf.text(`Submission #${row.id}`, marginX + 4, y + 14)
  pdf.text(`Submitted: ${formatSubmittedAt(row.createdAt)}`, marginX + 4, y + 19)
  pdf.text(`Source: ${(row.source || 'public').replace(/^\w/, (c) => c.toUpperCase())}`, marginX + contentWidth / 2, y + 19)

  return y + cardHeight + 6
}

function drawResponsesSection(
  layout: PdfLayout,
  y: number,
  entries: Array<{ label: string; value: string }>
): number {
  const { pdf, marginX, contentWidth } = layout
  const lineHeight = 4.8

  y = ensureSpace(layout, 12, y)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(...BRAND.orange500)
  pdf.text('RESPONSES', marginX, y)
  y += 3

  pdf.setFillColor(...BRAND.orange500)
  pdf.rect(marginX, y, 18, 0.8, 'F')
  y += 5

  if (entries.length === 0) {
    y = ensureSpace(layout, 8, y)
    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(9)
    pdf.setTextColor(...BRAND.slate500)
    pdf.text('No project fields recorded (client contact details are excluded).', marginX, y)
    return y + 6
  }

  for (const entry of entries) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    const labelLines = pdf.splitTextToSize(entry.label.toUpperCase(), contentWidth - 8)
    const labelHeight = labelLines.length * 3.6 + 2

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    const valueLines = pdf.splitTextToSize(entry.value, contentWidth - 8)
    const valueHeight = valueLines.length * lineHeight
    const blockHeight = labelHeight + valueHeight + 8

    y = ensureSpace(layout, blockHeight, y)

    pdf.setFillColor(...BRAND.white)
    pdf.setDrawColor(...BRAND.slate200)
    pdf.setLineWidth(0.25)
    pdf.roundedRect(marginX, y, contentWidth, blockHeight, 1.5, 1.5, 'FD')

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(...BRAND.slate500)
    pdf.text(labelLines, marginX + 4, y + 5)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(...BRAND.slate800)
    pdf.text(valueLines, marginX + 4, y + 5 + labelHeight)

    y += blockHeight + 3
  }

  return y
}

export async function downloadBriefFormSubmissionPdf(row: BriefFormSubmissionRow): Promise<void> {
  const [{ jsPDF }] = await Promise.all([import('jspdf')])
  const logoDataUrl = await loadBrandLogoDataUrl()
  const formLabel = getBriefFormLabel(row.formType)

  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const marginX = 14

  const layout: PdfLayout = {
    pdf,
    pageWidth,
    pageHeight,
    marginX,
    contentTop: HEADER_HEIGHT_MM + 8,
    contentBottom: pageHeight - FOOTER_HEIGHT_MM - 4,
    contentWidth: pageWidth - marginX * 2,
    logoDataUrl,
    formLabel,
  }

  pdf.setFillColor(...BRAND.slate100)
  pdf.rect(0, HEADER_HEIGHT_MM, pageWidth, pageHeight - HEADER_HEIGHT_MM, 'F')

  drawPageHeader(layout)

  let y = layout.contentTop
  y = drawMetaCard(layout, y, row)

  const entries = getBriefFormPdfEntries(row.payload || {})
  drawResponsesSection(layout, y, entries)

  const totalPages = pdf.getNumberOfPages()
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page)
    drawPageFooter(layout, page, totalPages)
  }

  const filename = ['brief-form', sanitizeFilenamePart(row.formType), String(row.id)]
    .filter(Boolean)
    .join('-')
    .concat('.pdf')

  pdf.save(filename)
}
