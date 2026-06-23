import { z } from 'zod'
import { jsonResponse, errorResponse, generateId } from '../../utils/helpers'
import type { Env, AppContext } from '../../utils/helpers'

const BILL_TYPES       = ['electricity','internet','mobile','water_tax','property_tax','dth','subscription','other'] as const
const RECURRENCES      = ['monthly','quarterly','yearly','one_time'] as const
const PAYMENT_MODES    = ['cash','online','cheque','auto_debit','upi'] as const

const billSchema = z.object({
  name:       z.string().min(1).max(80),
  type:       z.enum(BILL_TYPES),
  provider:   z.string().max(80).optional(),
  amount:     z.number().min(0).optional(),
  recurrence: z.enum(RECURRENCES).default('monthly'),
  due_day:    z.number().int().min(1).max(28).optional(),
})

const instanceSchema = z.object({
  due_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount_due: z.number().min(0).optional(),
})

const paymentSchema = z.object({
  paid_on:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount_paid: z.number().positive(),
  mode:       z.enum(PAYMENT_MODES).default('online'),
  reference:  z.string().max(80).optional(),
})

async function getAppUserId(env: Env, sid: string) {
  const r = await env.DB.prepare('SELECT id FROM users WHERE supabase_user_id=?').bind(sid).first<{id:string}>()
  return r?.id ?? null
}
async function getMembership(env: Env, hId: string, userId: string) {
  return env.DB.prepare(
    `SELECT role FROM household_memberships WHERE household_id=? AND user_id=? AND status='active'`
  ).bind(hId, userId).first<{role:string}>()
}

/** Generate next due_date string based on recurrence */
function nextDueDate(from: string, recurrence: string): string {
  const d = new Date(from)
  if (recurrence === 'monthly')    d.setMonth(d.getMonth() + 1)
  else if (recurrence === 'quarterly') d.setMonth(d.getMonth() + 3)
  else if (recurrence === 'yearly')    d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().split('T')[0]
}

// ─── Bill CRUD ────────────────────────────────────────────────────────────────

/** GET /api/v1/bills?household_id= */
export async function listBills(req: Request, env: Env, ctx: AppContext): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')
  const url = new URL(req.url)
  const hId = url.searchParams.get('household_id') ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')
  const m = await getMembership(env, hId, userId)
  if (!m) return errorResponse('Access denied', 403, 'FORBIDDEN')

  const rows = await env.DB.prepare(`
    SELECT b.*,
      (SELECT COUNT(*) FROM bill_instances WHERE bill_id=b.id AND status='pending') AS pending_count,
      (SELECT COUNT(*) FROM bill_instances WHERE bill_id=b.id AND status='overdue') AS overdue_count,
      (SELECT due_date FROM bill_instances WHERE bill_id=b.id AND status='pending' ORDER BY due_date ASC LIMIT 1) AS next_due
    FROM bills b WHERE b.household_id=? AND b.active=1 ORDER BY b.name ASC
  `).bind(hId).all()

  return jsonResponse(rows.results)
}

