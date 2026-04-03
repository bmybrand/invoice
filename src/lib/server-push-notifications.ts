import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'

type PushSubscriptionRow = {
  endpoint: string | null
  p256dh: string | null
  auth: string | null
}

type SendHandlerChatPushParams = {
  supabase: SupabaseClient
  clientId: number
  senderAuthId: string
  title: string
  body: string
  url?: string
}

let vapidConfigured = false

function ensureVapidConfigured() {
  if (vapidConfigured) return true

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@example.com'

  if (!publicKey || !privateKey) {
    return false
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
  return true
}

export async function sendHandlerChatPush({
  supabase,
  clientId,
  senderAuthId,
  title,
  body,
  url = '/dashboard/clients',
}: SendHandlerChatPushParams) {
  if (!ensureVapidConfigured()) return

  const { data: clientRow, error: clientError } = await supabase
    .from('clients')
    .select('handler_id, name, email')
    .eq('id', clientId)
    .neq('isdeleted', true)
    .maybeSingle()

  if (clientError || !clientRow) return

  const handlerAuthId = String((clientRow as { handler_id?: string | null }).handler_id || '').trim()
  if (!handlerAuthId || handlerAuthId === senderAuthId) return

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('auth_id', handlerAuthId)

  if (subscriptionsError) return

  const payload = JSON.stringify({
    title,
    body,
    url,
    clientId,
  })

  const staleEndpoints: string[] = []

  for (const row of ((subscriptions as PushSubscriptionRow[] | null) ?? [])) {
    const endpoint = (row.endpoint || '').trim()
    const p256dh = (row.p256dh || '').trim()
    const auth = (row.auth || '').trim()
    if (!endpoint || !p256dh || !auth) continue

    try {
      await webpush.sendNotification(
        {
          endpoint,
          keys: {
            p256dh,
            auth,
          },
        },
        payload
      )
    } catch (error) {
      const statusCode = Number((error as { statusCode?: number }).statusCode ?? 0)
      if (statusCode === 404 || statusCode === 410) {
        staleEndpoints.push(endpoint)
      }
    }
  }

  if (staleEndpoints.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', staleEndpoints)
  }
}
