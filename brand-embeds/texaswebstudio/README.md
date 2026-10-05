# Texas Web Studio — brief form embed

`https://texaswebstudio.co/brief-forms/...` needs a cPanel embed of the CRM form.

## cPanel (use this)

Follow: [`cpanel/README.md`](./cpanel/README.md)

Upload `cpanel/brief-forms/` → `public_html/brief-forms/` on texaswebstudio.co.

Env in the PHP file:
- `$crmOrigin = 'https://dashboard.bmybrand.com';`
- `$brandSlug = 'texaswebstudio';`
