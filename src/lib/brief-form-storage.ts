import type { BriefFormType } from '@/lib/brief-form-types'
import {
  isCpanelBridgeConfigured,
  listBriefFormsViaCpanelBridge,
  saveBriefFormViaCpanelBridge,
  type BriefFormSubmissionRow,
} from '@/lib/cpanel-brief-forms-bridge'
import { getMysqlPool, isMysqlConfigured } from '@/lib/mysql'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

type SubmissionPayload = Record<string, string | string[]>

export function isBriefFormStorageConfigured(): boolean {
  return isCpanelBridgeConfigured() || isMysqlConfigured()
}

export function usesCpanelBridge(): boolean {
  return isCpanelBridgeConfigured()
}

export async function saveBriefFormSubmission(input: {
  formType: BriefFormType
  payload: SubmissionPayload
  submitterEmail: string | null
  submittedByAuthId: string | null
}): Promise<{ id: number; formType: string }> {
  const source = input.submittedByAuthId ? 'dashboard' : 'public'

  if (isCpanelBridgeConfigured()) {
    return saveBriefFormViaCpanelBridge({ ...input, source })
  }

  if (!isMysqlConfigured()) {
    throw new Error('Brief form storage is not configured.')
  }

  const pool = getMysqlPool()
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO brief_form_submissions
      (form_type, payload, submitter_email, submitted_by_auth_id, source)
     VALUES
      (:formType, :payload, :submitterEmail, :submittedByAuthId, :source)`,
    {
      formType: input.formType,
      payload: JSON.stringify(input.payload),
      submitterEmail: input.submitterEmail,
      submittedByAuthId: input.submittedByAuthId,
      source,
    }
  )

  return {
    id: Number(result.insertId),
    formType: input.formType,
  }
}

export async function listBriefFormSubmissions(input: {
  formType?: BriefFormType
  limit: number
}): Promise<BriefFormSubmissionRow[]> {
  if (isCpanelBridgeConfigured()) {
    return listBriefFormsViaCpanelBridge(input)
  }

  if (!isMysqlConfigured()) {
    throw new Error('Brief form storage is not configured.')
  }

  const pool = getMysqlPool()
  const params: Record<string, string | number> = { limit: input.limit }

  let sql = `SELECT id, form_type, payload, submitter_email, submitted_by_auth_id, source, created_at
             FROM brief_form_submissions`

  if (input.formType) {
    sql += ' WHERE form_type = :formType'
    params.formType = input.formType
  }

  sql += ' ORDER BY created_at DESC LIMIT :limit'

  const [rows] = await pool.execute<RowDataPacket[]>(sql, params)

  return rows.map((row) => ({
    id: Number(row.id),
    formType: String(row.form_type),
    payload:
      typeof row.payload === 'string'
        ? (JSON.parse(row.payload) as SubmissionPayload)
        : (row.payload as SubmissionPayload),
    submitterEmail: row.submitter_email ? String(row.submitter_email) : null,
    submittedByAuthId: row.submitted_by_auth_id ? String(row.submitted_by_auth_id) : null,
    source: String(row.source),
    createdAt: String(row.created_at),
  }))
}
