import { useAuth } from '@/features/auth/hooks/use-auth-context'
import { useQuery } from '@tanstack/react-query'
import { getExpenseSummary } from '@/features/expenses/services/expense.service'
import { getInventorySummary } from '@/features/inventory/services/inventory.service'
import { getBillsSummary } from '@/features/bills/services/bills.service'
import {
  IndianRupee, ShoppingBasket, Flame, Droplets, FileText,
  Car, Wrench, HeartPulse, FolderLock, Bell, TrendingUp,
  AlertTriangle, CheckCircle2, Clock, ChevronRight, Home,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

// ── Module cards definition ─────────────────────────────────────────────────
const MODULES = [
  {
    to: '/expenses',
    icon: IndianRupee,
    label: 'Expenses',
    description: 'Track monthly household spending',
    color: 'bg-blue-500',
    light: 'bg-blue-50 dark:bg-blue-950',
    textColor: 'text-blue-600 dark:text-blue-400',
    status: 'ready',
    statusText: 'Start tracking',
  },
  {
    to: '/inventory',
    icon: ShoppingBasket,
    label: 'Grocery Inventory',
    description: 'Rice, dal, oil & pantry items',
    color: 'bg-green-500',
    light: 'bg-green-50 dark:bg-green-950',
    textColor: 'text-green-600 dark:text-green-400',
    status: 'ready',
    statusText: 'Add items',
  },
  {
    to: '/gas',
    icon: Flame,
    label: 'Gas Cylinder',
    description: 'Track refills & predict next date',
    color: 'bg-orange-500',
    light: 'bg-orange-50 dark:bg-orange-950',
    textColor: 'text-orange-600 dark:text-orange-400',
    status: 'ready',
    statusText: 'Log refill',
  },
  {
    to: '/water',
    icon: Droplets,
    label: 'Water Can',
    description: 'Delivery history & stock estimate',
    color: 'bg-cyan-500',
    light: 'bg-cyan-50 dark:bg-cyan-950',
    textColor: 'text-cyan-600 dark:text-cyan-400',
    status: 'ready',
    statusText: 'Add delivery',
  },
  {
    to: '/bills',
    icon: FileText,
    label: 'Bill Manager',
    description: 'Electricity, internet & subscriptions',
    color: 'bg-purple-500',
    light: 'bg-purple-50 dark:bg-purple-950',
    textColor: 'text-purple-600 dark:text-purple-400',
    status: 'ready',
    statusText: 'Add bill',
  },
  {
    to: '/vehicles',
    icon: Car,
    label: 'Vehicles',
    description: 'Insurance, PUC & service history',
    color: 'bg-slate-500',
    light: 'bg-slate-50 dark:bg-slate-950',
    textColor: 'text-slate-600 dark:text-slate-400',
    status: 'ready',
    statusText: 'Add vehicle',
  },
  {
    to: '/appliances',
    icon: Wrench,
    label: 'Appliances',
    description: 'Warranty & service tracking',
    color: 'bg-yellow-500',
    light: 'bg-yellow-50 dark:bg-yellow-950',
    textColor: 'text-yellow-600 dark:text-yellow-400',
    status: 'ready',
    statusText: 'Add appliance',
  },
  {
    to: '/health',
    icon: HeartPulse,
    label: 'Health',
    description: 'Medicine, vaccines & checkups',
    color: 'bg-rose-500',
    light: 'bg-rose-50 dark:bg-rose-950',
    textColor: 'text-rose-600 dark:text-rose-400',
    status: 'ready',
    statusText: 'Add reminder',
  },
  {
    to: '/documents',
    icon: FolderLock,
    label: 'Document Vault',
    description: 'Aadhaar, PAN, insurance & more',
    color: 'bg-indigo-500',
    light: 'bg-indigo-50 dark:bg-indigo-950',
    textColor: 'text-indigo-600 dark:text-indigo-400',
    status: 'ready',
    statusText: 'Upload doc',
  },
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ── Quick Stat Card ─────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub: string
  color: string
}) {
  return (
    <div className="bg-card border rounded-xl p-4 flex items-start gap-3">
      <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${color} shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  )
}

