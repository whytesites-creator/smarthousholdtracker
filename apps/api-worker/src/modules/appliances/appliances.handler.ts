import { z } from 'zod'
import { jsonResponse, errorResponse, generateId } from '../../utils/helpers'
import type { Env, AppContext } from '../../utils/helpers'

// ─── Constants ───────────────────────────────────────────────────────────────
export const APPLIANCE_CATEGORIES = [
  'ac','refrigerator','washing_machine','tv','microwave',
  'water_purifier','geyser','fan','mixer','laptop','phone','other',
] as const

export const APPLIANCE_SERVICE_TYPES = ['repair','maintenance','installation','warranty_claim','other'] as const

// ─── Schemas ─────────────────────────────────────────────────────────────────
const applianceSchema = z.object({
  name:            z.string().min(1).max(100),
  category:        z.enum(APPLIANCE_CATEGORIES),
  brand:           z.string().max(60).optional(),
  model:           z.string().max(60).optional(),
  serial_no:       z.string().max(60).optional(),
  purchase_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  warranty_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  purchase_price:  z.number().positive().optional(),
  shop:            z.string().max(100).optional(),
  notes:           z.string().max(500).optional(),
})

const applianceServiceSchema = z.object({
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  service_type: z.enum(APPLIANCE_SERVICE_TYPES),
  cost:         z.number().positive().optional(),
  provider:     z.string().max(100).optional(),
  notes:        z.string().max(300).optional(),
})

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function getAppUserId(env: Env, supabaseUserId: string) {
  const row = await env.DB.prepare('SELECT id FROM users WHERE supabase_user_id = ?').bind(supabaseUserId).first<{ id: string }>()
  return row?.id ?? null
}

