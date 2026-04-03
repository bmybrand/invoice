'use client'

import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { supabase } from '@/lib/supabase'
import { ClientDashboardDataProvider, useClientDashboardData } from '@/context/ClientDashboardDataContext'
import { NotificationsBell } from '@/components/NotificationsBell'
import { clearRequiredFieldInvalid, handleRequiredFieldInvalid } from '@/lib/form-validation'

const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'] })
const PROFILE_AVATAR_BUCKET = 'profile-images'
const SESSION_GUARD_POLL_MS = 5000

type DashboardProfile = {
  displayName: string
  displayRole: string
  currentUserAuthId: string | null
  currentEmployeeId: number | null
  onlineAuthIds: string[]
  accountType: 'employee' | 'client' | null
  profileLoaded: boolean
}

const DashboardProfileContext = createContext<DashboardProfile>({
  displayName: '',
  displayRole: '',
  currentUserAuthId: null,
  currentEmployeeId: null,
  onlineAuthIds: [],
  accountType: null,
  profileLoaded: false,
})

export function useDashboardProfile() {
  return useContext(DashboardProfileContext)
}

function GridIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path
        fillRule="evenodd"
        d="M3 6a3 3 0 013-3h2.25a3 3 0 013 3v2.25a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm9.75 0a3 3 0 013-3H18a3 3 0 013 3v2.25a3 3 0 01-3 3h-2.25a3 3 0 01-3-3V6zM3 15.75a3 3 0 013-3h2.25a3 3 0 013 3V18a3 3 0 01-3 3H6a3 3 0 01-3-3v-2.25zm9.75 0a3 3 0 013-3H18a3 3 0 013 3V18a3 3 0 01-3 3h-2.25a3 3 0 01-3-3v-2.25z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function UsersIcon({ className = 'h-5 w-4 text-slate-400' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z"
      />
    </svg>
  )
}

function StarIcon({ className = 'h-5 w-5 text-slate-400' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
      />
    </svg>
  )
}

function DollarIcon({ className = 'h-5 w-5 text-slate-400' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

function GearIcon({ className = 'h-5 w-5 text-slate-400' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function ChatIcon({ className = 'h-5 w-5 text-slate-400' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.5 8.25h9m-9 3h5.25M6.75 18l-3 2.25V6A2.25 2.25 0 016 3.75h12A2.25 2.25 0 0120.25 6v8.25A2.25 2.25 0 0118 16.5H9.75L6.75 18z"
      />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v3.75M15.75 9H15M12 15l-3-3m0 0l3-3m-3 3h12.75" />
    </svg>
  )
}

function ChevronLeftIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  )
}

function ChevronRightIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  )
}

function CloseIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function NavIcon({ label, active }: { label: string; active: boolean }) {
  const iconClass = active ? 'text-orange-500' : 'text-slate-400'
  const sizeClass = 'h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 lg:h-5 lg:w-5'
  const className = `${sizeClass} ${iconClass}`

  switch (label) {
    case 'Dashboard':
      return <GridIcon className={className} />
    case 'Employees':
      return <UsersIcon className={className} />
    case 'Brand Identity':
      return <StarIcon className={className} />
    case 'Invoice':
      return <DollarIcon className={className} />
    case 'Payment':
      return <DollarIcon className={className} />
    case 'Chat':
      return <ChatIcon className={className} />
    case 'Settings':
      return <GearIcon className={className} />
    default:
      return <GridIcon className={className} />
  }
}

function DashboardOverlay({
  profileLoaded,
  accountType,
}: {
  profileLoaded: boolean
  accountType: 'employee' | 'client' | null
}) {
  const clientData = useClientDashboardData()
  const clientLoading = accountType === 'client' && (clientData?.loading ?? true)
  const showOverlay = !profileLoaded || clientLoading

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md transition-opacity duration-300 ease-out ${
        showOverlay ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      aria-live="polite"
      aria-busy={showOverlay}
      aria-hidden={!showOverlay}
    >
      <div className="flex flex-col items-center gap-6">
        <div
          className="h-12 w-12 animate-spin rounded-full border-4 border-slate-600 border-t-orange-500"
          role="status"
          aria-label="Loading"
        />
        <p className="text-sm font-medium text-slate-300">Loading</p>
      </div>
    </div>
  )
}

