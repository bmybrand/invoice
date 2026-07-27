import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

type JobEditorAuthResult =
  | { ok: true; supabase: SupabaseClient; user: User; role: string }
  | { ok: false; status: number; error: string }

function normalizeRole(value: string | null | undefined) {
  return (value || '').trim().toLowerCase().replace(/\s+/g, '')
}

export async function requireJobEditor(request: Request): Promise<JobEditorAuthResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return { ok: false, status: 503, error: 'Invoice CRM Supabase is not configured.' }
  }
  if (!token) return { ok: false, status: 401, error: 'Missing authorization token' }

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(token)
  if (userError || !user) return { ok: false, status: 401, error: 'Authentication failed' }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_id', user.id)
    .neq('isdeleted', true)
    .maybeSingle()

  if (employeeError) return { ok: false, status: 500, error: 'Failed to verify editor access' }

  const role = normalizeRole((employee as { role?: string } | null)?.role)
  if (role !== 'editor' && role !== 'superadmin') {
    return { ok: false, status: 403, error: 'Only editors or super admins can manage opportunities' }
  }

  return { ok: true, supabase, user, role }
}
