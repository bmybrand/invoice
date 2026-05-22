import type { BriefFormSubmissionRow } from '@/lib/cpanel-brief-forms-bridge'
import { getBriefFormLabel } from '@/lib/brief-form-labels'

type PayloadValue = string | string[]

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

export async function downloadBriefFormSubmissionPdf(row: BriefFormSubmissionRow): Promise<void> {
  const { jsPDF } = await import('jspdf')

  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const marginX = 14
  const marginTop = 16
  const marginBottom = 16
  const contentWidth = pageWidth - marginX * 2
  const lineHeight = 5
  let y = marginTop

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageHeight - marginBottom) {
      return
    }
    pdf.addPage()
    y = marginTop
  }

  const drawHeader = () => {
    pdf.setFillColor(15, 23, 42)
    pdf.rect(0, 0, pageWidth, 12, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.setTextColor(255, 255, 255)
    pdf.text('BMYBrand', marginX, 8)
    pdf.setTextColor(249, 115, 22)
    pdf.text('Brief Form', pageWidth - marginX, 8, { align: 'right' })
    y = 20
  }

  drawHeader()

  pdf.setTextColor(30, 41, 59)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  ensureSpace(12)
  pdf.text(getBriefFormLabel(row.formType), marginX, y)
  y += 8

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(71, 85, 105)
  ensureSpace(8)
  pdf.text(`Submission #${row.id}`, marginX, y)
  y += lineHeight
  pdf.text(`Submitted: ${formatSubmittedAt(row.createdAt)}`, marginX, y)
  y += lineHeight + 4

  pdf.setDrawColor(226, 232, 240)
  pdf.line(marginX, y, pageWidth - marginX, y)
  y += 8

  const entries = getBriefFormPdfEntries(row.payload || {})

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(51, 65, 85)
  ensureSpace(8)
  pdf.text('Responses', marginX, y)
  y += 7

  if (entries.length === 0) {
    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(10)
    pdf.setTextColor(100, 116, 139)
    ensureSpace(6)
    pdf.text('No non-client fields recorded for this submission.', marginX, y)
  } else {
    for (const entry of entries) {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.setTextColor(100, 116, 139)
      const labelLines = pdf.splitTextToSize(entry.label.toUpperCase(), contentWidth)
      const labelHeight = labelLines.length * 4 + 2

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.setTextColor(30, 41, 59)
      const valueLines = pdf.splitTextToSize(entry.value, contentWidth)
      const valueHeight = valueLines.length * lineHeight
      const blockHeight = labelHeight + valueHeight + 6

      ensureSpace(blockHeight)

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.setTextColor(100, 116, 139)
      pdf.text(labelLines, marginX, y)
      y += labelHeight

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.setTextColor(30, 41, 59)
      pdf.text(valueLines, marginX, y)
      y += valueHeight + 6
    }
  }

  const filename = [
    'brief-form',
    sanitizeFilenamePart(row.formType),
    String(row.id),
  ]
    .filter(Boolean)
    .join('-')
    .concat('.pdf')

  pdf.save(filename)
}
