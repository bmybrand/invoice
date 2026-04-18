import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
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
    '/api/webhooks/stripe',
  ]

  if (pathname === '/api/create-payment-intent' || pathname === '/api/create-checkout-session') {
    return false
  }

  if (/^\/api\/invoices\/[^/]+\/mark-paid$/.test(pathname)) {
    return false
  }

  return !publicApiPrefixes.some((prefix) => pathname.startsWith(prefix))
}

export async function middleware(request: NextRequest) {
  const config = getSupabaseConfig()
  if (!config) {
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

  const { pathname, search } = request.nextUrl
  const isProtectedRoute =
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/register/pending'
  const isGuestOnlyRoute = pathname === '/' || pathname === '/login'
  const isProtectedApiRoute = isProtectedApiMutation(pathname, request.method)

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
  matcher: ['/', '/login', '/dashboard/:path*', '/register/pending', '/api/:path*'],
}
