# Payment Submissions Retention

`payment_submissions` stores payer contact and reconciliation data used for:

- matching Stripe webhook events to invoices
- payment support and receipt troubleshooting
- finance/admin audit trails

Policy:

- Do not store raw card details from client forms.
- Keep `name_on_card`, `card_last4`, `card_expiry_month`, and `card_expiry_year` null unless a future server-side Stripe reconciliation flow explicitly requires them.
- Retain payer contact details only for operational and accounting needs.
- When a privacy or deletion request is approved, redact non-essential personal fields in `payment_submissions` while preserving invoice and transaction linkage needed for accounting records.

Recommended redaction targets:

- `full_name`
- `phone`
- `email`
- `street_address`
- `city`
- `state_region`
- `zip_code`
