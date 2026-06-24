-- Soft-delete support for website audit reports (dashboard archive / purge)

ALTER TABLE audit_reports
  ADD COLUMN IF NOT EXISTS isdeleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_audit_reports_active_created_at
  ON audit_reports(created_at DESC)
  WHERE isdeleted = false;
