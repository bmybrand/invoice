# Texas Web Studio — cPanel setup (brief forms)

Your marketing site on **texaswebstudio.co** must embed the CRM forms.
Without this, `/brief-forms/...` shows the site 404.

## Steps on cPanel

1. Log in to **cPanel** → **File Manager**.
2. Open `public_html` (or the document root for texaswebstudio.co).
3. Create a folder named `brief-forms`.
4. Upload these two files into that folder:
   - `brand-embeds/texaswebstudio/cpanel/brief-forms/index.php`
   - `brand-embeds/texaswebstudio/cpanel/brief-forms/.htaccess`
5. Edit `index.php` if needed:
   - `$crmOrigin = 'https://dashboard.bmybrand.com';`  ← your live CRM URL
   - `$brandSlug = 'texaswebstudio';`
6. Test in the browser:
   - https://texaswebstudio.co/brief-forms/graphic-design/
   - https://texaswebstudio.co/brief-forms/seo-questionnaire/
   - https://texaswebstudio.co/brief-forms/website/
   - https://texaswebstudio.co/brief-forms/logo-design/
   - https://texaswebstudio.co/brief-forms/video-animation/
   - https://texaswebstudio.co/brief-forms/smm/

You should see the CRM form (iframe), not the Texas site 404 page.

## CRM side (already in dashboard)

In **Brands** → Texas Web Studio:
- **Invoice URL:** `https://texaswebstudio.co`
- Logo + colors (shown on the public form)

Copy Link in Brief Forms should produce:
`https://texaswebstudio.co/brief-forms/...`

## WordPress note

If WordPress owns all routes and still 404s:
- Put the files in `public_html/brief-forms/` as above, **or**
- In WordPress permalinks / server rules, allow the `brief-forms` folder to be served by Apache (do not rewrite that path to `index.php` of WordPress).

Example WordPress exception (in the **root** `.htaccess`, before the WordPress rules):

```apache
RewriteRule ^brief-forms/ - [L]
```

## You do NOT need on Texas cPanel

- No Supabase keys
- No MySQL brief-forms database on Texas
- No CRM env vars on Texas

Those stay on the CRM (Vercel). Texas only iframes the CRM.
