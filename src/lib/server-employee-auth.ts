import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

type EmployeeAuthSuccess = {
  ok: true
  supabase: SupabaseClient
  user: User
  role: string
}

type EmployeeAuthFailure = {
  ok: false
  status: number
  error: string
}

export type EmployeeAuthResult = EmployeeAuthSuccess | EmployeeAuthFailure

function normalizeRole(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, '')
}

export async function requireActiveEmployee(request: Request): Promise<EmployeeAuthResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return {
      ok: false,
      status: 503,
      error:
        'Server not configured. Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY, and SUPABASE_SERVICE_ROLE_KEY to .env.local',
    }
  }

  if (!token) {
    return { ok: false, status: 401, error: 'Missing authorization token' }
  }

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(token)

  if (userError || !user) {
    return { ok: false, status: 401, error: 'Authentication failed' }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_id', user.id)
    .neq('isdeleted', true)
    .maybeSingle()

  if (employeeError) {
    return { ok: false, status: 500, error: 'Failed to verify employee access' }
  }

  if (!employee) {
    return { ok: false, status: 403, error: 'Only employees can perform this action' }
  }

  return {
    ok: true,
    supabase,
    user,
    role: normalizeRole((employee as { role?: string | null }).role),
  }
}