const allNavItems: Array<{ label: string; href: string }> = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Employees', href: '/dashboard/employees' },
  { label: 'Clients', href: '/dashboard/clients' },
  { label: 'Brand Identity', href: '/dashboard/brands' },
  { label: 'Invoice', href: '/dashboard/invoices' },
  { label: 'Payment', href: '/dashboard/payments' },
  { label: 'Settings', href: '/dashboard/settings' },
]

export function DashboardLayout({ children, title }: { children: React.ReactNode; title?: string }) {
  const router = useRouter()
  const pathname = usePathname()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [displayRole, setDisplayRole] = useState('')
  const [currentEmployeeId, setCurrentEmployeeId] = useState<number | null>(null)
  const [displayAvatarUrl, setDisplayAvatarUrl] = useState('')
  const [currentUserAuthId, setCurrentUserAuthId] = useState<string | null>(null)
  const [currentUserEmail, setCurrentUserEmail] = useState('')
  const [currentTime, setCurrentTime] = useState('')
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null)
  const [profileAvatarPreviewUrl, setProfileAvatarPreviewUrl] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)
  const [onlineAuthIds, setOnlineAuthIds] = useState<string[]>([])
  const [accountType, setAccountType] = useState<'employee' | 'client' | null>(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [chatMessageCount, setChatMessageCount] = useState(0)

  const profileObjectUrlRef = useRef<string | null>(null)

  const resetDashboardProfile = useCallback((nextProfileLoaded: boolean) => {
    setCurrentUserAuthId(null)
    setCurrentEmployeeId(null)
    setCurrentUserEmail('')
    setDisplayName('')
    setDisplayRole('')
    setDisplayAvatarUrl('')
    setOnlineAuthIds([])
    setAccountType(null)
    setProfileLoaded(nextProfileLoaded)
  }, [])

  const redirectToLoginHard = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.location.replace('/login')
      return
    }
    router.replace('/login')
  }, [router])

  const visibleNavItems =
    accountType === 'client'
      ? [
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Invoice', href: '/dashboard/invoices' },
          { label: 'Payment', href: '/dashboard/payments' },
          { label: 'Chat', href: '/dashboard/chat' },
        ]
      : allNavItems

  const headerTitle =
    title ??
    (pathname === '/dashboard'
      ? accountType === 'client'
        ? 'Client Overview'
        : 'Analytics Center'
      : pathname === '/dashboard/employees'
        ? 'Employees'
        : pathname === '/dashboard/clients'
          ? 'Clients'
          : pathname === '/dashboard/brands'
            ? 'Brand Identity'
            : pathname === '/dashboard/invoices'
              ? 'Invoice'
              : pathname === '/dashboard/payments'
                ? 'Payment'
                : pathname === '/dashboard/chat'
                  ? 'Chat'
                : pathname === '/dashboard/settings'
                  ? 'Settings'
                : pathname.startsWith('/dashboard/')
                  ? pathname
                      .split('/')
                      .filter(Boolean)
                      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                      .join(' / ')
                  : 'Analytics Center')

  useEffect(() => {
    function updateCurrentTime() {
      setCurrentTime(
        new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      )
    }

    updateCurrentTime()
    const intervalId = window.setInterval(updateCurrentTime, 60000)

    return () => window.clearInterval(intervalId)
  }, [])

  const loadProfile = useCallback(async () => {
    const {
      data: { user: serverUser },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !serverUser?.id) {
      resetDashboardProfile(false)
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
      router.replace('/login')
      return
    }

    const user = serverUser

    const metadata = user.user_metadata as Record<string, unknown> | undefined
    const metadataDisplayName =
      typeof metadata?.display_name === 'string' ? metadata.display_name.trim() : ''
    const metadataAvatarUrl =
      typeof metadata?.avatar_url === 'string' ? metadata.avatar_url.trim() : ''

    setCurrentUserAuthId(user.id)
    setCurrentUserEmail(user.email ?? '')
    setDisplayAvatarUrl(metadataAvatarUrl)

    const { data: employeeData, error: employeeError } = await supabase
      .from('employees')
      .select('id, employee_name, role')
      .eq('auth_id', user.id)
      .neq('isdeleted', true)
      .maybeSingle()

    if (employeeData) {
      const row = employeeData as { id?: number; employee_name?: string; role?: string } | null

      setDisplayName(row?.employee_name?.trim() || metadataDisplayName || user.email || 'User')
      setCurrentEmployeeId(typeof row?.id === 'number' ? row.id : null)
      setDisplayRole(
        row?.role
          ? String(row.role).charAt(0).toUpperCase() + String(row.role).slice(1).toLowerCase()
          : ''
      )
      setAccountType('employee')
      setProfileLoaded(true)
      return
    }

    if (employeeError) {
      console.error('Employee lookup error:', employeeError.message)
    }

    const { data: deletedEmployee } = await supabase
      .from('employees')
      .select('id')
      .eq('auth_id', user.id)
      .eq('isdeleted', true)
      .maybeSingle()

    if (deletedEmployee) {
      resetDashboardProfile(false)
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
      router.replace('/login')
      return
    }

  const { data: clientData, error: clientError } = await supabase
  .from('clients')
  .select('name, email, auth_id, handler_id')
  .eq('status', 'approved')
  .neq('isdeleted', true)
  .or(`auth_id.eq.${user.id},email.eq.${user.email ?? ''}`)
  .maybeSingle()

if (clientData) {
  const row = clientData as { name?: string; email?: string; auth_id?: string; handler_id?: string } | null
  const clientName = row?.name?.trim() || metadataDisplayName || user.email || 'Client'

  setDisplayName(clientName)
  setCurrentEmployeeId(null)
  setDisplayRole('Client')
  setAccountType('client')
  setProfileLoaded(true)
  return
}

if (clientError) {
  console.error('Client lookup error:', clientError.message)
}

    const { data: latestRequest } = await supabase
      .from('clients')
      .select('id, status')
      .neq('isdeleted', true)
      .or(`auth_id.eq.${user.id},email.eq.${user.email ?? ''}`)
      .order('created_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    const requestStatus = (latestRequest as { id?: number; status?: string } | null)?.status
      ?.trim()
      .toLowerCase()

    if (requestStatus === 'pending') {
      setProfileLoaded(true)
      router.replace('/register/pending')
      return
    }

    if (requestStatus === 'approved') {
      resetDashboardProfile(false)
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
      router.replace('/login')
      return
    }

    if (requestStatus === 'rejected') {
      resetDashboardProfile(false)
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
      router.replace('/login?reason=rejected')
      return
    }

    const { data: deletedClient } = await supabase
      .from('clients')
      .select('id')
      .eq('isdeleted', true)
      .or(`auth_id.eq.${user.id},email.eq.${user.email ?? ''}`)
      .order('created_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (deletedClient) {
      resetDashboardProfile(false)
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
      router.replace('/login')
      return
    }

    setDisplayName(metadataDisplayName || user.email || 'User')
    setCurrentEmployeeId(null)
    setDisplayRole('')
    setAccountType(null)
    setProfileLoaded(true)
  }, [resetDashboardProfile, router])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadProfile()
    }, 0)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        resetDashboardProfile(false)
        redirectToLoginHard()
      } else if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
        void loadProfile()
      } else if (!session?.user) {
        resetDashboardProfile(false)
      }
    })

    return () => {
      window.clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [loadProfile, redirectToLoginHard, resetDashboardProfile])

  useEffect(() => {
    if (!accountType) return

    const restrictedForClients = [
      '/dashboard/employees',
      '/dashboard/clients',
      '/dashboard/brands',
      '/dashboard/settings',
    ]

    if (accountType === 'client' && restrictedForClients.includes(pathname)) {
      router.replace('/dashboard')
    }
  }, [accountType, pathname, router])

  useEffect(() => {
    if (accountType !== 'employee' || !currentUserAuthId) return

    const channel = supabase
      .channel(`employee-session-guard-${currentUserAuthId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employees',
          filter: `auth_id=eq.${currentUserAuthId}`,
        },
        async (payload) => {
          const nextRow = (payload.new ?? null) as { isdeleted?: boolean | null } | null
          if (nextRow?.isdeleted === true) {
            resetDashboardProfile(false)
            await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
            redirectToLoginHard()
          }
        }
      )
      .subscribe()

    return () => {
      void channel.unsubscribe()
    }
  }, [accountType, currentUserAuthId, redirectToLoginHard, resetDashboardProfile])

  useEffect(() => {
    if (accountType !== 'client' || !currentUserAuthId) return

    const channel = supabase
      .channel(`client-session-guard-${currentUserAuthId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clients',
          filter: `auth_id=eq.${currentUserAuthId}`,
        },
        async (payload) => {
          const nextRow = (payload.new ?? null) as { isdeleted?: boolean | null; status?: string | null } | null
          const status = (nextRow?.status || '').trim().toLowerCase()
          if (nextRow?.isdeleted === true || status === 'rejected') {
            resetDashboardProfile(false)
            await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
            redirectToLoginHard()
          }
        }
      )
      .subscribe()

    return () => {
      void channel.unsubscribe()
    }
  }, [accountType, currentUserAuthId, redirectToLoginHard, resetDashboardProfile])

  useEffect(() => {
    if (!currentUserAuthId || !accountType) return

    let cancelled = false

    const enforceSessionGuard = async () => {
      if (cancelled) return

      if (accountType === 'employee') {
        const { data } = await supabase
          .from('employees')
          .select('id')
          .eq('auth_id', currentUserAuthId)
          .eq('isdeleted', true)
          .maybeSingle()

        if (!cancelled && data) {
          resetDashboardProfile(false)
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
          redirectToLoginHard()
        }

        return
      }

      const identifierFilters = [`auth_id.eq.${currentUserAuthId}`]
      if (currentUserEmail.trim()) {
        identifierFilters.push(`email.eq.${currentUserEmail.trim()}`)
      }

      const { data } = await supabase
        .from('clients')
        .select('isdeleted, status')
        .or(identifierFilters.join(','))
        .order('created_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      const row = data as { isdeleted?: boolean | null; status?: string | null } | null
      const status = (row?.status || '').trim().toLowerCase()

      if (!cancelled && (row?.isdeleted === true || status === 'rejected')) {
        resetDashboardProfile(false)
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
        redirectToLoginHard()
      }
    }

    const timeoutId = window.setTimeout(() => {
      void enforceSessionGuard()
    }, 0)

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void enforceSessionGuard()
      }
    }, SESSION_GUARD_POLL_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
    }
  }, [accountType, currentUserAuthId, currentUserEmail, redirectToLoginHard, resetDashboardProfile])

  useEffect(() => {
    if (!currentUserAuthId || accountType !== 'employee') return

    let cancelled = false
    let retryTimeoutId: number | null = null

    const channel = supabase.channel('dashboard-employee-presence', {
      config: {
        presence: {
          key: currentUserAuthId,
        },
      },
    })

    const syncPresence = () => {
      const state = channel.presenceState()
      setOnlineAuthIds(Object.keys(state).filter(Boolean))
    }

    const trackPresence = async (attempt = 0) => {
      const trackStatus = await channel.track({
        online_at: new Date().toISOString(),
      })

      if (cancelled) return

      if (trackStatus === 'ok') {
        syncPresence()
        return
      }

      if (trackStatus === 'timed out' && attempt < 2) {
        retryTimeoutId = window.setTimeout(() => {
          void trackPresence(attempt + 1)
        }, 400)
        return
      }

      if (trackStatus === 'timed out') {
        console.warn('Employee presence tracking timed out')
        return
      }

      console.error('Failed to track employee presence', trackStatus)
    }

    channel
      .on('presence', { event: 'sync' }, syncPresence)
      .on('presence', { event: 'join' }, syncPresence)
      .on('presence', { event: 'leave' }, syncPresence)
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return

        await trackPresence()
      })

    return () => {
      cancelled = true
      if (retryTimeoutId !== null) {
        window.clearTimeout(retryTimeoutId)
      }
      void channel.untrack()
      void supabase.removeChannel(channel)
    }
  }, [currentUserAuthId, accountType])

  useEffect(() => {
    if (accountType !== 'client' || !currentUserAuthId) {
      setChatMessageCount(0)
      return
    }

    let cancelled = false
    let intervalId: number | null = null
    let channel: ReturnType<typeof supabase.channel> | null = null

    const loadChatCount = async () => {
      const identifierFilters = [`auth_id.eq.${currentUserAuthId}`]
      if (currentUserEmail.trim()) {
        identifierFilters.push(`email.eq.${currentUserEmail.trim()}`)
      }

      const { data: clientRow } = await supabase
        .from('clients')
        .select('id')
        .eq('status', 'approved')
        .neq('isdeleted', true)
        .or(identifierFilters.join(','))
        .maybeSingle()

      const clientId = Number((clientRow as { id?: number } | null)?.id ?? 0)
      if (!Number.isFinite(clientId) || clientId < 1) {
        if (!cancelled) setChatMessageCount(0)
        return null
      }

      const { count, error } = await supabase
        .from('client_chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('isdeleted', false)
        .eq('read_by_client', false)
        .neq('sender_auth_id', currentUserAuthId)

      if (!cancelled && !error) {
        setChatMessageCount(count ?? 0)
      }

      return clientId
    }

    const setup = async () => {
      const clientId = await loadChatCount()
      if (!clientId || cancelled) return

      intervalId = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          void loadChatCount()
        }
      }, 5000)

      channel = supabase
        .channel(`client-chat-nav-count-${clientId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'client_chat_messages',
            filter: `client_id=eq.${clientId}`,
          },
          () => {
            void loadChatCount()
          }
        )
        .subscribe()

      if (cancelled) {
        if (channel) {
          void supabase.removeChannel(channel)
        }
      }
    }

    void setup()

    return () => {
      cancelled = true
      if (intervalId !== null) {
        window.clearInterval(intervalId)
      }
      if (channel) {
        void supabase.removeChannel(channel)
      }
    }
  }, [accountType, currentUserAuthId, currentUserEmail])

  async function handleLogout() {
    setProfileModalOpen(false)
    setProfileLoaded(false)

    const { error } = await supabase.auth.signOut({ scope: 'local' })

    if (error) {
      console.error('Failed to sign out', error)
      setProfileLoaded(true)
      return
    }

    resetDashboardProfile(false)
    redirectToLoginHard()
  }

  function resetProfileImageState(nextPreviewUrl: string) {
    if (profileObjectUrlRef.current) {
      URL.revokeObjectURL(profileObjectUrlRef.current)
      profileObjectUrlRef.current = null
    }
    setProfileImageFile(null)
    setProfileAvatarPreviewUrl(nextPreviewUrl)
  }

  function handleProfileImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null

    if (!file) {
      resetProfileImageState(displayAvatarUrl || '')
      return
    }

    if (!file.type.startsWith('image/')) {
      setProfileError('Profile image must be an image file.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileError('Profile image must be 5MB or smaller.')
      return
    }

    if (profileObjectUrlRef.current) {
      URL.revokeObjectURL(profileObjectUrlRef.current)
    }

    const objectUrl = URL.createObjectURL(file)
    profileObjectUrlRef.current = objectUrl
    setProfileError(null)
    setProfileImageFile(file)
    setProfileAvatarPreviewUrl(objectUrl)
  }

  function openProfileModal() {
    setProfileName(displayName || '')
    setProfileEmail(currentUserEmail || '')
    resetProfileImageState(displayAvatarUrl || '')
    setProfileError(null)
    setProfileSuccess(null)
    setProfileModalOpen(true)
  }

  function closeProfileModal() {
    if (profileSaving) return
    resetProfileImageState(displayAvatarUrl || '')
    setProfileModalOpen(false)
    setProfileError(null)
    setProfileSuccess(null)
  }

  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!currentUserAuthId || profileSaving) return

    const nextName = profileName.trim()
    const nextEmail = profileEmail.trim()
    let nextAvatarUrl = displayAvatarUrl.trim()

    if (!nextName) {
      setProfileError('Name is required.')
      return
    }

    if (!nextEmail) {
      setProfileError('Email is required.')
      return
    }

    setProfileSaving(true)
    setProfileError(null)
    setProfileSuccess(null)

    const emailChanged = nextEmail.toLowerCase() !== currentUserEmail.trim().toLowerCase()

    if (profileImageFile) {
      const extension = profileImageFile.name.split('.').pop()?.toLowerCase() || 'png'
      const filePath = `${currentUserAuthId}/avatar-${Date.now()}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from(PROFILE_AVATAR_BUCKET)
        .upload(filePath, profileImageFile, {
          upsert: true,
          contentType: profileImageFile.type,
          cacheControl: '3600',
        })

      if (uploadError) {
        setProfileSaving(false)
        setProfileError(uploadError.message)
        return
      }

      const { data: publicUrlData } = supabase.storage
        .from(PROFILE_AVATAR_BUCKET)
        .getPublicUrl(filePath)

      nextAvatarUrl = publicUrlData.publicUrl
    }

    const { error: authError } = await supabase.auth.updateUser({
      email: emailChanged ? nextEmail : undefined,
      data: {
        display_name: nextName,
        avatar_url: nextAvatarUrl || null,
      },
    })

    if (authError) {
      setProfileSaving(false)
      setProfileError(authError.message)
      return
    }

    if (accountType === 'employee') {
      const { error: employeeError } = await supabase
        .from('employees')
        .update({
          employee_name: nextName,
          email: nextEmail,
        })
        .eq('auth_id', currentUserAuthId)

      if (employeeError) {
        setProfileSaving(false)
        setProfileError(employeeError.message)
        return
      }
    }

    if (accountType === 'client') {
      const { error: clientError } = await supabase
        .from('clients') // change if your table name is different
        .update({
          client_name: nextName,
          email: nextEmail,
        })
        .eq('auth_id', currentUserAuthId)

      if (clientError) {
        setProfileSaving(false)
        setProfileError(clientError.message)
        return
      }
    }

    setDisplayName(nextName)
    setDisplayAvatarUrl(nextAvatarUrl)
    setCurrentUserEmail(nextEmail)
    resetProfileImageState(nextAvatarUrl)
    setProfileSaving(false)
    setProfileSuccess(
      emailChanged
        ? 'Profile updated. Check your email inbox to confirm the new email address.'
        : 'Profile updated successfully.'
    )

    await loadProfile()
  }

  useEffect(() => {
    return () => {
      if (profileObjectUrlRef.current) {
        URL.revokeObjectURL(profileObjectUrlRef.current)
      }
    }
  }, [])

  return (
    <DashboardProfileContext.Provider
      value={{
        displayName,
        displayRole,
        currentUserAuthId,
        currentEmployeeId,
        onlineAuthIds: accountType === 'employee' ? onlineAuthIds : [],
        accountType,
        profileLoaded,
      }}
    >
      <ClientDashboardDataProvider key={`${currentUserAuthId ?? 'anonymous'}:${accountType ?? 'none'}`}>
      <div
        id="dashboard-root-shell"
        className={`${plusJakarta.className} relative flex min-h-screen w-full bg-gray-900 text-white`}
      >
        <DashboardOverlay
          profileLoaded={profileLoaded}
          accountType={accountType}
        />

        <aside
          className={`fixed left-0 top-0 z-20 flex h-screen flex-col border-r border-slate-800 bg-[#0b1323] transition-[width] duration-200 ease-out xl:sticky xl:left-auto xl:top-0 xl:z-auto xl:shrink-0 ${sidebarCollapsed ? 'w-12 sm:w-14 md:w-20' : 'w-full md:w-64'}`}
        >
          <div className="flex items-center justify-center gap-2 overflow-hidden p-6 md:p-8">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md sm:h-7 sm:w-7 md:h-8 md:w-8 md:rounded-lg xl:h-9 xl:w-9">
              <img src="/bmybrand-B.svg" alt="Brand Logo" className="h-full w-full object-contain" />
            </div>
            <span
              className={`truncate text-lg font-extrabold leading-6 transition-[opacity,max-width] duration-200 md:text-xl md:leading-7 ${sidebarCollapsed ? 'w-0 max-w-0 opacity-0' : 'opacity-100 delay-200'}`}
            >
              Invoice <span className="text-orange-500">CRM</span>
            </span>
          </div>

          <nav
            className={`flex flex-1 flex-col gap-0.5 overflow-hidden ${sidebarCollapsed ? 'items-center px-1 py-1.5 sm:px-1.5 sm:py-2' : 'gap-1 px-3 sm:px-4'}`}
          >
            {visibleNavItems.map((item) => {
              const active = pathname === item.href

              return active ? (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center justify-start gap-2 rounded-md border-l-4 border-orange-500 bg-linear-to-r from-orange-500/20 to-orange-500/0 py-2 sm:gap-3 sm:rounded-lg sm:py-2.5 md:rounded-xl md:py-3 ${sidebarCollapsed ? 'justify-center px-1 sm:px-1.5' : 'px-3 sm:px-4'}`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <span className="relative h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 lg:h-5 lg:w-5 [&_svg]:block [&_svg]:h-full! [&_svg]:w-full!">
                    <NavIcon label={item.label} active={!!active} />
                    {item.label === 'Chat' && chatMessageCount > 0 && sidebarCollapsed ? (
                      <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-black leading-none text-white">
                        {chatMessageCount > 99 ? '99+' : chatMessageCount}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`truncate text-sm font-bold leading-5 text-orange-500 transition-opacity duration-200 md:text-base md:leading-6 ${sidebarCollapsed ? 'max-w-0 opacity-0' : 'opacity-100 delay-200'}`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span>{item.label}</span>
                      {item.label === 'Chat' && chatMessageCount > 0 ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-black leading-none text-white">
                          {chatMessageCount > 99 ? '99+' : chatMessageCount}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </Link>
              ) : (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center justify-start gap-2 rounded-md py-2 hover:bg-white/5 sm:rounded-lg sm:py-2.5 md:rounded-xl md:py-3 ${sidebarCollapsed ? 'justify-center px-1 sm:px-1.5' : 'px-3 sm:px-4'}`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <span className="relative h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 lg:h-5 lg:w-5 [&_svg]:block [&_svg]:h-full! [&_svg]:w-full!">
                    <NavIcon label={item.label} active={!!active} />
                    {item.label === 'Chat' && chatMessageCount > 0 && sidebarCollapsed ? (
                      <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-black leading-none text-white">
                        {chatMessageCount > 99 ? '99+' : chatMessageCount}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`truncate text-sm font-normal leading-5 text-slate-400 transition-opacity duration-200 md:text-base md:leading-6 ${sidebarCollapsed ? 'max-w-0 opacity-0' : 'opacity-100 delay-200'}`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span>{item.label}</span>
                      {item.label === 'Chat' && chatMessageCount > 0 ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-black leading-none text-white">
                          {chatMessageCount > 99 ? '99+' : chatMessageCount}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </Link>
              )
            })}
          </nav>

          <div className="p-3 sm:p-4 md:p-6">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="mb-1 flex w-full items-center justify-center rounded-md border border-slate-700/50 bg-slate-800/50 p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white sm:mb-1.5 sm:rounded-lg sm:p-2 md:mb-2 md:rounded-xl md:p-2.5"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <ChevronRightIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 lg:h-5 lg:w-5" />
              ) : (
                <ChevronLeftIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 lg:h-5 lg:w-5" />
              )}
            </button>

            <button
              onClick={handleLogout}
              className={`flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-700/50 bg-slate-800/50 p-1.5 text-xs font-bold leading-4 text-white transition hover:bg-slate-800 sm:gap-2 sm:rounded-lg sm:p-2 sm:text-sm sm:leading-5 md:rounded-xl md:leading-6 ${sidebarCollapsed ? '' : 'px-2.5 py-2 sm:px-3 sm:py-2.5 md:px-4 md:py-3'}`}
              title={sidebarCollapsed ? 'Log Out' : undefined}
            >
              <span className="flex h-5 w-5 items-center justify-center">
                <LogoutIcon />
              </span>
              <span
                className={`truncate transition-opacity duration-200 ${sidebarCollapsed ? 'max-w-0 opacity-0' : 'opacity-100 delay-200'}`}
              >
                Log Out
              </span>
            </button>
          </div>
        </aside>

        <div
          id="dashboard-main-shell"
          className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-gray-900 pl-12 sm:pl-14 md:pl-20 xl:pl-0"
        >
          <header className="absolute left-0 top-0 z-10 flex h-20 w-full items-center justify-between border-b border-slate-800 bg-gray-900 pl-12 pr-4 backdrop-blur-md sm:pl-14 sm:pr-6 md:pl-20 md:pr-8 xl:px-8">
            <div className="flex items-center gap-3 pl-2 sm:pl-0">
              <span className="text-[10px] font-bold uppercase leading-4 tracking-tight text-white sm:text-xs md:text-sm">
                {headerTitle}
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              {accountType === 'employee' && (() => {
                const r = (displayRole || '').trim().toLowerCase().replace(/\s+/g, '')
                return r === 'admin' || r === 'superadmin'
              })() && (
                <NotificationsBell />
              )}
              <button
                type="button"
                onClick={openProfileModal}
                className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-left transition hover:border-slate-700 hover:bg-slate-800/80 sm:gap-3 sm:px-3 sm:py-2"
                title="Edit your profile"
              >
                <div className="relative shrink-0">
                  <img
                    src={displayAvatarUrl || 'https://placehold.co/40x40'}
                    alt=""
                    className="h-8 w-8 rounded-lg object-cover shadow-[0px_0px_0px_2px_rgba(59,130,246,0.35)] sm:h-9 sm:w-9"
                  />
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-gray-900 bg-green-500 sm:h-3 sm:w-3" />
                </div>

                <div className="min-w-0 max-w-40 sm:max-w-50">
                  <p className="truncate text-xs font-bold leading-4 text-white sm:text-sm sm:leading-5">
                    {displayName || 'User'}
                  </p>
                  <p className="truncate text-[9px] font-black uppercase leading-3 tracking-wide text-slate-500 sm:text-[10px] sm:leading-4">
                    {displayRole || '-'}
                  </p>
                </div>
              </button>

              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-2 py-1.5 sm:gap-3 sm:px-4 sm:py-2">
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 sm:h-2 sm:w-2" />
                  <span className="text-[10px] font-bold leading-4 text-slate-400 sm:text-xs">
                    {accountType === 'client' ? 'Client Portal' : 'System Online'}
                  </span>
                </div>
                <div className="h-3 w-px bg-slate-700 sm:h-4" />
                <span className="text-[10px] font-bold leading-4 text-slate-400 sm:text-xs">
                  {currentTime || '--'}
                </span>
              </div>
            </div>
          </header>

          <main
            id="dashboard-main-content"
            className="flex-1 overflow-auto p-4 pt-24 sm:p-6 sm:pt-28 md:p-8 md:pt-28"
          >
            {children}
          </main>
        </div>

        {profileModalOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
            <div
              className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeProfileModal}
                disabled={profileSaving}
                aria-label="Close profile editor"
                className="absolute right-4 top-4 rounded-full border border-orange-500/30 bg-orange-500/10 p-2 text-orange-400 transition hover:bg-orange-500/20 hover:text-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CloseIcon />
              </button>

              <h2 className="text-lg font-bold text-white">My Profile</h2>
              <p className="mt-1 text-sm text-slate-400">
                Update your own name, email, and profile image.
              </p>

              <form
                onSubmit={handleProfileSubmit}
                onInvalidCapture={handleRequiredFieldInvalid}
                onInputCapture={clearRequiredFieldInvalid}
                onChangeCapture={clearRequiredFieldInvalid}
                className="mt-5 flex flex-col gap-4"
              >
                <div className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                  <img
                    src={profileAvatarPreviewUrl || displayAvatarUrl || 'https://placehold.co/80x80'}
                    alt=""
                    className="h-16 w-16 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <label htmlFor="profile-avatar-upload" className="block text-sm font-medium text-slate-300">
                      Profile Image
                    </label>
                    <input
                      id="profile-avatar-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleProfileImageChange}
                      className="mt-2 block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-orange-600"
                    />
                    <p className="mt-2 text-xs text-slate-500">Upload PNG, JPG, WEBP, or GIF up to 5MB.</p>
                  </div>
                </div>

                <div>
                  <label htmlFor="profile-name" className="block text-sm font-medium text-slate-300">
                    Name
                  </label>
                  <input
                    id="profile-name"
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    required
                    placeholder="Full name"
                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>

                <div>
                  <label htmlFor="profile-email" className="block text-sm font-medium text-slate-300">
                    Email
                  </label>
                  <input
                    id="profile-email"
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    required
                    placeholder="name@company.com"
                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>

                <div>
                  <label htmlFor="profile-role" className="block text-sm font-medium text-slate-300">
                    Role
                  </label>
                  <input
                    id="profile-role"
                    type="text"
                    value={displayRole || '-'}
                    readOnly
                    className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3 text-slate-500"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Role is managed separately and cannot be changed here.
                  </p>
                </div>

                {profileError && (
                  <p className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {profileError}
                  </p>
                )}

                {profileSuccess && (
                  <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                    {profileSuccess}
                  </p>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 sm:w-auto sm:min-w-37"
                  >
                    {profileSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      </ClientDashboardDataProvider>
    </DashboardProfileContext.Provider>
  )
}





