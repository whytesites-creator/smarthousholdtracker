import { z } from 'zod'
import { jsonResponse, errorResponse, generateId } from '../../utils/helpers'
import type { Env, AppContext } from '../../utils/helpers'

// ─── Constants ───────────────────────────────────────────────────────────────

export const EXPENSE_CATEGORIES = [
  'groceries', 'milk', 'vegetables', 'gas', 'electricity',
  'internet', 'education', 'medical', 'transport', 'shopping', 'miscellaneous',
] as const

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]

// ─── Schemas ─────────────────────────────────────────────────────────────────

const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount:   z.number().positive().multipleOf(0.01),
  note:     z.string().max(200).optional(),
  spent_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
})

const expenseUpdateSchema = expenseSchema.partial()

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getAppUserId(env: Env, supabaseUserId: string) {
  const row = await env.DB.prepare(
    'SELECT id FROM users WHERE supabase_user_id = ?'
  ).bind(supabaseUserId).first<{ id: string }>()
  return row?.id ?? null
}

async function getMembership(env: Env, householdId: string, userId: string) {
  return env.DB.prepare(
    `SELECT role FROM household_memberships
     WHERE household_id = ? AND user_id = ? AND status = 'active'`
  ).bind(householdId, userId).first<{ role: string }>()
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/expenses
 * Query params: from, to, category, limit (max 100), cursor
 */
export async function listExpenses(
  request: Request, env: Env, ctx: AppContext
): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const url    = new URL(request.url)
  const hId    = url.searchParams.get('household_id') ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')

  const membership = await getMembership(env, hId, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')

  const from     = url.searchParams.get('from')     // YYYY-MM-DD
  const to       = url.searchParams.get('to')       // YYYY-MM-DD
  const category = url.searchParams.get('category')
  const limit    = Math.min(Number(url.searchParams.get('limit') ?? 50), 100)
  const cursor   = url.searchParams.get('cursor')   // last spent_on+id for keyset

  const conditions: string[] = [`household_id = ?`, `deleted_at IS NULL`]
  const binds: unknown[]     = [hId]

  if (from)     { conditions.push('spent_on >= ?'); binds.push(from) }
  if (to)       { conditions.push('spent_on <= ?'); binds.push(to) }
  if (category) { conditions.push('category = ?');  binds.push(category) }
  if (cursor) {
    // cursor is base64(spent_on|id)
    const [cDate, cId] = atob(cursor).split('|')
    conditions.push('(spent_on < ? OR (spent_on = ? AND id > ?))')
    binds.push(cDate, cDate, cId)
  }

  const where = conditions.join(' AND ')
  const rows  = await env.DB.prepare(
    `SELECT e.id, e.category, e.amount, e.note, e.spent_on, e.created_at,
            u.name AS created_by_name
     FROM expenses e
     JOIN users u ON u.id = e.created_by
     WHERE ${where}
     ORDER BY e.spent_on DESC, e.id ASC
     LIMIT ?`
  ).bind(...binds, limit + 1).all()

  const items   = rows.results.slice(0, limit)
  const hasMore = rows.results.length > limit
  const nextCursor = hasMore
    ? btoa(`${(items[items.length - 1] as { spent_on: string; id: string }).spent_on}|${(items[items.length - 1] as { id: string }).id}`)
    : null

  return jsonResponse({ items, hasMore, nextCursor })
}

/**
 * POST /api/v1/expenses
 */
export async function createExpense(
  request: Request, env: Env, ctx: AppContext
): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const body   = await request.json().catch(() => null)
  const parsed = expenseSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR')
  }

  const { category, amount, note, spent_on } = parsed.data
  const hId = (body as Record<string, unknown>)?.household_id as string ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')

  const membership = await getMembership(env, hId, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')
  if (membership.role === 'viewer') return errorResponse('Viewers cannot add expenses', 403, 'FORBIDDEN')

  const id  = generateId()
  const now = new Date().toISOString()

  await env.DB.prepare(`
    INSERT INTO expenses (id, household_id, category, amount, note, spent_on, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, hId, category, amount, note ?? null, spent_on, userId, now, now).run()

  await env.DB.prepare(`
    INSERT INTO audit_logs (id, household_id, actor_user_id, action, entity_type, entity_id, after_json, at)
    VALUES (?, ?, ?, 'CREATE', 'expense', ?, ?, ?)
  `).bind(generateId(), hId, userId, id, JSON.stringify({ category, amount, spent_on }), now).run()

  const expense = await env.DB.prepare('SELECT * FROM expenses WHERE id = ?').bind(id).first()
  return jsonResponse(expense, 201)
}

/**
 * PATCH /api/v1/expenses/:id
 */
export async function updateExpense(
  request: Request, env: Env, ctx: AppContext, expenseId: string
): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const existing = await env.DB.prepare(
    `SELECT * FROM expenses WHERE id = ? AND deleted_at IS NULL`
  ).bind(expenseId).first<{ household_id: string; created_by: string; category: string; amount: number; spent_on: string }>()
  if (!existing) return errorResponse('Expense not found', 404, 'NOT_FOUND')

  const membership = await getMembership(env, existing.household_id, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')
  // Only the creator or admin/owner can edit
  if (existing.created_by !== userId && !['owner', 'admin'].includes(membership.role)) {
    return errorResponse('You can only edit your own expenses', 403, 'FORBIDDEN')
  }

  const body   = await request.json().catch(() => null)
  const parsed = expenseUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR')
  }

  const updates: string[]  = []
  const values: unknown[]  = []
  const { category, amount, note, spent_on } = parsed.data

  if (category !== undefined) { updates.push('category = ?');  values.push(category) }
  if (amount   !== undefined) { updates.push('amount = ?');    values.push(amount) }
  if (note     !== undefined) { updates.push('note = ?');      values.push(note) }
  if (spent_on !== undefined) { updates.push('spent_on = ?');  values.push(spent_on) }
  if (updates.length === 0)   return errorResponse('Nothing to update', 400, 'VALIDATION_ERROR')

  const now = new Date().toISOString()
  updates.push('updated_at = ?'); values.push(now)
  values.push(expenseId)

  await env.DB.prepare(
    `UPDATE expenses SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run()

  await env.DB.prepare(`
    INSERT INTO audit_logs (id, household_id, actor_user_id, action, entity_type, entity_id, before_json, after_json, at)
    VALUES (?, ?, ?, 'UPDATE', 'expense', ?, ?, ?, ?)
  `).bind(
    generateId(), existing.household_id, userId, expenseId,
    JSON.stringify({ category: existing.category, amount: existing.amount, spent_on: existing.spent_on }),
    JSON.stringify(parsed.data), now
  ).run()

  const updated = await env.DB.prepare('SELECT * FROM expenses WHERE id = ?').bind(expenseId).first()
  return jsonResponse(updated)
}

/**
 * DELETE /api/v1/expenses/:id  (soft delete)
 */
export async function deleteExpense(
  _request: Request, env: Env, ctx: AppContext, expenseId: string
): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const existing = await env.DB.prepare(
    `SELECT * FROM expenses WHERE id = ? AND deleted_at IS NULL`
  ).bind(expenseId).first<{ household_id: string; created_by: string }>()
  if (!existing) return errorResponse('Expense not found', 404, 'NOT_FOUND')

  const membership = await getMembership(env, existing.household_id, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')
  if (existing.created_by !== userId && !['owner', 'admin'].includes(membership.role)) {
    return errorResponse('You can only delete your own expenses', 403, 'FORBIDDEN')
  }

  const now = new Date().toISOString()
  await env.DB.prepare(
    `UPDATE expenses SET deleted_at = ? WHERE id = ?`
  ).bind(now, expenseId).run()

  await env.DB.prepare(`
    INSERT INTO audit_logs (id, household_id, actor_user_id, action, entity_type, entity_id, at)
    VALUES (?, ?, ?, 'DELETE', 'expense', ?, ?)
  `).bind(generateId(), existing.household_id, userId, expenseId, now).run()

  return jsonResponse({ success: true })
}

/**
 * GET /api/v1/expenses/summary
 * Query params: household_id, month (1-12), year (YYYY)
 * Returns: total, per-category breakdown
 */
export async function getExpenseSummary(
  request: Request, env: Env, ctx: AppContext
): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const url  = new URL(request.url)
  const hId  = url.searchParams.get('household_id') ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')

  const membership = await getMembership(env, hId, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')

  const now   = new Date()
  const month = Number(url.searchParams.get('month') ?? now.getMonth() + 1)
  const year  = Number(url.searchParams.get('year')  ?? now.getFullYear())

  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to   = `${year}-${String(month).padStart(2, '0')}-31`

  // Total
  const totalRow = await env.DB.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM expenses
    WHERE household_id = ? AND spent_on BETWEEN ? AND ? AND deleted_at IS NULL
  `).bind(hId, from, to).first<{ total: number }>()

  // Per category
  const catRows = await env.DB.prepare(`
    SELECT category, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
    FROM expenses
    WHERE household_id = ? AND spent_on BETWEEN ? AND ? AND deleted_at IS NULL
    GROUP BY category
    ORDER BY total DESC
  `).bind(hId, from, to).all()

  // Previous month for comparison
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear  = month === 1 ? year - 1 : year
  const prevFrom  = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
  const prevTo    = `${prevYear}-${String(prevMonth).padStart(2, '0')}-31`

  const prevRow = await env.DB.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM expenses
    WHERE household_id = ? AND spent_on BETWEEN ? AND ? AND deleted_at IS NULL
  `).bind(hId, prevFrom, prevTo).first<{ total: number }>()

  return jsonResponse({
    month, year,
    total: totalRow?.total ?? 0,
    prevMonthTotal: prevRow?.total ?? 0,
    categories: catRows.results,
  })
}

