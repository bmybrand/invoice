import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const INVOICE_ONLY_HOST_REDIRECTS: Record<string, string> = {
  'invoice.americanwebexperts.com': 'https://americanwebexperts.com',
  'invoice.texaswebstudio.co': 'https://texaswebstudio.co',
}

function isInvoiceOnlyAllowedPath(pathname: string): boolean {
  if (pathname === '/invoice' || pathname.startsWith('/invoice/')) return true
  if (pathname.startsWith('/_next/')) return true
  if (/\.[a-z0-9]+$/i.test(pathname)) return true

  const allowedApiPaths = [
    '/api/public/invoice',
    '/api/create-payment-intent',
    '/api/create-checkout-session',
    '/api/payments/reconcile',
    '/api/stripe/config',
    '/api/proxy-image',
  ]

  return allowedApiPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

  if (!url || !key) {
    return null
  }

  return { url, key }
}

function copyCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie)
  }
  return to
}

function isProtectedApiMutation(pathname: string, method: string) {
  if (!pathname.startsWith('/api/')) {
    return false
  }

  const normalizedMethod = method.toUpperCase()
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(normalizedMethod)) {
    return false
  }

  const publicApiPrefixes = [
    '/api/auth/session',
    '/api/create-payment-intent',
    '/api/create-checkout-session',
    '/api/payments/reconcile',
    '/api/webhooks/stripe',
  ]

  if (
    pathname === '/api/create-payment-intent' ||
    pathname === '/api/create-checkout-session' ||
    pathname === '/api/payments/reconcile'
  ) {
    return false
  }

  if (/^\/api\/invoices\/[^/]+\/mark-paid$/.test(pathname)) {
    return false
  }

  if (pathname === '/api/brief-forms' && normalizedMethod === 'POST') {
    return false
  }

  return !publicApiPrefixes.some((prefix) => pathname.startsWith(prefix))
}

export async function middleware(request: NextRequest) {
  const hostname = request.nextUrl.hostname.toLowerCase()
  const invoiceOnlyRedirect = INVOICE_ONLY_HOST_REDIRECTS[hostname]

  if (invoiceOnlyRedirect && !isInvoiceOnlyAllowedPath(request.nextUrl.pathname)) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.redirect(new URL(invoiceOnlyRedirect))
  }

  const config = getSupabaseConfig()
  if (!config) {
    return NextResponse.next()
  }

  const { pathname, search } = request.nextUrl
  const isProtectedRoute =
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/register/pending'
  const isGuestOnlyRoute = pathname === '/' || pathname === '/login'
  const isProtectedApiRoute = isProtectedApiMutation(pathname, request.method)

  if (!isProtectedRoute && !isGuestOnlyRoute && !isProtectedApiRoute) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }

        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        })

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && isProtectedRoute) {
    const loginUrl = new URL('/login', request.url)
    if (pathname !== '/register/pending') {
      const nextPath = `${pathname}${search}`
      if (nextPath !== '/dashboard') {
        loginUrl.searchParams.set('next', nextPath)
      }
    }
    return copyCookies(response, NextResponse.redirect(loginUrl))
  }

  if (!user && isProtectedApiRoute) {
    return copyCookies(
      response,
      NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    )
  }

  if (user && isGuestOnlyRoute) {
    return copyCookies(response, NextResponse.redirect(new URL('/dashboard', request.url)))
  }

  return response
}

export const config = {
  matcher: ['/:path*'],
}
