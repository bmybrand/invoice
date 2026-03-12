import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

type AuthSuccess = {
  ok: true
  supabase: SupabaseClient
  user: User
  role: string
}

type AuthFailure = {
  ok: false
  status: number
  error: string
}

type PaymentGatewayAuthResult = AuthSuccess | AuthFailure

function normalizeRole(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, '')
}

export async function requirePaymentGatewayAdmin(request: Request): Promise<PaymentGatewayAuthResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false, status: 503, error: 'Server not configured. Add SUPABASE_SERVICE_ROLE_KEY to .env.local' }
  }

  if (!token) {
    return { ok: false, status: 401, error: 'Missing authorization token' }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token)

  if (userError || !user) {
    return { ok: false, status: 401, error: 'Authentication failed' }
  }

  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (employeeError) {
    return { ok: false, status: 500, error: 'Failed to verify employee access' }
  }

  const role = normalizeRole((employee as { role?: string } | null)?.role)
  if (role !== 'superadmin' && role !== 'admin') {
    return { ok: false, status: 403, error: 'You do not have permission to manage payment gateways' }
  }

  return { ok: true, supabase, user, role }
}

