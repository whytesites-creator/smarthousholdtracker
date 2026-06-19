import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, IndianRupee, ShoppingBasket, Flame, Droplets,
  FileText, Car, Wrench, HeartPulse, FolderLock, Bell,
  User, LogOut, Menu, X, ChevronDown, Users, Home,
} from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/use-auth-context'
import { logout } from '@/features/auth/services/auth.service'
import { useToast } from '@/hooks/use-toast'
import { HouseholdSwitcher } from '@/features/auth/components/HouseholdSwitcher'

const NAV_ITEMS = [
  { to: '/dashboard',          icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/expenses',           icon: IndianRupee,     label: 'Expenses' },
  { to: '/inventory',          icon: ShoppingBasket,  label: 'Inventory' },
  { to: '/gas',                icon: Flame,           label: 'Gas Cylinder' },
  { to: '/water',              icon: Droplets,        label: 'Water Can' },
  { to: '/bills',              icon: FileText,        label: 'Bills' },
  { to: '/vehicles',           icon: Car,             label: 'Vehicles' },
  { to: '/appliances',         icon: Wrench,          label: 'Appliances' },
  { to: '/health',             icon: HeartPulse,      label: 'Health' },
  { to: '/documents',          icon: FolderLock,      label: 'Documents' },
  { to: '/notifications',      icon: Bell,            label: 'Notifications' },
]

// Bottom nav shows only the most used items on mobile
const BOTTOM_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { to: '/expenses',  icon: IndianRupee,     label: 'Expenses' },
  { to: '/inventory', icon: ShoppingBasket,  label: 'Inventory' },
  { to: '/bills',     icon: FileText,        label: 'Bills' },
  { to: '/profile',   icon: User,            label: 'Profile' },
]

export function AppShell() {
  const { profile, activeHousehold } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch {
      toast({ variant: 'destructive', title: 'Logout failed', description: 'Please try again.' })
    }
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
    }`

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 py-4 border-b">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary shrink-0">
          <Home className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-bold text-sm leading-tight">Smart Household<br/>Tracker</span>
      </div>

      {/* Household switcher */}
      <div className="px-3 py-3 border-b">
        <HouseholdSwitcher />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={navLinkClass} onClick={() => setSidebarOpen(false)}>
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Profile footer */}
      <div className="border-t p-3">
        <NavLink to="/profile" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
          <User className="w-4 h-4 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="truncate font-medium text-xs">{profile?.name ?? 'Profile'}</p>
            <p className="truncate text-xs opacity-60">{profile?.email}</p>
          </div>
        </NavLink>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors w-full mt-1"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex w-60 flex-col border-r bg-card shrink-0">
        <SidebarContent />
      </aside>

      {/* ── Mobile Sidebar Overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-card border-r overflow-y-auto">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card shrink-0">
          <button onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5">
            <Home className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">
              {activeHousehold?.name ?? 'Smart Household'}
            </span>
          </div>
          <div className="relative">
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold text-sm"
            >
              {profile?.name?.[0]?.toUpperCase() ?? 'U'}
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-popover border rounded-lg shadow-lg py-1 z-50">
                <NavLink
                  to="/profile"
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                  onClick={() => setProfileOpen(false)}
                >
                  <User className="w-4 h-4" /> Profile
                </NavLink>
                <NavLink
                  to="/household/members"
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                  onClick={() => setProfileOpen(false)}
                >
                  <Users className="w-4 h-4" /> Members
                </NavLink>
                <hr className="my-1" />
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 w-full text-left"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>

        {/* ── Mobile Bottom Nav ── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t flex z-40">
          {BOTTOM_NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

