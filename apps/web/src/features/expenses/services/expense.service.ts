import { apiClient } from '@/lib/api-client'

export const EXPENSE_CATEGORIES = [
  'groceries', 'milk', 'vegetables', 'gas', 'electricity',
  'internet', 'education', 'medical', 'transport', 'shopping', 'miscellaneous',
] as const

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  groceries:     'Groceries',
  milk:          'Milk',
  vegetables:    'Vegetables',
  gas:           'Gas',
  electricity:   'Electricity',
  internet:      'Internet',
  education:     'Education',
  medical:       'Medical',
  transport:     'Transport',
  shopping:      'Shopping',
  miscellaneous: 'Miscellaneous',
}

export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  groceries:     'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  milk:          'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  vegetables:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  gas:           'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  electricity:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  internet:      'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
  education:     'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  medical:       'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
  transport:     'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
  shopping:      'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
  miscellaneous: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
}

export const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  groceries: '🛒', milk: '🥛', vegetables: '🥦', gas: '🔥', electricity: '⚡',
  internet: '📡', education: '📚', medical: '💊', transport: '🚗',
  shopping: '🛍️', miscellaneous: '📦',
}

export interface Expense {
  id: string
  household_id: string
  category: ExpenseCategory
  amount: number
  note?: string
  spent_on: string
  created_by_name?: string
  created_at: string
}

export interface ExpenseSummary {
  month: number
  year: number
  total: number
  prevMonthTotal: number
  categories: { category: ExpenseCategory; total: number; count: number }[]
}

export interface CreateExpenseInput {
  household_id: string
  category: ExpenseCategory
  amount: number
  note?: string
  spent_on: string
}

export async function listExpenses(params: {
  household_id: string
  from?: string
  to?: string
  category?: string
  limit?: number
  cursor?: string
}) {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => v !== undefined && p.set(k, String(v)))
  const res = await apiClient.get(`/expenses?${p}`)
  return res.data.data as { items: Expense[]; hasMore: boolean; nextCursor: string | null }
}

export async function createExpense(data: CreateExpenseInput) {
  const res = await apiClient.post('/expenses', data)
  return res.data.data as Expense
}

export async function updateExpense(id: string, data: Partial<CreateExpenseInput>) {
  const res = await apiClient.patch(`/expenses/${id}`, data)
  return res.data.data as Expense
}

export async function deleteExpense(id: string) {
  await apiClient.delete(`/expenses/${id}`)
}

export async function getExpenseSummary(params: {
  household_id: string
  month?: number
  year?: number
}) {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => v !== undefined && p.set(k, String(v)))
  const res = await apiClient.get(`/expenses/summary?${p}`)
  return res.data.data as ExpenseSummary
}

