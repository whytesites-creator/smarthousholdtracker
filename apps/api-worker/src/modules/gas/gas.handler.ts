import { z } from 'zod'
import { jsonResponse, errorResponse, generateId } from '../../utils/helpers'
import type { Env, AppContext } from '../../utils/helpers'

const CYLINDER_TYPES = ['domestic', 'commercial', 'auto'] as const

const gasSchema = z.object({
  refill_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vendor:        z.string().max(80).optional(),
  price:         z.number().min(0).optional(),
  cylinder_type: z.enum(CYLINDER_TYPES).default('domestic'),
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

/** GET /api/v1/gas?household_id= */
export async function listGasEntries(req: Request, env: Env, ctx: AppContext): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')
  const url = new URL(req.url)
  const hId = url.searchParams.get('household_id') ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')
  const m = await getMembership(env, hId, userId)
  if (!m) return errorResponse('Access denied', 403, 'FORBIDDEN')

  const rows = await env.DB.prepare(`
    SELECT g.*, u.name AS created_by_name
    FROM gas_entries g JOIN users u ON u.id = g.created_by
    WHERE g.household_id=? ORDER BY g.refill_date DESC LIMIT 50
  `).bind(hId).all()

  // Compute analytics: avg cycle days, predicted next refill
  const entries = rows.results as {refill_date: string}[]
  let avgDays: number | null = null
  let predictedNext: string | null = null

  if (entries.length >= 2) {
    let totalDays = 0
    for (let i = 0; i < entries.length - 1; i++) {
      const d1 = new Date(entries[i].refill_date).getTime()
      const d2 = new Date(entries[i + 1].refill_date).getTime()
      totalDays += (d1 - d2) / 86400000
    }
    avgDays = Math.round(totalDays / (entries.length - 1))
    const lastDate = new Date(entries[0].refill_date)
    lastDate.setDate(lastDate.getDate() + avgDays)
    predictedNext = lastDate.toISOString().split('T')[0]
  }

  return jsonResponse({ entries: rows.results, analytics: { avgDays, predictedNext, totalEntries: entries.length } })
}

/** POST /api/v1/gas */
export async function createGasEntry(req: Request, env: Env, ctx: AppContext): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const hId = body?.household_id as string ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')
  const m = await getMembership(env, hId, userId)
  if (!m) return errorResponse('Access denied', 403, 'FORBIDDEN')
  if (m.role === 'viewer') return errorResponse('Viewers cannot add entries', 403, 'FORBIDDEN')

  const parsed = gasSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR')

  const { refill_date, vendor, price, cylinder_type, notes } = parsed.data
  const id = generateId()
  const now = new Date().toISOString()

  await env.DB.prepare(`
    INSERT INTO gas_entries (id, household_id, refill_date, vendor, price, cylinder_type, notes, created_by, created_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).bind(id, hId, refill_date, vendor ?? null, price ?? null, cylinder_type, notes ?? null, userId, now).run()

  const entry = await env.DB.prepare('SELECT * FROM gas_entries WHERE id=?').bind(id).first()
  return jsonResponse(entry, 201)
}

/** DELETE /api/v1/gas/:id */
export async function deleteGasEntry(_req: Request, env: Env, ctx: AppContext, id: string): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')
  const entry = await env.DB.prepare('SELECT household_id FROM gas_entries WHERE id=?').bind(id).first<{household_id:string}>()
  if (!entry) return errorResponse('Entry not found', 404, 'NOT_FOUND')
  const m = await getMembership(env, entry.household_id, userId)
  if (!m || !['owner', 'admin'].includes(m.role)) return errorResponse('Insufficient permissions', 403, 'FORBIDDEN')
  await env.DB.prepare('DELETE FROM gas_entries WHERE id=?').bind(id).run()
  return jsonResponse({ success: true })
}

