import { z } from 'zod'
import { jsonResponse, errorResponse, generateId } from '../../utils/helpers'
import type { Env, AppContext } from '../../utils/helpers'

const waterSchema = z.object({
  vendor:        z.string().max(80).optional(),
  qty:           z.number().positive(),
  unit:          z.enum(['cans', 'L']).default('cans'),
  cost:          z.number().min(0).optional(),
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes:         z.string().max(200).optional(),
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

/** GET /api/v1/water?household_id= */
export async function listWaterDeliveries(req: Request, env: Env, ctx: AppContext): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')
  const url = new URL(req.url)
  const hId = url.searchParams.get('household_id') ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')
  const m = await getMembership(env, hId, userId)
  if (!m) return errorResponse('Access denied', 403, 'FORBIDDEN')

  const rows = await env.DB.prepare(`
    SELECT w.*, u.name AS created_by_name
    FROM water_deliveries w JOIN users u ON u.id = w.created_by
    WHERE w.household_id=? ORDER BY w.delivery_date DESC LIMIT 50
  `).bind(hId).all()

  const deliveries = rows.results as {delivery_date:string; qty:number; unit:string}[]

  // Analytics: avg cans per delivery, avg days between, predicted next
  let avgQty: number | null = null
  let avgDays: number | null = null
  let predictedNext: string | null = null

  if (deliveries.length >= 1) {
    avgQty = Math.round(deliveries.reduce((s, d) => s + d.qty, 0) / deliveries.length)
  }
  if (deliveries.length >= 2) {
    let totalDays = 0
    for (let i = 0; i < deliveries.length - 1; i++) {
      const d1 = new Date(deliveries[i].delivery_date).getTime()
      const d2 = new Date(deliveries[i + 1].delivery_date).getTime()
      totalDays += (d1 - d2) / 86400000
    }
    avgDays = Math.round(totalDays / (deliveries.length - 1))
    const lastDate = new Date(deliveries[0].delivery_date)
    lastDate.setDate(lastDate.getDate() + avgDays)
    predictedNext = lastDate.toISOString().split('T')[0]
  }

  return jsonResponse({ deliveries: rows.results, analytics: { avgQty, avgDays, predictedNext } })
}

/** POST /api/v1/water */
export async function createWaterDelivery(req: Request, env: Env, ctx: AppContext): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const hId = body?.household_id as string ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')
  const m = await getMembership(env, hId, userId)
  if (!m) return errorResponse('Access denied', 403, 'FORBIDDEN')
  if (m.role === 'viewer') return errorResponse('Viewers cannot add deliveries', 403, 'FORBIDDEN')

  const parsed = waterSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR')

  const { vendor, qty, unit, cost, delivery_date, notes } = parsed.data
  const id = generateId()
  const now = new Date().toISOString()

  await env.DB.prepare(`
    INSERT INTO water_deliveries (id, household_id, vendor, qty, unit, cost, delivery_date, notes, created_by, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).bind(id, hId, vendor ?? null, qty, unit, cost ?? null, delivery_date, notes ?? null, userId, now).run()

  const entry = await env.DB.prepare('SELECT * FROM water_deliveries WHERE id=?').bind(id).first()
  return jsonResponse(entry, 201)
}

/** DELETE /api/v1/water/:id */
export async function deleteWaterDelivery(_req: Request, env: Env, ctx: AppContext, id: string): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')
  const entry = await env.DB.prepare('SELECT household_id FROM water_deliveries WHERE id=?').bind(id).first<{household_id:string}>()
  if (!entry) return errorResponse('Entry not found', 404, 'NOT_FOUND')
  const m = await getMembership(env, entry.household_id, userId)
  if (!m || !['owner', 'admin'].includes(m.role)) return errorResponse('Insufficient permissions', 403, 'FORBIDDEN')
  await env.DB.prepare('DELETE FROM water_deliveries WHERE id=?').bind(id).run()
  return jsonResponse({ success: true })
}

