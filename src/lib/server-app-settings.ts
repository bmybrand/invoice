import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const EMAIL_SETTINGS_KEY = 'email'

type EmailSettingsValue = {
  enabled?: boolean
}

function createServiceRoleSupabase(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey)
}

function isMissingAppSettingsTableError(message: string | undefined): boolean {
  const normalized = (message || '').toLowerCase()
  return normalized.includes('app_settings') && normalized.includes('does not exist')
}

function parseEmailEnabled(value: unknown): boolean {
  if (!value || typeof value !== 'object') return true
  const enabled = (value as EmailSettingsValue).enabled
  return enabled !== false
}

export async function isEmailSendingEnabled(supabase?: SupabaseClient | null): Promise<boolean> {
  const client = supabase ?? createServiceRoleSupabase()
  if (!client) return true

  const { data, error } = await client
    .from('app_settings')
    .select('value')
    .eq('key', EMAIL_SETTINGS_KEY)
    .maybeSingle()

  if (error) {
    if (isMissingAppSettingsTableError(error.message)) return true
    return true
  }

  return parseEmailEnabled(data?.value)
}

export async function getEmailSendingSettings(): Promise<
  | { ok: true; enabled: boolean }
  | { ok: false; status: number; error: string }
> {
  const supabase = createServiceRoleSupabase()
  if (!supabase) {
    return {
      ok: false,
      status: 503,
      error: 'Server not configured. Add SUPABASE_SERVICE_ROLE_KEY to .env.local',
    }
  }

  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', EMAIL_SETTINGS_KEY)
    .maybeSingle()

  if (error) {
    if (isMissingAppSettingsTableError(error.message)) {
      return { ok: true, enabled: true }
    }
    return { ok: false, status: 500, error: error.message }
  }

  return { ok: true, enabled: parseEmailEnabled(data?.value) }
}

export async function setEmailSendingEnabled(
  supabase: SupabaseClient,
  enabled: boolean
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { error } = await supabase.from('app_settings').upsert(
    {
      key: EMAIL_SETTINGS_KEY,
      value: { enabled },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  )

  if (error) {
    if (isMissingAppSettingsTableError(error.message)) {
      return {
        ok: false,
        status: 503,
        error: 'Email settings table is missing. Run the app_settings migration in Supabase.',
      }
    }
    return { ok: false, status: 500, error: error.message }
  }

  return { ok: true }
}
