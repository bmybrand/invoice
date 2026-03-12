'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { supabase } from '@/lib/supabase'

const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'] })

type DashboardProfile = { displayName: string; displayRole: string }
const DashboardProfileContext = createContext<DashboardProfile>({ displayName: '', displayRole: '' })
export function useDashboardProfile() {
  return useContext(DashboardProfileContext)
}

const navItems: Array<{ label: string; href: string }> = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Employees', href: '/dashboard/employees' },
  { label: 'Brand Identity', href: '/dashboard/brands' },
  { label: 'Invoice', href: '/dashboard/invoices' },
  { label: 'Payment', href: '/dashboard/payments' },
  { label: 'Settings', href: '/dashboard/settings' },
]

function GridIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M3 6a3 3 0 013-3h2.25a3 3 0 013 3v2.25a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm9.75 0a3 3 0 013-3H18a3 3 0 013 3v2.25a3 3 0 01-3 3h-2.25a3 3 0 01-3-3V6zM3 15.75a3 3 0 013-3h2.25a3 3 0 013 3V18a3 3 0 01-3 3H6a3 3 0 01-3-3v-2.25zm9.75 0a3 3 0 013-3H18a3 3 0 013 3V18a3 3 0 01-3 3h-2.25a3 3 0 01-3-3v-2.25z" clipRule="evenodd" />
    </svg>
  )
}

function UsersIcon({ className = 'h-5 w-4 text-slate-400' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z" />
    </svg>
  )
}

function StarIcon({ className = 'h-5 w-5 text-slate-400' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  )
}

