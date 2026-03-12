import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type InvoiceRow = {
  id: number
  amount: string | number | null
  payable_amount: string | number | null
  service: unknown
  status: string | null
}

type PaymentGatewayRow = Record<string, unknown>

export type StripeGatewayMatch = {
  id: number | null
  name: string
  minAmount: number
  maxAmount: number | null
  secretKey: string
  publishableKey: string | null
  source: 'database' | 'environment'
}

type InvoicePaymentContext =
  | {
      ok: true
      supabase: SupabaseClient
      invoice: InvoiceRow
      amount: number
    }
  | {
      ok: false
      status: number
      error: string
    }

type GatewayLookupResult =
  | {
      ok: true
      gateway: StripeGatewayMatch
    }
  | {
      ok: false
      status: number
      error: string
    }

function createServiceRoleSupabase(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey)
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
}

function parseAmount(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  const normalized = normalizeString(value).replace(/[^0-9.-]/g, '')
  if (!normalized) return null

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function computeServicesTotal(services: unknown): number {
  if (!Array.isArray(services)) return 0

  return services.reduce((sum, line) => {
    const row = typeof line === 'object' && line !== null ? (line as Record<string, unknown>) : {}
    const quantity = Math.max(1, Number(row.qty ?? 1) || 1)
    const price = parseAmount(row.price) ?? 0
    return sum + quantity * price
  }, 0)
}

function resolveInvoiceAmount(invoice: InvoiceRow): number | null {
  const payableAmount = parseAmount(invoice.payable_amount)
  if (payableAmount != null && payableAmount > 0) return payableAmount

  const amount = parseAmount(invoice.amount)
  if (amount != null && amount > 0) return amount

  const servicesTotal = computeServicesTotal(invoice.service)
  return servicesTotal > 0 ? servicesTotal : null
}

function isActiveGateway(status: string): boolean {
  const normalized = status.trim().toLowerCase()
  return normalized === 'active' || normalized === 'enabled' || normalized === 'live'
}

function shouldUseLiveKeys(): boolean {
  const mode = normalizeString(process.env.STRIPE_GATEWAY_MODE).toLowerCase()
  if (mode === 'live') return true
  if (mode === 'test') return false
  return process.env.NODE_ENV === 'production'
}

function resolveGatewayKeys(gateway: PaymentGatewayRow): { secretKey: string; publishableKey: string | null } | null {
  const directSecret = normalizeString(gateway.secret_key)
  const directPublishable = normalizeString(gateway.publishable_key)

  if (directSecret) {
    return {
      secretKey: directSecret,
      publishableKey: directPublishable || null,
    }
  }

  const testingSecret = normalizeString(gateway.testing_secret_key)
  const testingPublishable = normalizeString(gateway.testing_publishable_key)
  const liveSecret = normalizeString(gateway.live_secret_key)
  const livePublishable = normalizeString(gateway.live_publishable_key)
  const preferLiveKeys = shouldUseLiveKeys()

  const secretKey = preferLiveKeys ? liveSecret || testingSecret : testingSecret || liveSecret
  const publishableKey = preferLiveKeys
    ? livePublishable || testingPublishable
    : testingPublishable || livePublishable

  if (!secretKey) return null

  return {
    secretKey,
    publishableKey: publishableKey || null,
  }
}

function normalizeGateway(gateway: PaymentGatewayRow): StripeGatewayMatch | null {
  const name = normalizeString(gateway.name) || 'Stripe'
  const status = normalizeString(gateway.status) || 'Inactive'
  const keys = resolveGatewayKeys(gateway)

  if (!isActiveGateway(status) || !keys) return null

  const looksLikeStripe =
    name.toLowerCase().includes('stripe') ||
    keys.secretKey.startsWith('sk_') ||
    (keys.publishableKey?.startsWith('pk_') ?? false)

  if (!looksLikeStripe) return null

  const minAmount = parseAmount(gateway.min_amount ?? gateway.minimum_deposit_amount) ?? 0
  const maxAmount = parseAmount(gateway.max_amount ?? gateway.maximum_deposit_amount)
  const parsedId = Number(gateway.id)

  return {
    id: Number.isFinite(parsedId) ? parsedId : null,
    name,
    minAmount,
    maxAmount: maxAmount != null && maxAmount >= 0 ? maxAmount : null,
    secretKey: keys.secretKey,
    publishableKey: keys.publishableKey,
    source: 'database',
  }
}

function getEnvironmentStripeGateway(): StripeGatewayMatch | null {
  const secretKey = normalizeString(process.env.STRIPE_SECRET_KEY)
  if (!secretKey) return null

  const publishableKey = normalizeString(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) || null

  return {
    id: null,
    name: 'Stripe',
    minAmount: 0,
    maxAmount: null,
    secretKey,
    publishableKey,
    source: 'environment',
  }
}

export async function getInvoicePaymentContext(invoiceId: number): Promise<InvoicePaymentContext> {
  const supabase = createServiceRoleSupabase()

  if (!supabase) {
    return {
      ok: false,
      status: 503,
      error: 'Server not configured. Add SUPABASE_SERVICE_ROLE_KEY to .env.local',
    }
  }

  const { data, error } = await supabase
    .from('invoices')
    .select('id, amount, payable_amount, service, status')
    .eq('id', invoiceId)
    .maybeSingle()

  if (error) {
    return { ok: false, status: 500, error: error.message }
  }

  if (!data) {
    return { ok: false, status: 404, error: 'Invoice not found' }
  }

  const invoice = data as InvoiceRow
  const amount = resolveInvoiceAmount(invoice)

  if (amount == null || amount <= 0) {
    return { ok: false, status: 400, error: 'Invoice amount is invalid' }
  }

  return { ok: true, supabase, invoice, amount }
}

export async function findMatchingStripeGatewayForAmount(
  supabase: SupabaseClient,
  amount: number
): Promise<GatewayLookupResult> {
  const { data, error } = await supabase.from('payment_gateways').select('*').order('id', { ascending: true })

  if (error) {
    return { ok: false, status: 500, error: error.message }
  }

  const gateways = ((data ?? []) as PaymentGatewayRow[])
    .map(normalizeGateway)
    .filter((gateway): gateway is StripeGatewayMatch => gateway !== null)
    .sort((a, b) => a.minAmount - b.minAmount)

  const matchedGateway = gateways.find(
    (gateway) => amount >= gateway.minAmount && (gateway.maxAmount == null || amount <= gateway.maxAmount)
  )

  if (!matchedGateway) {
    const environmentGateway = getEnvironmentStripeGateway()
    if (environmentGateway) {
      console.warn(
        `[Stripe] No active payment gateway matched amount ${amount}. Falling back to environment Stripe keys.`
      )
      return { ok: true, gateway: environmentGateway }
    }

    return {
      ok: false,
      status: 400,
      error: 'No active Stripe gateway matches this invoice amount and fallback Stripe environment keys are missing',
    }
  }

  return { ok: true, gateway: matchedGateway }
}
