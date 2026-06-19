import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Minus, Filter } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/use-auth-context'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { ExpenseFormModal } from './ExpenseFormModal'
import {
  listExpenses, createExpense, updateExpense, deleteExpense, getExpenseSummary,
  EXPENSE_CATEGORIES, CATEGORY_LABELS, CATEGORY_COLORS, CATEGORY_ICONS,
  type Expense, type CreateExpenseInput,
} from '../services/expense.service'

function fmt(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

export function ExpensesPage() {
  const { activeHousehold } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const hId = activeHousehold?.id ?? ''

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year,  setYear]  = useState(now.getFullYear())
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)

  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to   = `${year}-${String(month).padStart(2, '0')}-31`

  // ── Data queries ──────────────────────────────────────────────────────────
  const { data: expensesData, isLoading } = useQuery({
    queryKey: ['expenses', hId, month, year, categoryFilter],
    queryFn: () => listExpenses({
      household_id: hId, from, to,
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
    }),
    enabled: !!hId,
  })

  const { data: summary } = useQuery({
    queryKey: ['expenses-summary', hId, month, year],
    queryFn: () => getExpenseSummary({ household_id: hId, month, year }),
    enabled: !!hId,
  })

  // ── Mutations ─────────────────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['expenses', hId] })
    qc.invalidateQueries({ queryKey: ['expenses-summary', hId] })
  }

  const createMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: () => { invalidate(); toast({ title: 'Expense added ✓' }) },
    onError: () => toast({ variant: 'destructive', title: 'Failed to add expense' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateExpenseInput> }) =>
      updateExpense(id, data),
    onSuccess: () => { invalidate(); toast({ title: 'Expense updated ✓' }) },
    onError: () => toast({ variant: 'destructive', title: 'Failed to update' }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => { invalidate(); toast({ title: 'Expense deleted' }) },
    onError: () => toast({ variant: 'destructive', title: 'Failed to delete' }),
  })

  const handleSave = async (data: CreateExpenseInput) => {
    if (editingExpense) {
      await updateMutation.mutateAsync({ id: editingExpense.id, data })
    } else {
      await createMutation.mutateAsync(data)
    }
    setEditingExpense(null)
  }

  // ── Month navigation ──────────────────────────────────────────────────────
  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()

  const monthLabel = new Date(year, month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const expenses = expensesData?.items ?? []

  // MoM change
  const diff    = (summary?.total ?? 0) - (summary?.prevMonthTotal ?? 0)
  const diffPct = summary?.prevMonthTotal
    ? Math.abs(Math.round((diff / summary.prevMonthTotal) * 100))
    : 0

  if (!hId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Please select a household first.
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Expenses</h1>
          <p className="text-sm text-muted-foreground">{activeHousehold?.name}</p>
        </div>
        <Button onClick={() => { setEditingExpense(null); setShowModal(true) }} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      {/* Month navigation + summary */}
      <div className="bg-card border rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-accent">‹</button>
          <span className="font-semibold">{monthLabel}</span>
          <button onClick={nextMonth} disabled={isCurrentMonth} className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30">›</button>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold">{fmt(summary?.total ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total spent</p>
          </div>
          {summary && summary.prevMonthTotal > 0 && (
            <div className={`flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-full ${
              diff > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                       : diff < 0 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                  : 'bg-gray-100 text-gray-600'
            }`}>
              {diff > 0 ? <TrendingUp className="w-3.5 h-3.5" />
               : diff < 0 ? <TrendingDown className="w-3.5 h-3.5" />
                           : <Minus className="w-3.5 h-3.5" />}
              {diffPct}% vs last month
            </div>
          )}
        </div>

        {/* Category breakdown bar */}
        {(summary?.categories?.length ?? 0) > 0 && (
          <div className="space-y-2 pt-1">
            {summary!.categories.slice(0, 5).map(c => (
              <div key={c.category} className="flex items-center gap-2">
                <span className="text-sm w-24 truncate text-muted-foreground">
                  {CATEGORY_ICONS[c.category]} {CATEGORY_LABELS[c.category]}
                </span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.round((c.total / (summary?.total || 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium w-16 text-right">{fmt(c.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            categoryFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
          }`}
        >
          All
        </button>
        {EXPENSE_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(categoryFilter === cat ? 'all' : cat)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              categoryFilter === cat
                ? 'bg-primary text-primary-foreground border-primary'
                : 'hover:bg-accent'
            }`}
          >
            {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Expense list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-4xl">💸</p>
          <p className="font-medium">No expenses yet</p>
          <p className="text-sm text-muted-foreground">
            {categoryFilter !== 'all'
              ? `No ${CATEGORY_LABELS[categoryFilter as keyof typeof CATEGORY_LABELS]} expenses this month`
              : 'Tap Add to record your first expense'}
          </p>
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Expense
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((expense) => (
            <div
              key={expense.id}
              className="flex items-center gap-3 bg-card border rounded-xl p-3 hover:shadow-sm transition-shadow"
            >
              <div className="text-2xl shrink-0">{CATEGORY_ICONS[expense.category]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[expense.category]}`}>
                    {CATEGORY_LABELS[expense.category]}
                  </span>
                </div>
                {expense.note && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{expense.note}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(expense.spent_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  {expense.created_by_name && ` · ${expense.created_by_name}`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold">{fmt(expense.amount)}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => { setEditingExpense(expense); setShowModal(true) }}
                  className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (confirm('Delete this expense?')) deleteMutation.mutate(expense.id)
                  }}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ExpenseFormModal
          householdId={hId}
          expense={editingExpense}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingExpense(null) }}
        />
      )}
    </div>
  )
}