function DollarIcon({ className = 'h-5 w-5 text-slate-400' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function GearIcon({ className = 'h-5 w-5 text-slate-400' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function LightningIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd" />
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

function NavIcon({ label, active }: { label: string; active: boolean }) {
  const iconClass = active ? 'text-orange-500' : 'text-slate-400'
  const sizeClass = 'h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 lg:h-5 lg:w-5'
  const className = `${sizeClass} ${iconClass}`
  switch (label) {
    case 'Dashboard': return <GridIcon className={className} />
    case 'Employees': return <UsersIcon className={className} />
    case 'Brand Identity': return <StarIcon className={className} />
    case 'Invoice': return <DollarIcon className={className} />
    case 'Payment': return <DollarIcon className={className} />
    case 'Settings': return <GearIcon className={className} />
    default: return <GridIcon className={className} />
  }
}

export function DashboardLayout({ children, title }: { children: React.ReactNode; title?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [profileCentered, setProfileCentered] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [displayRole, setDisplayRole] = useState('')
  const currentTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  const headerTitle = title ?? (pathname === '/dashboard' ? 'Analytics Center' : pathname === '/dashboard/employees' ? 'Employees' : pathname === '/dashboard/brands' ? 'Brand Identity' : pathname === '/dashboard/invoices' ? 'Invoice' : pathname === '/dashboard/payments' ? 'Payment' : pathname === '/dashboard/settings' ? 'Settings' : pathname.startsWith('/dashboard/') ? pathname.split('/').filter(Boolean).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' / ') : 'Analytics Center')

  useEffect(() => {
    if (sidebarCollapsed) {
      const t = setTimeout(() => setProfileCentered(true), 200)
      return () => clearTimeout(t)
    } else {
      setProfileCentered(false)
    }
  }, [sidebarCollapsed])

  useEffect(() => {
    async function loadProfile() {
      let user = (await supabase.auth.getSession()).data.session?.user
      if (!user) {
        const { data: { user: u } } = await supabase.auth.getUser()
        user = u ?? undefined
      }
      if (!user?.id) {
        setDisplayName('')
        setDisplayRole('')
        return
      }
      const { data, error } = await supabase
        .from('employees')
        .select('employee_name, role')
        .eq('auth_id', user.id)
        .maybeSingle()
      if (error) {
        setDisplayName(user.email ?? 'User')
        setDisplayRole('')
        return
      }
      const row = data as { employee_name?: string; role?: string } | null
      setDisplayName(row?.employee_name ?? user.email ?? 'User')
      setDisplayRole(row?.role ? String(row.role).charAt(0).toUpperCase() + String(row.role).slice(1).toLowerCase() : '')
    }
    loadProfile()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        loadProfile()
      } else if (event === 'SIGNED_OUT') {
        setDisplayName('')
        setDisplayRole('')
        router.replace('/login')
      } else {
        setDisplayName('')
        setDisplayRole('')
      }
    })

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') loadProfile()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    const pollInterval = setInterval(loadProfile, 5000)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearInterval(pollInterval)
    }
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut({ scope: 'local' })
    router.push('/login')
  }

  return (
    <DashboardProfileContext.Provider value={{ displayName, displayRole }}>
    <div id="dashboard-root-shell" className={`${plusJakarta.className} flex min-h-screen w-full bg-gray-900 text-white`}>
      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 z-20 flex h-screen flex-col border-r border-slate-800 bg-[#0b1323] transition-[width] duration-200 ease-out xl:sticky xl:top-0 xl:left-auto xl:z-auto xl:shrink-0 ${sidebarCollapsed ? 'w-12 sm:w-14 md:w-20' : 'w-full md:w-64'}`}>
        <div className={`flex items-center justify-center overflow-hidden p-4 ${sidebarCollapsed ? 'gap-0 p-2 sm:p-3' : 'gap-2 p-6 md:p-8'}`}>
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-orange-500 text-white sm:h-7 sm:w-7 md:h-8 md:w-8 md:rounded-lg xl:h-9 xl:w-9">
            <LightningIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-5 xl:h-5 xl:w-5" />
          </div>
          <span className={`truncate text-lg font-extrabold leading-6 transition-[opacity,max-width] duration-200 md:text-xl md:leading-7 ${sidebarCollapsed ? 'w-0 max-w-0 opacity-0' : 'opacity-100 delay-200'}`}>
            Invoice <span className="text-orange-500">CRM</span>
          </span>
        </div>
        <div className={`${sidebarCollapsed ? 'flex px-1 pb-2 sm:px-1.5 sm:pb-3' : 'px-3 pb-3 sm:px-4 sm:pb-4 md:px-6 md:pb-6'} ${profileCentered ? 'justify-center' : ''}`}>
          <div className={`flex items-center rounded-lg border border-slate-800 bg-slate-900/50 p-1.5 transition-[justify-content] duration-200 sm:rounded-xl sm:p-2 md:rounded-2xl md:p-3 ${profileCentered ? 'justify-center gap-0' : sidebarCollapsed ? 'gap-0' : 'gap-2 md:gap-3'}`}>
            <div className="relative shrink-0">
              <img src="https://placehold.co/40x40" alt="" className="h-6 w-6 rounded-md shadow-[0px_0px_0px_2px_rgba(59,130,246,0.50)] sm:h-7 sm:w-7 sm:rounded-lg md:h-8 md:w-8 md:rounded-xl lg:h-10 lg:w-10 xl:h-11 xl:w-11" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-gray-900 bg-green-500 sm:h-3 sm:w-3 md:-right-1 md:-top-1 md:h-4 md:w-4" />
            </div>
            <div className={`overflow-hidden transition-[opacity,max-width] duration-200 ${sidebarCollapsed ? 'w-0 max-w-0 opacity-0' : 'min-w-0 flex-1 opacity-100 delay-200'}`}>
              <p className="truncate text-xs font-bold leading-4 text-white md:text-sm md:leading-5">{displayName || 'User'}</p>
              <p className="truncate text-[9px] font-black uppercase leading-3 tracking-wide text-slate-500 md:text-[10px] md:leading-4">{displayRole || '-'}</p>
            </div>
          </div>
        </div>
        <nav className={`flex flex-1 flex-col gap-0.5 overflow-hidden ${sidebarCollapsed ? 'items-center px-1 py-1.5 sm:px-1.5 sm:py-2' : 'gap-1 px-3 sm:px-4'}`}>
          {navItems.map((item) => {
            const active = pathname === item.href

            return active ? (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center justify-start gap-2 rounded-md py-2 border-l-4 border-orange-500 bg-gradient-to-r from-orange-500/20 to-orange-500/0 sm:gap-3 sm:rounded-lg sm:py-2.5 md:rounded-xl md:py-3 ${sidebarCollapsed ? 'justify-center px-1 sm:px-1.5' : 'px-3 sm:px-4'}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 lg:h-5 lg:w-5 [&_svg]:!h-full [&_svg]:!w-full [&_svg]:block"><NavIcon label={item.label} active={!!active} /></span>
                <span className={`truncate text-sm font-bold leading-5 text-orange-500 transition-opacity duration-200 md:text-base md:leading-6 ${sidebarCollapsed ? 'max-w-0 opacity-0' : 'opacity-100 delay-200'}`}>{item.label}</span>
              </Link>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center justify-start gap-2 rounded-md py-2 hover:bg-white/5 sm:rounded-lg sm:py-2.5 md:rounded-xl md:py-3 ${sidebarCollapsed ? 'justify-center px-1 sm:px-1.5' : 'px-3 sm:px-4'}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 lg:h-5 lg:w-5 [&_svg]:!h-full [&_svg]:!w-full [&_svg]:block"><NavIcon label={item.label} active={!!active} /></span>
                <span className={`truncate text-sm font-normal leading-5 text-slate-400 transition-opacity duration-200 md:text-base md:leading-6 ${sidebarCollapsed ? 'max-w-0 opacity-0' : 'opacity-100 delay-200'}`}>{item.label}</span>
              </Link>
            )
          })}
        </nav>
        <div className={`p-2 ${sidebarCollapsed ? 'p-1 sm:p-1.5' : 'p-3 sm:p-4 md:p-6'}`}>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="mb-1 flex w-full items-center justify-center rounded-md border border-slate-700/50 bg-slate-800/50 p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white sm:mb-1.5 sm:rounded-lg sm:p-2 md:mb-2 md:rounded-xl md:p-2.5"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRightIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 lg:h-5 lg:w-5" /> : <ChevronLeftIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 lg:h-5 lg:w-5" />}
          </button>
          <button
            onClick={handleLogout}
            className={`flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-700/50 bg-slate-800/50 p-1.5 text-xs font-bold leading-4 text-white transition hover:bg-slate-800 sm:gap-2 sm:rounded-lg sm:p-2 sm:text-sm sm:leading-5 md:rounded-xl md:leading-6 ${sidebarCollapsed ? '' : 'px-2.5 py-2 sm:px-3 sm:py-2.5 md:px-4 md:py-3'}`}
            title={sidebarCollapsed ? 'Log Out' : undefined}
          >
            <LogoutIcon />
            <span className={`truncate transition-opacity duration-200 ${sidebarCollapsed ? 'max-w-0 opacity-0' : 'opacity-100 delay-200'}`}>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main - full width; left padding when sidebar overlays */}
      <div id="dashboard-main-shell" className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-gray-900 pl-12 sm:pl-14 md:pl-20 xl:pl-0">
        {/* Top header bar */}
        <header className="absolute left-0 top-0 z-10 flex h-20 w-full items-center justify-between border-b border-slate-800 bg-gray-900 pl-12 pr-4 backdrop-blur-md sm:pl-14 sm:pr-6 md:pl-20 md:pr-8 xl:px-8">
          <div className="flex items-center gap-3 pl-2 sm:pl-0">
            <span className="text-[10px] font-bold uppercase leading-4 tracking-tight text-white sm:text-xs md:text-sm">{headerTitle}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-2 py-1.5 sm:gap-3 sm:px-4 sm:py-2">
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 sm:h-2 sm:w-2" />
                <span className="text-[10px] font-bold leading-4 text-slate-400 sm:text-xs">System Online</span>
              </div>
              <div className="h-3 w-px bg-slate-700 sm:h-4" />
              <span className="text-[10px] font-bold leading-4 text-slate-400 sm:text-xs">{currentTime}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main id="dashboard-main-content" className="flex-1 overflow-auto p-4 pt-24 sm:p-6 sm:pt-28 md:p-8 md:pt-28">
          {children}
        </main>
      </div>
    </div>
    </DashboardProfileContext.Provider>
  )
}