/** POST /api/v1/bills */
export async function createBill(req: Request, env: Env, ctx: AppContext): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const hId = body?.household_id as string ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')
  const m = await getMembership(env, hId, userId)
  if (!m) return errorResponse('Access denied', 403, 'FORBIDDEN')
  if (m.role === 'viewer') return errorResponse('Viewers cannot add bills', 403, 'FORBIDDEN')

  const parsed = billSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR')

  const { name, type, provider, amount, recurrence, due_day } = parsed.data
  const id = generateId()
  const now = new Date().toISOString()

  await env.DB.prepare(`
    INSERT INTO bills (id, household_id, name, type, provider, amount, recurrence, due_day, created_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).bind(id, hId, name, type, provider ?? null, amount ?? null, recurrence, due_day ?? null, userId, now, now).run()

  // Auto-create first instance for the current/next period
  if (recurrence !== 'one_time') {
    const today = new Date()
    let firstDue: string
    if (due_day) {
      const d = new Date(today.getFullYear(), today.getMonth(), due_day)
      if (d < today) d.setMonth(d.getMonth() + 1)
      firstDue = d.toISOString().split('T')[0]
    } else {
      // Default: same day next month
      const d = new Date(today)
      d.setMonth(d.getMonth() + 1)
      firstDue = d.toISOString().split('T')[0]
    }
    await env.DB.prepare(`
      INSERT INTO bill_instances (id, bill_id, household_id, due_date, amount_due, status, created_at)
      VALUES (?,?,?,?,?,'pending',?)
    `).bind(generateId(), id, hId, firstDue, amount ?? null, now).run()
  }

  const bill = await env.DB.prepare('SELECT * FROM bills WHERE id=?').bind(id).first()
  return jsonResponse(bill, 201)
}

/** PATCH /api/v1/bills/:id */
export async function updateBill(req: Request, env: Env, ctx: AppContext, billId: string): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')
  const existing = await env.DB.prepare('SELECT * FROM bills WHERE id=? AND active=1').bind(billId).first<{household_id:string}>()
  if (!existing) return errorResponse('Bill not found', 404, 'NOT_FOUND')
  const m = await getMembership(env, existing.household_id, userId)
  if (!m) return errorResponse('Access denied', 403, 'FORBIDDEN')

  const body = await req.json().catch(() => null)
  const parsed = billSchema.partial().safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR')

  const d = parsed.data
  const updates: string[] = []
  const values: unknown[] = []
  if (d.name       !== undefined) { updates.push('name=?');       values.push(d.name) }
  if (d.type       !== undefined) { updates.push('type=?');       values.push(d.type) }
  if (d.provider   !== undefined) { updates.push('provider=?');   values.push(d.provider) }
  if (d.amount     !== undefined) { updates.push('amount=?');     values.push(d.amount) }
  if (d.recurrence !== undefined) { updates.push('recurrence=?'); values.push(d.recurrence) }
  if (d.due_day    !== undefined) { updates.push('due_day=?');    values.push(d.due_day) }
  if (updates.length === 0) return errorResponse('Nothing to update', 400, 'VALIDATION_ERROR')
  updates.push('updated_at=?'); values.push(new Date().toISOString())
  values.push(billId)

  await env.DB.prepare(`UPDATE bills SET ${updates.join(',')} WHERE id=?`).bind(...values).run()
  const bill = await env.DB.prepare('SELECT * FROM bills WHERE id=?').bind(billId).first()
  return jsonResponse(bill)
}

/** DELETE /api/v1/bills/:id  (soft delete) */
export async function deleteBill(_req: Request, env: Env, ctx: AppContext, billId: string): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')
  const existing = await env.DB.prepare('SELECT * FROM bills WHERE id=? AND active=1').bind(billId).first<{household_id:string}>()
  if (!existing) return errorResponse('Bill not found', 404, 'NOT_FOUND')
  const m = await getMembership(env, existing.household_id, userId)
  if (!m || !['owner','admin'].includes(m.role)) return errorResponse('Insufficient permissions', 403, 'FORBIDDEN')
  await env.DB.prepare(`UPDATE bills SET active=0, updated_at=? WHERE id=?`).bind(new Date().toISOString(), billId).run()
  return jsonResponse({ success: true })
}

// ─── Instances ────────────────────────────────────────────────────────────────

/** GET /api/v1/bills/upcoming?household_id=&days=30 */
export async function getUpcomingBills(req: Request, env: Env, ctx: AppContext): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')
  const url = new URL(req.url)
  const hId = url.searchParams.get('household_id') ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')
  const m = await getMembership(env, hId, userId)
  if (!m) return errorResponse('Access denied', 403, 'FORBIDDEN')

  const days = Number(url.searchParams.get('days') ?? 30)
  const today = new Date().toISOString().split('T')[0]
  const until = new Date(Date.now() + days * 86400000).toISOString().split('T')[0]

  // Mark overdue first
  await env.DB.prepare(`
    UPDATE bill_instances SET status='overdue'
    WHERE household_id=? AND status='pending' AND due_date < ?
  `).bind(hId, today).run()

  const rows = await env.DB.prepare(`
    SELECT i.*, b.name AS bill_name, b.type, b.provider, b.recurrence
    FROM bill_instances i JOIN bills b ON b.id=i.bill_id
    WHERE i.household_id=? AND i.status IN ('pending','overdue') AND i.due_date <= ?
    ORDER BY i.due_date ASC LIMIT 50
  `).bind(hId, until).all()

  const overdueCount = (rows.results as {status:string}[]).filter(r => r.status === 'overdue').length

  return jsonResponse({ instances: rows.results, overdueCount, totalDue: rows.results.length })
}

/** POST /api/v1/bills/:billId/instances  (manual add) */
export async function addBillInstance(req: Request, env: Env, ctx: AppContext, billId: string): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')
  const bill = await env.DB.prepare('SELECT * FROM bills WHERE id=? AND active=1').bind(billId).first<{household_id:string; amount:number|null}>()
  if (!bill) return errorResponse('Bill not found', 404, 'NOT_FOUND')
  const m = await getMembership(env, bill.household_id, userId)
  if (!m) return errorResponse('Access denied', 403, 'FORBIDDEN')

  const body = await req.json().catch(() => null)
  const parsed = instanceSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR')

  const id = generateId()
  const now = new Date().toISOString()
  await env.DB.prepare(`
    INSERT INTO bill_instances (id, bill_id, household_id, due_date, amount_due, status, created_at)
    VALUES (?,?,?,?,?,'pending',?)
  `).bind(id, billId, bill.household_id, parsed.data.due_date, parsed.data.amount_due ?? bill.amount ?? null, now).run()

  const instance = await env.DB.prepare('SELECT * FROM bill_instances WHERE id=?').bind(id).first()
  return jsonResponse(instance, 201)
}

/** POST /api/v1/bills/instances/:instanceId/pay */
export async function payBillInstance(req: Request, env: Env, ctx: AppContext, instanceId: string): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')
  const instance = await env.DB.prepare(
    `SELECT i.*, b.recurrence, b.due_day, b.amount FROM bill_instances i JOIN bills b ON b.id=i.bill_id WHERE i.id=?`
  ).bind(instanceId).first<{
    household_id:string; bill_id:string; due_date:string
    recurrence:string; due_day:number|null; amount:number|null; status:string
  }>()
  if (!instance) return errorResponse('Instance not found', 404, 'NOT_FOUND')
  if (instance.status === 'paid') return errorResponse('Already paid', 409, 'CONFLICT')
  const m = await getMembership(env, instance.household_id, userId)
  if (!m) return errorResponse('Access denied', 403, 'FORBIDDEN')

  const body = await req.json().catch(() => null)
  const parsed = paymentSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR')

  const now = new Date().toISOString()
  // Mark paid
  await env.DB.prepare(`UPDATE bill_instances SET status='paid' WHERE id=?`).bind(instanceId).run()

  // Record payment
  await env.DB.prepare(`
    INSERT INTO bill_payments (id, instance_id, household_id, paid_on, amount_paid, mode, reference, paid_by, created_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).bind(
    generateId(), instanceId, instance.household_id,
    parsed.data.paid_on, parsed.data.amount_paid,
    parsed.data.mode, parsed.data.reference ?? null, userId, now
  ).run()

  // Auto-create next instance for recurring bills
  if (instance.recurrence !== 'one_time') {
    const nextDue = nextDueDate(instance.due_date, instance.recurrence)
    await env.DB.prepare(`
      INSERT INTO bill_instances (id, bill_id, household_id, due_date, amount_due, status, created_at)
      VALUES (?,?,?,?,?,'pending',?)
    `).bind(generateId(), instance.bill_id, instance.household_id, nextDue, instance.amount ?? null, now).run()
  }

  return jsonResponse({ success: true, nextDue: instance.recurrence !== 'one_time' ? nextDueDate(instance.due_date, instance.recurrence) : null })
}

/** GET /api/v1/bills/summary?household_id= */
export async function getBillsSummary(req: Request, env: Env, ctx: AppContext): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')
  const url = new URL(req.url)
  const hId = url.searchParams.get('household_id') ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')
  const m = await getMembership(env, hId, userId)
  if (!m) return errorResponse('Access denied', 403, 'FORBIDDEN')

  const today = new Date().toISOString().split('T')[0]
  const in30  = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

  await env.DB.prepare(
    `UPDATE bill_instances SET status='overdue' WHERE household_id=? AND status='pending' AND due_date < ?`
  ).bind(hId, today).run()

  const [due30, overdue] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS cnt FROM bill_instances WHERE household_id=? AND status='pending' AND due_date <= ?`
    ).bind(hId, in30).first<{cnt:number}>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS cnt FROM bill_instances WHERE household_id=? AND status='overdue'`
    ).bind(hId, ).first<{cnt:number}>(),
  ])

  return jsonResponse({ due_in_30_days: due30?.cnt ?? 0, overdue: overdue?.cnt ?? 0 })
}

