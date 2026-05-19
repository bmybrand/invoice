-- Run this in phpMyAdmin (or mysql CLI) against your application database.
-- Example database name: invoice_portal

CREATE TABLE IF NOT EXISTS brief_form_submissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  form_type VARCHAR(64) NOT NULL,
  payload JSON NOT NULL,
  submitter_email VARCHAR(255) NULL,
  submitted_by_auth_id VARCHAR(36) NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'portal',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_brief_form_type (form_type),
  INDEX idx_brief_form_created_at (created_at),
  INDEX idx_brief_form_email (submitter_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
