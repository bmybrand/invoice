-- Allow website audit unlock leads from Brandsight / grow-my-business

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS company TEXT;

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_form_type_check;

ALTER TABLE leads
  ADD CONSTRAINT leads_form_type_check
  CHECK (
    form_type IN (
      'contact',
      'custom_quote_request',
      'newsletter_subscription',
      'website_audit'
    )
  );
