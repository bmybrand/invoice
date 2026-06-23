import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null
let clientKey = ''

function getBmybrandSupabaseConfig() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_BMYB_SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey =
    process.env.BMYB_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }

  return { supabaseUrl, serviceRoleKey }
}

export function getBmybrandSupabaseAdmin(): SupabaseClient | null {
  const config = getBmybrandSupabaseConfig()
  if (!config) {
    return null
  }

  const cacheKey = `${config.supabaseUrl}:${config.serviceRoleKey}`
  if (!client || clientKey !== cacheKey) {
    client = createClient(config.supabaseUrl, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
    clientKey = cacheKey
  }

  return client
}

export function getBmybrandSupabaseProjectRef(): string | null {
  const config = getBmybrandSupabaseConfig()
  if (!config) return null

  try {
    return new URL(config.supabaseUrl).hostname.split('.')[0] || null
  } catch {
    return null
  }
}
