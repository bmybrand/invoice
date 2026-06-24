-- Google Drive PDF archive for website audit reports

ALTER TABLE audit_reports
  ADD COLUMN IF NOT EXISTS drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS drive_uploaded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_audit_reports_drive_file_id
  ON audit_reports(drive_file_id)
  WHERE drive_file_id IS NOT NULL;
