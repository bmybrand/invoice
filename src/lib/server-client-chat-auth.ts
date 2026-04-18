import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

type ChatActor = {
  accountType: 'employee' | 'client'
  role: 'user' | 'admin' | 'superadmin' | 'client'
  user: User
  supabase: SupabaseClient
  clientRow: {
    id: number
    name: string | null
    email: string | null
    auth_id: string | null
    handler_id: string | null
    isdeleted: boolean | null
  }
}

type ChatAuthSuccess = {
  ok: true
  actor: ChatActor
}

type ChatAuthFailure = {
  ok: false
  status: number
  error: string
}

export type ClientChatAuthResult = ChatAuthSuccess | ChatAuthFailure

function normalizeRole(value: string | null | undefined): 'user' | 'admin' | 'superadmin' | null {
  const normalized = (value || '').trim().toLowerCase().replace(/\s+/g, '')
  if (normalized === 'superadmin') return 'superadmin'
  if (normalized === 'admin') return 'admin'
  if (normalized === 'user') return 'user'
  return null
}

export async function requireClientChatAccess(
  request: Request,
  clientId: number
): Promise<ClientChatAuthResult> {
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

  const { data: clientData, error: clientError } = await supabase
    .from('clients')
    .select('id, name, email, auth_id, handler_id, isdeleted')
    .eq('id', clientId)
    .single()

  if (clientError || !clientData) {
    return { ok: false, status: 404, error: clientError?.message || 'Client not found' }
  }

  const clientRow = clientData as ChatActor['clientRow']
  if (clientRow.isdeleted === true) {
    return { ok: false, status: 404, error: 'Client not found' }
  }

  const { data: employeeData, error: employeeError } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_id', user.id)
    .neq('isdeleted', true)
    .maybeSingle()

  if (employeeError) {
    return { ok: false, status: 500, error: 'Failed to verify access' }
  }

  if (employeeData) {
    const role = normalizeRole((employeeData as { role?: string | null }).role)
    if (!role) {
      console.error('Unrecognized employee role in chat auth', {
        userId: user.id,
        role: (employeeData as { role?: string | null }).role ?? null,
      })
      return { ok: false, status: 403, error: 'Unrecognized employee role' }
    }
    const canAccess =
      role === 'superadmin' || role === 'admin' || clientRow.handler_id === user.id

    if (!canAccess) {
      return { ok: false, status: 403, error: 'You do not have access to this chat' }
    }

    return {
      ok: true,
      actor: {
        accountType: 'employee',
        role,
        user,
        supabase,
        clientRow,
      },
    }
  }

  if ((clientRow.auth_id || '').trim() !== user.id) {
    return { ok: false, status: 403, error: 'You do not have access to this chat' }
  }

  return {
    ok: true,
    actor: {
      accountType: 'client',
      role: 'client',
      user,
      supabase,
      clientRow,
    },
  }
}
