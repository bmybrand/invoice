# Texas Web Studio — brief form embed

`https://texaswebstudio.co/brief-forms/...` 404s until the marketing host embeds the CRM.

## If Texas is on cPanel (your case)

Follow: [`cpanel/README.md`](./cpanel/README.md)

Upload `cpanel/brief-forms/` → `public_html/brief-forms/` on texaswebstudio.co.

## If Texas were on Vercel / Next.js

Copy `app/brief-forms/` + `lib/invoice-portal-origin.ts` into that app and set:

- `INVOICE_PORTAL_ORIGIN=https://dashboard.bmybrand.com`
- `BRIEF_FORM_BRAND_SLUG=texaswebstudio`
