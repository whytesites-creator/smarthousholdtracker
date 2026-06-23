import { z } from 'zod'
import { jsonResponse, errorResponse, generateId } from '../../utils/helpers'
import type { Env, AppContext } from '../../utils/helpers'

// ─── Schemas ─────────────────────────────────────────────────────────────────

const UNITS = ['kg', 'g', 'L', 'ml', 'count', 'dozen', 'pack'] as const
const TXN_TYPES = ['purchase', 'consume', 'adjust', 'waste'] as const

const itemSchema = z.object({
  name:          z.string().min(1).max(60),
  unit:          z.enum(UNITS),
  current_qty:   z.number().min(0).default(0),
  min_threshold: z.number().min(0).default(0),
  is_custom:     z.boolean().default(true),
})

const itemUpdateSchema = itemSchema.partial()

const txnSchema = z.object({
  type:        z.enum(TXN_TYPES),
  qty:         z.number().positive('Quantity must be positive'),
  unit_price:  z.number().min(0).optional(),
  total_price: z.number().min(0).optional(),
  note:        z.string().max(200).optional(),
  txn_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().split('T')[0]),
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getAppUserId(env: Env, supabaseUserId: string) {
  const row = await env.DB.prepare(
    'SELECT id FROM users WHERE supabase_user_id = ?'
  ).bind(supabaseUserId).first<{ id: string }>()
  return row?.id ?? null
}

async function getMembership(env: Env, householdId: string, userId: string) {
  return env.DB.prepare(
    `SELECT role FROM household_memberships WHERE household_id=? AND user_id=? AND status='active'`
  ).bind(householdId, userId).first<{ role: string }>()
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/** GET /api/v1/inventory/items?household_id=&low_stock=true */
export async function listItems(request: Request, env: Env, ctx: AppContext): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const url = new URL(request.url)
  const hId = url.searchParams.get('household_id') ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')

  const membership = await getMembership(env, hId, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')

  const lowStock = url.searchParams.get('low_stock') === 'true'
  const having   = lowStock ? 'AND i.current_qty <= i.min_threshold' : ''

  const rows = await env.DB.prepare(`
    SELECT i.*,
      CASE WHEN i.min_threshold > 0 AND i.current_qty <= i.min_threshold THEN 1 ELSE 0 END AS is_low_stock
    FROM inventory_items i
    WHERE i.household_id = ? AND i.is_active = 1 ${having}
    ORDER BY is_low_stock DESC, i.name ASC
  `).bind(hId).all()

  return jsonResponse(rows.results)
}

/** POST /api/v1/inventory/items */
export async function createItem(request: Request, env: Env, ctx: AppContext): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const body   = await request.json().catch(() => null) as Record<string, unknown> | null
  const hId    = body?.household_id as string ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')

  const membership = await getMembership(env, hId, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')
  if (membership.role === 'viewer') return errorResponse('Viewers cannot add items', 403, 'FORBIDDEN')

  const parsed = itemSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR')

  const { name, unit, current_qty, min_threshold, is_custom } = parsed.data
  const id  = generateId()
  const now = new Date().toISOString()

  // Check duplicate
  const dup = await env.DB.prepare(
    `SELECT id FROM inventory_items WHERE household_id=? AND name=? AND is_active=1`
  ).bind(hId, name).first()
  if (dup) return errorResponse(`"${name}" already exists in your inventory`, 409, 'CONFLICT')

  await env.DB.prepare(`
    INSERT INTO inventory_items
      (id, household_id, name, unit, current_qty, min_threshold, is_custom, created_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).bind(id, hId, name, unit, current_qty, min_threshold, is_custom ? 1 : 0, userId, now, now).run()

  // If initial qty > 0, log as opening stock transaction
  if (current_qty > 0) {
    await env.DB.prepare(`
      INSERT INTO inventory_transactions
        (id, item_id, household_id, type, qty, note, txn_date, created_by, created_at)
      VALUES (?,?,?,'adjust',?,'Opening stock',date('now'),?,?)
    `).bind(generateId(), id, hId, current_qty, userId, now).run()
  }

  const item = await env.DB.prepare('SELECT * FROM inventory_items WHERE id=?').bind(id).first()
  return jsonResponse(item, 201)
}

/** PATCH /api/v1/inventory/items/:id */
export async function updateItem(
  request: Request, env: Env, ctx: AppContext, itemId: string
): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const existing = await env.DB.prepare(
    `SELECT * FROM inventory_items WHERE id=? AND is_active=1`
  ).bind(itemId).first<{ household_id: string }>()
  if (!existing) return errorResponse('Item not found', 404, 'NOT_FOUND')

  const membership = await getMembership(env, existing.household_id, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')

  const body   = await request.json().catch(() => null)
  const parsed = itemUpdateSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR')

  const updates: string[]  = []
  const values: unknown[]  = []
  const d = parsed.data

  if (d.name          !== undefined) { updates.push('name=?');          values.push(d.name) }
  if (d.unit          !== undefined) { updates.push('unit=?');          values.push(d.unit) }
  if (d.min_threshold !== undefined) { updates.push('min_threshold=?'); values.push(d.min_threshold) }
  if (updates.length === 0) return errorResponse('Nothing to update', 400, 'VALIDATION_ERROR')

  updates.push('updated_at=?'); values.push(new Date().toISOString())
  values.push(itemId)

  await env.DB.prepare(`UPDATE inventory_items SET ${updates.join(',')} WHERE id=?`).bind(...values).run()
  const item = await env.DB.prepare('SELECT * FROM inventory_items WHERE id=?').bind(itemId).first()
  return jsonResponse(item)
}

/** DELETE /api/v1/inventory/items/:id  (soft delete) */
export async function deleteItem(
  _req: Request, env: Env, ctx: AppContext, itemId: string
): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const existing = await env.DB.prepare(
    `SELECT * FROM inventory_items WHERE id=? AND is_active=1`
  ).bind(itemId).first<{ household_id: string }>()
  if (!existing) return errorResponse('Item not found', 404, 'NOT_FOUND')

  const membership = await getMembership(env, existing.household_id, userId)
  if (!membership || !['owner', 'admin'].includes(membership.role))
    return errorResponse('Only admins can remove items', 403, 'FORBIDDEN')

  await env.DB.prepare(
    `UPDATE inventory_items SET is_active=0, updated_at=? WHERE id=?`
  ).bind(new Date().toISOString(), itemId).run()

  return jsonResponse({ success: true })
}

/** POST /api/v1/inventory/items/:id/transactions — log purchase / consume / adjust */
export async function addTransaction(
  request: Request, env: Env, ctx: AppContext, itemId: string
): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const item = await env.DB.prepare(
    `SELECT * FROM inventory_items WHERE id=? AND is_active=1`
  ).bind(itemId).first<{ household_id: string; current_qty: number; min_threshold: number; name: string; unit: string }>()
  if (!item) return errorResponse('Item not found', 404, 'NOT_FOUND')

  const membership = await getMembership(env, item.household_id, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')
  if (membership.role === 'viewer') return errorResponse('Viewers cannot update stock', 403, 'FORBIDDEN')

  const body   = await request.json().catch(() => null)
  const parsed = txnSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR')

  const { type, qty, unit_price, total_price, note, txn_date } = parsed.data

  // Determine signed qty: purchase/adjust add, consume/waste deduct
  const signedQty = ['purchase', 'adjust'].includes(type) ? qty : -qty
  const newQty    = Math.max(0, item.current_qty + signedQty)

  const txnId = generateId()
  const now   = new Date().toISOString()

  await env.DB.prepare(`
    INSERT INTO inventory_transactions
      (id, item_id, household_id, type, qty, unit_price, total_price, note, txn_date, created_by, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).bind(txnId, itemId, item.household_id, type, signedQty,
    unit_price ?? null, total_price ?? null, note ?? null, txn_date, userId, now).run()

  await env.DB.prepare(
    `UPDATE inventory_items SET current_qty=?, updated_at=? WHERE id=?`
  ).bind(newQty, now, itemId).run()

  const updated = await env.DB.prepare('SELECT * FROM inventory_items WHERE id=?').bind(itemId).first()
  return jsonResponse({ item: updated, transaction_id: txnId }, 201)
}

/** GET /api/v1/inventory/items/:id/transactions */
export async function getTransactions(
  request: Request, env: Env, ctx: AppContext, itemId: string
): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const item = await env.DB.prepare(
    `SELECT household_id FROM inventory_items WHERE id=? AND is_active=1`
  ).bind(itemId).first<{ household_id: string }>()
  if (!item) return errorResponse('Item not found', 404, 'NOT_FOUND')

  const membership = await getMembership(env, item.household_id, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')

  const url   = new URL(request.url)
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 30), 100)

  const rows = await env.DB.prepare(`
    SELECT t.*, u.name AS by_name
    FROM inventory_transactions t
    JOIN users u ON u.id = t.created_by
    WHERE t.item_id = ?
    ORDER BY t.txn_date DESC, t.created_at DESC
    LIMIT ?
  `).bind(itemId, limit).all()

  return jsonResponse(rows.results)
}

/** GET /api/v1/inventory/summary?household_id= */
export async function getInventorySummary(
  request: Request, env: Env, ctx: AppContext
): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const url = new URL(request.url)
  const hId = url.searchParams.get('household_id') ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')

  const membership = await getMembership(env, hId, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')

  const [totalRow, lowRow, recentRows] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS total FROM inventory_items WHERE household_id=? AND is_active=1`
    ).bind(hId).first<{ total: number }>(),

    env.DB.prepare(
      `SELECT COUNT(*) AS cnt FROM inventory_items
       WHERE household_id=? AND is_active=1 AND min_threshold>0 AND current_qty<=min_threshold`
    ).bind(hId).first<{ cnt: number }>(),

    env.DB.prepare(
      `SELECT id, name, unit, current_qty, min_threshold,
              CASE WHEN min_threshold>0 AND current_qty<=min_threshold THEN 1 ELSE 0 END AS is_low_stock
       FROM inventory_items
       WHERE household_id=? AND is_active=1 AND min_threshold>0 AND current_qty<=min_threshold
       ORDER BY current_qty ASC LIMIT 5`
    ).bind(hId).all(),
  ])

  return jsonResponse({
    total_items:    totalRow?.total  ?? 0,
    low_stock_count: lowRow?.cnt     ?? 0,
    low_stock_items: recentRows.results,
  })
}

