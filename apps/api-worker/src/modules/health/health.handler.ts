import { z } from 'zod'
import { jsonResponse, errorResponse, generateId } from '../../utils/helpers'
import type { Env, AppContext } from '../../utils/helpers'

// ─── Constants ───────────────────────────────────────────────────────────────
export const RELATIONS = ['self','spouse','child','parent','grandparent','sibling','other'] as const
export const REMINDER_TYPES = ['medicine','vaccine','doctor','checkup','other'] as const
export const RECURRENCES = ['none','daily','weekly','monthly','yearly'] as const

// ─── Schemas ─────────────────────────────────────────────────────────────────
const memberSchema = z.object({
  name:        z.string().min(1).max(80),
  dob:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  relation:    z.enum(RELATIONS),
  blood_group: z.string().max(5).optional(),
})

const reminderSchema = z.object({
  member_id:  z.string().optional(),
  type:       z.enum(REMINDER_TYPES),
  title:      z.string().min(1).max(200),
  due_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recurrence: z.enum(RECURRENCES).default('none'),
  notes:      z.string().max(500).optional(),
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

// ─── Health Members ───────────────────────────────────────────────────────────

/** GET /api/v1/health/members */
export async function listHealthMembers(request: Request, env: Env, ctx: AppContext): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const hId = new URL(request.url).searchParams.get('household_id') ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')

  const membership = await getMembership(env, hId, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')

  const rows = await env.DB.prepare(
    `SELECT hm.*, u.name AS created_by_name,
       (SELECT COUNT(*) FROM health_reminders r WHERE r.member_id = hm.id AND r.status = 'pending' AND r.deleted_at IS NULL) AS pending_reminders
     FROM health_members hm JOIN users u ON u.id = hm.created_by
     WHERE hm.household_id = ? ORDER BY hm.name ASC`
  ).bind(hId).all()

  return jsonResponse(rows.results)
}

/** POST /api/v1/health/members */
export async function createHealthMember(request: Request, env: Env, ctx: AppContext): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const body = await request.json().catch(() => null)
  const hId = (body as Record<string, unknown>)?.household_id as string ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')

  const membership = await getMembership(env, hId, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')
  if (membership.role === 'viewer') return errorResponse('Viewers cannot add members', 403, 'FORBIDDEN')

  const parsed = memberSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR')

  const { name, dob, relation, blood_group } = parsed.data
  const id = generateId()
  const now = new Date().toISOString()

  await env.DB.prepare(`
    INSERT INTO health_members (id, household_id, name, dob, relation, blood_group, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, hId, name, dob ?? null, relation, blood_group ?? null, userId, now, now).run()

  const member = await env.DB.prepare('SELECT * FROM health_members WHERE id = ?').bind(id).first()
  return jsonResponse(member, 201)
}

/** DELETE /api/v1/health/members/:id */
export async function deleteHealthMember(_request: Request, env: Env, ctx: AppContext, memberId: string): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const existing = await env.DB.prepare('SELECT * FROM health_members WHERE id = ?').bind(memberId).first<{ household_id: string }>()
  if (!existing) return errorResponse('Member not found', 404, 'NOT_FOUND')

  const membership = await getMembership(env, existing.household_id, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')
  if (membership.role === 'viewer') return errorResponse('Viewers cannot delete members', 403, 'FORBIDDEN')

  await env.DB.prepare('DELETE FROM health_members WHERE id = ?').bind(memberId).run()
  return jsonResponse({ success: true })
}

// ─── Health Reminders ─────────────────────────────────────────────────────────

/** GET /api/v1/health/reminders */
export async function listReminders(request: Request, env: Env, ctx: AppContext): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const url = new URL(request.url)
  const hId = url.searchParams.get('household_id') ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')

  const membership = await getMembership(env, hId, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')

  const status = url.searchParams.get('status') // pending | done | skipped
  const type   = url.searchParams.get('type')

  const conditions: string[] = ['r.household_id = ?', 'r.deleted_at IS NULL']
  const binds: unknown[] = [hId]

  if (status) { conditions.push('r.status = ?'); binds.push(status) }
  if (type)   { conditions.push('r.type = ?');   binds.push(type) }

  const rows = await env.DB.prepare(
    `SELECT r.*, hm.name AS member_name, u.name AS created_by_name
     FROM health_reminders r
     LEFT JOIN health_members hm ON hm.id = r.member_id
     JOIN users u ON u.id = r.created_by
     WHERE ${conditions.join(' AND ')}
     ORDER BY r.due_date ASC, r.created_at ASC`
  ).bind(...binds).all()

  return jsonResponse(rows.results)
}

/** POST /api/v1/health/reminders */
export async function createReminder(request: Request, env: Env, ctx: AppContext): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const body = await request.json().catch(() => null)
  const hId = (body as Record<string, unknown>)?.household_id as string ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')

  const membership = await getMembership(env, hId, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')
  if (membership.role === 'viewer') return errorResponse('Viewers cannot add reminders', 403, 'FORBIDDEN')

  const parsed = reminderSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR')

  const { member_id, type, title, due_date, recurrence, notes } = parsed.data
  const id = generateId()
  const now = new Date().toISOString()

  await env.DB.prepare(`
    INSERT INTO health_reminders (id, household_id, member_id, type, title, due_date, recurrence, notes, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `).bind(id, hId, member_id ?? null, type, title, due_date, recurrence, notes ?? null, userId, now, now).run()

  const reminder = await env.DB.prepare(
    `SELECT r.*, hm.name AS member_name FROM health_reminders r LEFT JOIN health_members hm ON hm.id = r.member_id WHERE r.id = ?`
  ).bind(id).first()
  return jsonResponse(reminder, 201)
}

/** PATCH /api/v1/health/reminders/:id */
export async function updateReminder(request: Request, env: Env, ctx: AppContext, reminderId: string): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const existing = await env.DB.prepare(`SELECT * FROM health_reminders WHERE id = ? AND deleted_at IS NULL`).bind(reminderId).first<{ household_id: string }>()
  if (!existing) return errorResponse('Reminder not found', 404, 'NOT_FOUND')

  const membership = await getMembership(env, existing.household_id, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')
  if (membership.role === 'viewer') return errorResponse('Viewers cannot edit reminders', 403, 'FORBIDDEN')

  const body = await request.json().catch(() => null)
  const parsed = reminderSchema.partial().extend({ status: z.enum(['pending','done','skipped']).optional() }).safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR')

  const updates: string[] = []
  const values: unknown[] = []
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) { updates.push(`${k} = ?`); values.push(v) }
  }
  if (updates.length === 0) return errorResponse('Nothing to update', 400, 'VALIDATION_ERROR')

  const now = new Date().toISOString()
  updates.push('updated_at = ?'); values.push(now)
  values.push(reminderId)

  await env.DB.prepare(`UPDATE health_reminders SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
  const updated = await env.DB.prepare(
    `SELECT r.*, hm.name AS member_name FROM health_reminders r LEFT JOIN health_members hm ON hm.id = r.member_id WHERE r.id = ?`
  ).bind(reminderId).first()
  return jsonResponse(updated)
}

/** DELETE /api/v1/health/reminders/:id */
export async function deleteReminder(_request: Request, env: Env, ctx: AppContext, reminderId: string): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const existing = await env.DB.prepare(`SELECT * FROM health_reminders WHERE id = ? AND deleted_at IS NULL`).bind(reminderId).first<{ household_id: string }>()
  if (!existing) return errorResponse('Reminder not found', 404, 'NOT_FOUND')

  const membership = await getMembership(env, existing.household_id, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')
  if (membership.role === 'viewer') return errorResponse('Viewers cannot delete reminders', 403, 'FORBIDDEN')

  const now = new Date().toISOString()
  await env.DB.prepare(`UPDATE health_reminders SET deleted_at = ?, status = 'skipped' WHERE id = ?`).bind(now, reminderId).run()
  return jsonResponse({ success: true })
}

/** POST /api/v1/health/reminders/:id/complete  */
export async function completeReminder(request: Request, env: Env, ctx: AppContext, reminderId: string): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const existing = await env.DB.prepare(`SELECT * FROM health_reminders WHERE id = ? AND deleted_at IS NULL`
  ).bind(reminderId).first<{ household_id: string; recurrence: string; due_date: string; member_id: string | null; type: string; title: string }>()
  if (!existing) return errorResponse('Reminder not found', 404, 'NOT_FOUND')

  const membership = await getMembership(env, existing.household_id, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')

  const now = new Date().toISOString()
  await env.DB.prepare(`UPDATE health_reminders SET status = 'done', updated_at = ? WHERE id = ?`).bind(now, reminderId).run()

  // If recurring, create next reminder
  let nextReminder = null
  if (existing.recurrence !== 'none') {
    const dueDate = new Date(existing.due_date)
    switch (existing.recurrence) {
      case 'daily':   dueDate.setDate(dueDate.getDate() + 1); break
      case 'weekly':  dueDate.setDate(dueDate.getDate() + 7); break
      case 'monthly': dueDate.setMonth(dueDate.getMonth() + 1); break
      case 'yearly':  dueDate.setFullYear(dueDate.getFullYear() + 1); break
    }
    const nextId = generateId()
    const nextDue = dueDate.toISOString().split('T')[0]
    await env.DB.prepare(`
      INSERT INTO health_reminders (id, household_id, member_id, type, title, due_date, recurrence, status, created_by, created_at, updated_at)
      SELECT ?, household_id, member_id, type, title, ?, recurrence, 'pending', created_by, ?, ?
      FROM health_reminders WHERE id = ?
    `).bind(nextId, nextDue, now, now, reminderId).run()
    nextReminder = { id: nextId, due_date: nextDue }
  }

  return jsonResponse({ success: true, nextReminder })
}

