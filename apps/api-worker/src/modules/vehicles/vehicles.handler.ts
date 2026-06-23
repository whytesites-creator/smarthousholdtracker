import { z } from 'zod'
import { jsonResponse, errorResponse, generateId } from '../../utils/helpers'
import type { Env, AppContext } from '../../utils/helpers'

// ─── Constants ───────────────────────────────────────────────────────────────
export const FUEL_TYPES = ['petrol', 'diesel', 'cng', 'electric', 'hybrid'] as const
export const SERVICE_TYPES = ['regular', 'repair', 'insurance_renewal', 'puc', 'tyre', 'other'] as const

// ─── Schemas ─────────────────────────────────────────────────────────────────
const vehicleSchema = z.object({
  nickname:         z.string().min(1).max(80),
  make:             z.string().max(60).optional(),
  model:            z.string().max(60).optional(),
  year:             z.number().int().min(1900).max(2100).optional(),
  reg_number:       z.string().max(20).optional(),
  fuel_type:        z.enum(FUEL_TYPES).default('petrol'),
  color:            z.string().max(30).optional(),
  insurance_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  puc_expiry:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  last_service:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  next_service:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:            z.string().max(500).optional(),
})

const serviceSchema = z.object({
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  service_type: z.enum(SERVICE_TYPES),
  odometer:     z.number().int().positive().optional(),
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

/** GET /api/v1/vehicles */
export async function listVehicles(request: Request, env: Env, ctx: AppContext): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const hId = new URL(request.url).searchParams.get('household_id') ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')

  const membership = await getMembership(env, hId, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')

  const rows = await env.DB.prepare(
    `SELECT v.*, u.name AS created_by_name,
       (SELECT COUNT(*) FROM vehicle_services vs WHERE vs.vehicle_id = v.id) AS service_count
     FROM vehicles v
     JOIN users u ON u.id = v.created_by
     WHERE v.household_id = ? AND v.deleted_at IS NULL
     ORDER BY v.created_at DESC`
  ).bind(hId).all()

  return jsonResponse(rows.results)
}

/** POST /api/v1/vehicles */
export async function createVehicle(request: Request, env: Env, ctx: AppContext): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const body = await request.json().catch(() => null)
  const hId = (body as Record<string, unknown>)?.household_id as string ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')

  const membership = await getMembership(env, hId, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')
  if (membership.role === 'viewer') return errorResponse('Viewers cannot add vehicles', 403, 'FORBIDDEN')

  const parsed = vehicleSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR')

  const { nickname, make, model, year, reg_number, fuel_type, color, insurance_expiry, puc_expiry, last_service, next_service, notes } = parsed.data
  const id = generateId()
  const now = new Date().toISOString()

  await env.DB.prepare(`
    INSERT INTO vehicles (id, household_id, nickname, make, model, year, reg_number, fuel_type, color, insurance_expiry, puc_expiry, last_service, next_service, notes, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, hId, nickname, make ?? null, model ?? null, year ?? null, reg_number ?? null, fuel_type, color ?? null, insurance_expiry ?? null, puc_expiry ?? null, last_service ?? null, next_service ?? null, notes ?? null, userId, now, now).run()

  const vehicle = await env.DB.prepare('SELECT * FROM vehicles WHERE id = ?').bind(id).first()
  return jsonResponse(vehicle, 201)
}

/** PATCH /api/v1/vehicles/:id */
export async function updateVehicle(request: Request, env: Env, ctx: AppContext, vehicleId: string): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const existing = await env.DB.prepare(`SELECT * FROM vehicles WHERE id = ? AND deleted_at IS NULL`).bind(vehicleId).first<{ household_id: string }>()
  if (!existing) return errorResponse('Vehicle not found', 404, 'NOT_FOUND')

  const membership = await getMembership(env, existing.household_id, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')
  if (membership.role === 'viewer') return errorResponse('Viewers cannot edit vehicles', 403, 'FORBIDDEN')

  const body = await request.json().catch(() => null)
  const parsed = vehicleSchema.partial().safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR')

  const fields = parsed.data
  const updates: string[] = []
  const values: unknown[] = []

  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) { updates.push(`${k} = ?`); values.push(v) }
  }
  if (updates.length === 0) return errorResponse('Nothing to update', 400, 'VALIDATION_ERROR')

  const now = new Date().toISOString()
  updates.push('updated_at = ?'); values.push(now)
  values.push(vehicleId)

  await env.DB.prepare(`UPDATE vehicles SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
  const updated = await env.DB.prepare('SELECT * FROM vehicles WHERE id = ?').bind(vehicleId).first()
  return jsonResponse(updated)
}

/** DELETE /api/v1/vehicles/:id */
export async function deleteVehicle(_request: Request, env: Env, ctx: AppContext, vehicleId: string): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const existing = await env.DB.prepare(`SELECT * FROM vehicles WHERE id = ? AND deleted_at IS NULL`).bind(vehicleId).first<{ household_id: string }>()
  if (!existing) return errorResponse('Vehicle not found', 404, 'NOT_FOUND')

  const membership = await getMembership(env, existing.household_id, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')
  if (membership.role === 'viewer') return errorResponse('Viewers cannot delete vehicles', 403, 'FORBIDDEN')

  const now = new Date().toISOString()
  await env.DB.prepare(`UPDATE vehicles SET deleted_at = ? WHERE id = ?`).bind(now, vehicleId).run()
  return jsonResponse({ success: true })
}

/** POST /api/v1/vehicles/:id/services */
export async function addVehicleService(request: Request, env: Env, ctx: AppContext, vehicleId: string): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const vehicle = await env.DB.prepare(`SELECT * FROM vehicles WHERE id = ? AND deleted_at IS NULL`).bind(vehicleId).first<{ household_id: string }>()
  if (!vehicle) return errorResponse('Vehicle not found', 404, 'NOT_FOUND')

  const membership = await getMembership(env, vehicle.household_id, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')
  if (membership.role === 'viewer') return errorResponse('Viewers cannot add service records', 403, 'FORBIDDEN')

  const body = await request.json().catch(() => null)
  const parsed = serviceSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR')

  const { service_date, service_type, odometer, cost, provider, notes } = parsed.data
  const id = generateId()
  const now = new Date().toISOString()

  await env.DB.prepare(`
    INSERT INTO vehicle_services (id, vehicle_id, household_id, service_date, service_type, odometer, cost, provider, notes, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, vehicleId, vehicle.household_id, service_date, service_type, odometer ?? null, cost ?? null, provider ?? null, notes ?? null, userId, now).run()

  // Update last_service on vehicle if this is more recent
  await env.DB.prepare(`UPDATE vehicles SET last_service = ?, updated_at = ? WHERE id = ? AND (last_service IS NULL OR last_service < ?)`
  ).bind(service_date, now, vehicleId, service_date).run()

  const record = await env.DB.prepare('SELECT * FROM vehicle_services WHERE id = ?').bind(id).first()
  return jsonResponse(record, 201)
}

/** GET /api/v1/vehicles/:id/services */
export async function listVehicleServices(request: Request, env: Env, ctx: AppContext, vehicleId: string): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const vehicle = await env.DB.prepare(`SELECT * FROM vehicles WHERE id = ? AND deleted_at IS NULL`).bind(vehicleId).first<{ household_id: string }>()
  if (!vehicle) return errorResponse('Vehicle not found', 404, 'NOT_FOUND')

  const membership = await getMembership(env, vehicle.household_id, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')

  const rows = await env.DB.prepare(
    `SELECT vs.*, u.name AS created_by_name FROM vehicle_services vs
     JOIN users u ON u.id = vs.created_by
     WHERE vs.vehicle_id = ? ORDER BY vs.service_date DESC`
  ).bind(vehicleId).all()

  return jsonResponse(rows.results)
}

