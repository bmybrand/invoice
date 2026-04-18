function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

export const env = {
  SUPABASE_URL: required('NEXT_PUBLIC_SUPABASE_URL'),
  SUPABASE_ANON_KEY: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  SUPABASE_PUBLISHABLE_DEFAULT_KEY: required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),
  STRIPE_SECRET_KEY: required('STRIPE_SECRET_KEY'),
  STRIPE_WEBHOOK_SECRET: required('STRIPE_WEBHOOK_SECRET'),
  INVOICE_LINK_SECRET_KEY: required('INVOICE_LINK_SECRET_KEY'),
  RESEND_API_KEY: required('RESEND_API_KEY'),
  RESEND_FROM_EMAIL: required('RESEND_FROM_EMAIL'),
} as const
