export type AuditReportSection = {
  id: string
  title: string
  score: number
  effectivePractices: string[]
  improvementOpportunities: string[]
  aiInterpretation?: string
}

export type AuditReportPayload = {
  overallScore: number
  issueCount: number
  summary: string
  sections: AuditReportSection[]
}

export type AuditReportListRow = {
  id: string
  site_url: string
  industry: string | null
  website_goal: string | null
  overall_score: number
  issue_count: number
  summary: string | null
  unlocked: boolean
  lead_name: string | null
  lead_email: string | null
  lead_company: string | null
  created_at: string
}

export type AuditReportDetailRow = AuditReportListRow & {
  report: AuditReportPayload
}