// ── Module Card ─────────────────────────────────────────────────────────────
function ModuleCard({
  to, icon: Icon, label, description, light, textColor, statusText,
}: {
  to: string; icon: React.ElementType; label: string; description: string
  color: string; light: string; textColor: string; status: string; statusText: string
}) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(to)}
      className="bg-card border rounded-xl p-4 text-left hover:shadow-md hover:border-primary/30 transition-all group w-full"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${light}`}>
          <Icon className={`w-5 h-5 ${textColor}`} />
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      <p className="font-semibold text-sm">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5 mb-3">{description}</p>
      <span className={`text-xs font-medium ${textColor}`}>{statusText} →</span>
    </button>
  )
}

// ── Main Dashboard ──────────────────────────────────────────────────────────
export function DashboardPage() {
  const { profile, activeHousehold } = useAuth()
  const navigate = useNavigate()
  const hId = activeHousehold?.id ?? ''
  const now = new Date()
  const monthName = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  const { data: summary } = useQuery({
    queryKey: ['expenses-summary', hId, now.getMonth() + 1, now.getFullYear()],
    queryFn: () => getExpenseSummary({ household_id: hId, month: now.getMonth() + 1, year: now.getFullYear() }),
    enabled: !!hId,
  })

  const { data: invSummary } = useQuery({
    queryKey: ['inventory-summary', hId],
    queryFn: () => getInventorySummary(hId),
    enabled: !!hId,
  })

  const { data: billsSummary } = useQuery({
    queryKey: ['bills-summary', hId],
    queryFn: () => getBillsSummary(hId),
    enabled: !!hId,
  })

  const totalExpenses  = summary?.total ?? 0
  const lowStockCount  = invSummary?.low_stock_count ?? 0
  const billsDue       = (billsSummary?.due_in_30_days ?? 0) + (billsSummary?.overdue ?? 0)
  const fmtAmount = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">

      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-5 text-primary-foreground">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm opacity-80">{getGreeting()},</p>
            <h1 className="text-2xl font-bold mt-0.5">{profile?.name?.split(' ')[0] ?? 'there'}! 👋</h1>
            <div className="flex items-center gap-1.5 mt-2 opacity-90">
              <Home className="w-3.5 h-3.5" />
              <span className="text-sm">{activeHousehold?.name ?? 'Your Household'}</span>
            </div>
          </div>
          <div className="text-right opacity-80">
            <p className="text-xs">Today</p>
            <p className="text-sm font-medium">
              {now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </p>
          </div>
        </div>

        {/* Setup progress bar */}
        <div className="mt-4 bg-white/20 rounded-full h-1.5">
          <div className="bg-white h-1.5 rounded-full" style={{ width: '10%' }} />
        </div>
        <p className="text-xs mt-1.5 opacity-75">
          Household setup: 10% complete — start adding your data below
        </p>
      </div>

      {/* Quick stats */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          {monthName} Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={IndianRupee}
            label="This Month"
            value={fmtAmount(totalExpenses)}
            sub={totalExpenses > 0 ? `${summary?.categories?.length ?? 0} categories` : 'No expenses yet'}
            color="bg-blue-500"
          />
          <StatCard
            icon={AlertTriangle}
            label="Low Stock"
            value={String(lowStockCount)}
            sub={lowStockCount > 0 ? 'Items need restocking' : 'All items OK'}
            color="bg-amber-500"
          />
          <StatCard
            icon={Clock}
            label="Bills Due"
            value={String(billsDue)}
            sub={billsDue > 0 ? `${billsSummary?.overdue ?? 0} overdue` : 'Next 30 days'}
            color="bg-purple-500"
          />
          <StatCard
            icon={Bell}
            label="Reminders"
            value="0"
            sub="No pending alerts"
            color="bg-rose-500"
          />
        </div>
      </div>

      {/* Getting started banner (shown until data exists) */}
      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex gap-3">
        <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Account created successfully! 🎉
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
            Start by adding your monthly expenses or grocery inventory below.
            Your dashboard will show live stats as you add data.
          </p>
        </div>
      </div>

      {/* Module grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            All Modules
          </h2>
          <span className="text-xs text-muted-foreground">{MODULES.length} available</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {MODULES.map((mod) => (
            <ModuleCard key={mod.to} {...mod} />
          ))}
        </div>
      </div>

      {/* Quick tips */}
      <div className="border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Suggested first steps</h2>
        </div>
        <div className="space-y-2">
          {[
            { step: '1', text: 'Add this month\'s expenses', to: '/expenses' },
            { step: '2', text: 'Set up grocery inventory with current stock', to: '/inventory' },
            { step: '3', text: 'Add upcoming bills with due dates', to: '/bills' },
            { step: '4', text: 'Register your vehicles for service reminders', to: '/vehicles' },
          ].map(({ step, text, to }) => (
              <button
                key={step}
                onClick={() => navigate(to)}
                className="flex items-center gap-3 w-full text-left hover:bg-accent rounded-lg p-2 transition-colors group"
              >
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                  {step}
                </span>
                <span className="text-sm flex-1">{text}</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}



