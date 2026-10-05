import { notFound } from 'next/navigation'
import {
  getInvoicePortalOrigin,
  isBriefFormSlug,
} from '@/lib/invoice-portal-origin'

type PageProps = {
  params: Promise<{ formType: string }>
}

/**
 * Drop these files into the Texas Web Studio Next.js / Vercel app
 * (same pattern as bmybrand.com/brief-forms/*).
 *
 * Env on the Texas Web Studio Vercel project:
 *   INVOICE_PORTAL_ORIGIN=https://dashboard.bmybrand.com
 *   BRIEF_FORM_BRAND_SLUG=texaswebstudio
 */
export default async function BriefFormEmbedPage({ params }: PageProps) {
  const { formType } = await params

  if (!isBriefFormSlug(formType)) {
    notFound()
  }

  const origin = getInvoicePortalOrigin()
  const brandSlug = (
    process.env.BRIEF_FORM_BRAND_SLUG ||
    process.env.NEXT_PUBLIC_BRIEF_FORM_BRAND_SLUG ||
    'texaswebstudio'
  )
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

  if (!origin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-neutral-900">
            Brief form is not configured
          </h1>
          <p className="mt-3 text-sm text-neutral-600">
            On the <strong>Texas Web Studio</strong> Vercel project, set{' '}
            <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
              INVOICE_PORTAL_ORIGIN
            </code>{' '}
            to{' '}
            <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
              https://dashboard.bmybrand.com
            </code>{' '}
            and redeploy.
          </p>
        </div>
      </main>
    )
  }

  const src = `${origin}/brief-forms/${formType}?brand=${encodeURIComponent(brandSlug || 'texaswebstudio')}`

  return (
    <iframe
      src={src}
      title="Texas Web Studio brief form"
      className="h-[100dvh] w-full border-0 bg-white"
      allow="clipboard-write"
    />
  )
}
