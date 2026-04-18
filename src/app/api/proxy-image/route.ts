import { lookup } from 'node:dns/promises'
import net from 'node:net'
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true
  }

  if (parts[0] === 10 || parts[0] === 127) return true
  if (parts[0] === 169 && parts[1] === 254) return true
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
  if (parts[0] === 192 && parts[1] === 168) return true
  if (parts[0] === 0) return true

  return false
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase()
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.') ||
    normalized.startsWith('::ffff:172.16.') ||
    normalized.startsWith('::ffff:172.17.') ||
    normalized.startsWith('::ffff:172.18.') ||
    normalized.startsWith('::ffff:172.19.') ||
    normalized.startsWith('::ffff:172.2') ||
    normalized.startsWith('::ffff:172.30.') ||
    normalized.startsWith('::ffff:172.31.') ||
    normalized.startsWith('::ffff:169.254.')
  )
}

function isDisallowedIp(ip: string): boolean {
  const kind = net.isIP(ip)
  if (kind === 4) return isPrivateIpv4(ip)
  if (kind === 6) return isPrivateIpv6(ip)
  return true
}

function getAllowedHosts(): Set<string> {
  const configuredHosts = (process.env.PROXY_IMAGE_ALLOWED_HOSTS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  const supabaseHost = new URL(env.SUPABASE_URL).hostname.toLowerCase()
  return new Set([supabaseHost, ...configuredHosts])
}

export async function GET(req: Request) {
  const rawUrl = new URL(req.url).searchParams.get('url')?.trim()
  if (!rawUrl) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const target = new URL(rawUrl)
    if (target.protocol !== 'https:') {
      return NextResponse.json({ error: 'Only HTTPS image URLs are allowed' }, { status: 400 })
    }

    const hostname = target.hostname.toLowerCase()
    if (hostname === 'localhost') {
      return NextResponse.json({ error: 'Host is not allowed' }, { status: 403 })
    }

    const allowedHosts = getAllowedHosts()
    if (!allowedHosts.has(hostname)) {
      return NextResponse.json({ error: 'Host is not allowed' }, { status: 403 })
    }

    const resolved = await lookup(hostname, { all: true })
    if (resolved.length === 0 || resolved.some((entry) => isDisallowedIp(entry.address))) {
      return NextResponse.json({ error: 'Host is not allowed' }, { status: 403 })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(target, {
      headers: { 'User-Agent': 'InvoiceCRM/1.0' },
      signal: controller.signal,
      redirect: 'follow',
    })

    clearTimeout(timeout)
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.toLowerCase().startsWith('image/')) {
      return NextResponse.json({ error: 'Only image responses are allowed' }, { status: 415 })
    }

    const contentLength = Number(res.headers.get('content-length') ?? '0')
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Image is too large' }, { status: 413 })
    }

    const buffer = await res.arrayBuffer()
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Image is too large' }, { status: 413 })
    }

    const base64 = Buffer.from(buffer).toString('base64')
    const dataUrl = `data:${contentType};base64,${base64}`
    return NextResponse.json({ dataUrl })
  } catch (err) {
    logger.error('Proxy image failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 })
  }
}
