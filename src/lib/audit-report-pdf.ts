import type { AuditReportDetailRow } from '@/types/audit-report'
import type { jsPDF } from 'jspdf'

const BRAND = {
  slate900: [15, 23, 42] as const,
  slate800: [30, 41, 59] as const,
  slate600: [71, 85, 105] as const,
  slate500: [100, 116, 139] as const,
  slate200: [226, 232, 240] as const,
  slate100: [241, 245, 249] as const,
  orange500: [249, 115, 22] as const,
  green600: [22, 163, 74] as const,
  white: [255, 255, 255] as const,
}

const LOGO_PATH = '/bmybrand-B.svg'
const HEADER_HEIGHT_MM = 22
const FOOTER_HEIGHT_MM = 10

type PdfLayout = {
  pdf: jsPDF
  pageWidth: number
  pageHeight: number
  marginX: number
  contentTop: number
  contentBottom: number
  contentWidth: number
  logoDataUrl: string | null
}

function sanitizeFilenamePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

async function loadBrandLogoDataUrl(): Promise<string | null> {
  try {
    const response = await fetch(LOGO_PATH)
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function ensureSpace(layout: PdfLayout, y: number, needed: number) {
  if (y + needed <= layout.contentBottom) return y
  layout.pdf.addPage()
  drawPageHeader(layout)
  return layout.contentTop
}

function drawPageHeader(layout: PdfLayout) {
  const { pdf, pageWidth, logoDataUrl } = layout
  pdf.setFillColor(...BRAND.slate900)
  pdf.rect(0, 0, pageWidth, HEADER_HEIGHT_MM, 'F')

  const logoSize = 10
  if (logoDataUrl) {
    pdf.addImage(logoDataUrl, 'PNG', layout.marginX, 6, logoSize, logoSize)
  }

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(...BRAND.white)
  pdf.text('BMYBrand — Website Audit Report', layout.marginX + (logoDataUrl ? logoSize + 4 : 0), HEADER_HEIGHT_MM / 2 + 1.5)
}

function drawPageFooter(layout: PdfLayout, page: number, totalPages: number) {
  const { pdf, pageWidth, pageHeight, marginX } = layout
  const footerY = pageHeight - FOOTER_HEIGHT_MM

  pdf.setDrawColor(...BRAND.slate200)
  pdf.line(marginX, footerY, pageWidth - marginX, footerY)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(...BRAND.slate500)
  pdf.text(`Page ${page} of ${totalPages}`, marginX, footerY + 6)
  pdf.text('Generated from BMYBrand Brandsight', pageWidth - marginX, footerY + 6, { align: 'right' })
}

function wrapText(pdf: jsPDF, text: string, maxWidth: number) {
  return pdf.splitTextToSize(text, maxWidth) as string[]
}

function formatLabel(value: string | null) {
  if (!value) return '—'
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function drawMetaCard(layout: PdfLayout, y: number, audit: AuditReportDetailRow) {
  const { pdf, marginX, contentWidth } = layout
  const report = audit.report
  const cardHeight = 42

  y = ensureSpace(layout, y, cardHeight)
  pdf.setFillColor(...BRAND.white)
  pdf.setDrawColor(...BRAND.slate200)
  pdf.roundedRect(marginX, y, contentWidth, cardHeight, 3, 3, 'FD')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.setTextColor(...BRAND.slate900)
  pdf.text('Audit Overview', marginX + 5, y + 8)

  const rows = [
    ['Website', audit.site_url],
    ['Score', `${report.overallScore}/100`],
    ['Issues', `${report.issueCount}+`],
    ['Industry', formatLabel(audit.industry)],
    ['Goal', formatLabel(audit.website_goal)],
    ['Lead', [audit.lead_name, audit.lead_email].filter(Boolean).join(' · ') || '—'],
  ]

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  let rowY = y + 16
  for (const [label, value] of rows) {
    pdf.setTextColor(...BRAND.slate500)
    pdf.text(`${label}:`, marginX + 5, rowY)
    pdf.setTextColor(...BRAND.slate800)
    const lines = wrapText(pdf, String(value), contentWidth - 38)
    pdf.text(lines[0] || '—', marginX + 28, rowY)
    rowY += 4.2
  }

  return y + cardHeight + 6
}

function drawSummary(layout: PdfLayout, y: number, summary: string) {
  const { pdf, marginX, contentWidth } = layout
  const lines = wrapText(pdf, summary, contentWidth - 8)
  const blockHeight = 12 + lines.length * 4.5

  y = ensureSpace(layout, y, blockHeight)
  pdf.setFillColor(...BRAND.slate100)
  pdf.roundedRect(marginX, y, contentWidth, blockHeight, 3, 3, 'F')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(...BRAND.slate900)
  pdf.text('Executive Summary', marginX + 4, y + 7)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(...BRAND.slate800)
  pdf.text(lines, marginX + 4, y + 13)

  return y + blockHeight + 6
}

function drawSection(layout: PdfLayout, y: number, section: AuditReportDetailRow['report']['sections'][number], index: number) {
  const { pdf, marginX, contentWidth } = layout
  const displayScore = section.score * 10

  y = ensureSpace(layout, y, 18)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(...BRAND.slate900)
  pdf.text(`${index + 1}. ${section.title}`, marginX, y)
  pdf.setTextColor(...BRAND.orange500)
  pdf.text(`${displayScore}/100`, marginX + contentWidth, y, { align: 'right' })
  y += 6

  const drawList = (title: string, items: string[], color: readonly [number, number, number]) => {
    if (!items.length) return
    y = ensureSpace(layout, y, 10)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(...color)
    pdf.text(title, marginX, y)
    y += 4

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8.5)
    pdf.setTextColor(...BRAND.slate800)
    for (const item of items.slice(0, 5)) {
      const lines = wrapText(pdf, `• ${item}`, contentWidth - 4)
      const blockHeight = lines.length * 4.2
      y = ensureSpace(layout, y, blockHeight)
      pdf.text(lines, marginX + 2, y)
      y += blockHeight + 1
    }
    y += 2
  }

  drawList('Good News', section.effectivePractices, BRAND.green600)
  drawList('Attention', section.improvementOpportunities, BRAND.orange500)

  if (section.aiInterpretation?.trim()) {
    const lines = wrapText(pdf, section.aiInterpretation.trim(), contentWidth - 8)
    const blockHeight = 8 + lines.length * 4.2
    y = ensureSpace(layout, y, blockHeight)
    pdf.setFillColor(255, 247, 237)
    pdf.roundedRect(marginX, y, contentWidth, blockHeight, 2, 2, 'F')
    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(8.5)
    pdf.setTextColor(...BRAND.slate800)
    pdf.text(lines, marginX + 4, y + 6)
    y += blockHeight + 4
  }

  return y + 4
}

export async function downloadAuditReportPdf(audit: AuditReportDetailRow): Promise<void> {
  const [{ jsPDF }] = await Promise.all([import('jspdf')])
  const logoDataUrl = await loadBrandLogoDataUrl()

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
  }

  pdf.setFillColor(...BRAND.slate100)
  pdf.rect(0, HEADER_HEIGHT_MM, pageWidth, pageHeight - HEADER_HEIGHT_MM, 'F')

  drawPageHeader(layout)

  let y = layout.contentTop
  y = drawMetaCard(layout, y, audit)
  y = drawSummary(layout, y, audit.report.summary)

  audit.report.sections.forEach((section, index) => {
    y = drawSection(layout, y, section, index)
  })

  const totalPages = pdf.getNumberOfPages()
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page)
    drawPageFooter(layout, page, totalPages)
  }

  const host = (() => {
    try {
      return new URL(audit.site_url).hostname.replace(/^www\./, '')
    } catch {
      return 'website'
    }
  })()

  const filename = `audit-${sanitizeFilenamePart(host)}-${audit.id.slice(0, 8)}.pdf`
  pdf.save(filename)
}