async function getMembership(env: Env, householdId: string, userId: string) {
  return env.DB.prepare(
    `SELECT role FROM household_memberships WHERE household_id = ? AND user_id = ? AND status = 'active'`
  ).bind(householdId, userId).first<{ role: string }>()
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/** GET /api/v1/appliances */
export async function listAppliances(request: Request, env: Env, ctx: AppContext): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const hId = new URL(request.url).searchParams.get('household_id') ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')

  const membership = await getMembership(env, hId, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')

  const rows = await env.DB.prepare(
    `SELECT a.*, u.name AS created_by_name,
       (SELECT COUNT(*) FROM appliance_services s WHERE s.appliance_id = a.id) AS service_count
     FROM appliances a
     JOIN users u ON u.id = a.created_by
     WHERE a.household_id = ? AND a.deleted_at IS NULL
     ORDER BY a.name ASC`
  ).bind(hId).all()

  return jsonResponse(rows.results)
}

/** POST /api/v1/appliances */
export async function createAppliance(request: Request, env: Env, ctx: AppContext): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const body = await request.json().catch(() => null)
  const hId = (body as Record<string, unknown>)?.household_id as string ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')

  const membership = await getMembership(env, hId, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')
  if (membership.role === 'viewer') return errorResponse('Viewers cannot add appliances', 403, 'FORBIDDEN')

  const parsed = applianceSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR')

  const { name, category, brand, model, serial_no, purchase_date, warranty_expiry, purchase_price, shop, notes } = parsed.data
  const id = generateId()
  const now = new Date().toISOString()

  await env.DB.prepare(`
    INSERT INTO appliances (id, household_id, name, category, brand, model, serial_no, purchase_date, warranty_expiry, purchase_price, shop, notes, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, hId, name, category, brand ?? null, model ?? null, serial_no ?? null, purchase_date ?? null, warranty_expiry ?? null, purchase_price ?? null, shop ?? null, notes ?? null, userId, now, now).run()

  const appliance = await env.DB.prepare('SELECT * FROM appliances WHERE id = ?').bind(id).first()
  return jsonResponse(appliance, 201)
}

/** PATCH /api/v1/appliances/:id */
export async function updateAppliance(request: Request, env: Env, ctx: AppContext, applianceId: string): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const existing = await env.DB.prepare(`SELECT * FROM appliances WHERE id = ? AND deleted_at IS NULL`).bind(applianceId).first<{ household_id: string }>()
  if (!existing) return errorResponse('Appliance not found', 404, 'NOT_FOUND')

  const membership = await getMembership(env, existing.household_id, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')
  if (membership.role === 'viewer') return errorResponse('Viewers cannot edit appliances', 403, 'FORBIDDEN')

  const body = await request.json().catch(() => null)
  const parsed = applianceSchema.partial().safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR')

  const updates: string[] = []
  const values: unknown[] = []
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) { updates.push(`${k} = ?`); values.push(v) }
  }
  if (updates.length === 0) return errorResponse('Nothing to update', 400, 'VALIDATION_ERROR')

  const now = new Date().toISOString()
  updates.push('updated_at = ?'); values.push(now)
  values.push(applianceId)

  await env.DB.prepare(`UPDATE appliances SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
  const updated = await env.DB.prepare('SELECT * FROM appliances WHERE id = ?').bind(applianceId).first()
  return jsonResponse(updated)
}

/** DELETE /api/v1/appliances/:id */
export async function deleteAppliance(_request: Request, env: Env, ctx: AppContext, applianceId: string): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const existing = await env.DB.prepare(`SELECT * FROM appliances WHERE id = ? AND deleted_at IS NULL`).bind(applianceId).first<{ household_id: string }>()
  if (!existing) return errorResponse('Appliance not found', 404, 'NOT_FOUND')

  const membership = await getMembership(env, existing.household_id, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')
  if (membership.role === 'viewer') return errorResponse('Viewers cannot delete appliances', 403, 'FORBIDDEN')

  const now = new Date().toISOString()
  await env.DB.prepare(`UPDATE appliances SET deleted_at = ? WHERE id = ?`).bind(now, applianceId).run()
  return jsonResponse({ success: true })
}

/** POST /api/v1/appliances/:id/services */
export async function addApplianceService(request: Request, env: Env, ctx: AppContext, applianceId: string): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const appliance = await env.DB.prepare(`SELECT * FROM appliances WHERE id = ? AND deleted_at IS NULL`).bind(applianceId).first<{ household_id: string }>()
  if (!appliance) return errorResponse('Appliance not found', 404, 'NOT_FOUND')

  const membership = await getMembership(env, appliance.household_id, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')
  if (membership.role === 'viewer') return errorResponse('Viewers cannot add service records', 403, 'FORBIDDEN')

  const body = await request.json().catch(() => null)
  const parsed = applianceServiceSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR')

  const { service_date, service_type, cost, provider, notes } = parsed.data
  const id = generateId()
  const now = new Date().toISOString()

  await env.DB.prepare(`
    INSERT INTO appliance_services (id, appliance_id, household_id, service_date, service_type, cost, provider, notes, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, applianceId, appliance.household_id, service_date, service_type, cost ?? null, provider ?? null, notes ?? null, userId, now).run()

  const record = await env.DB.prepare('SELECT * FROM appliance_services WHERE id = ?').bind(id).first()
  return jsonResponse(record, 201)
}

/** GET /api/v1/appliances/:id/services */
export async function listApplianceServices(request: Request, env: Env, ctx: AppContext, applianceId: string): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const appliance = await env.DB.prepare(`SELECT * FROM appliances WHERE id = ? AND deleted_at IS NULL`).bind(applianceId).first<{ household_id: string }>()
  if (!appliance) return errorResponse('Appliance not found', 404, 'NOT_FOUND')

  const membership = await getMembership(env, appliance.household_id, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')

  const rows = await env.DB.prepare(
    `SELECT s.*, u.name AS created_by_name FROM appliance_services s
     JOIN users u ON u.id = s.created_by
     WHERE s.appliance_id = ? ORDER BY s.service_date DESC`
  ).bind(applianceId).all()

  return jsonResponse(rows.results)
}

