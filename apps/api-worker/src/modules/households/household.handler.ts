import { z } from 'zod'
import { jsonResponse, errorResponse, generateId } from '../../utils/helpers'
import type { Env, AppContext } from '../../utils/helpers'

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createHouseholdSchema = z.object({
  name: z.string().min(2).max(80),
  timezone: z.string().default('Asia/Kolkata'),
  currency: z.string().default('INR'),
})

const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer']),
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getAppUserId(env: Env, supabaseUserId: string): Promise<string | null> {
  const row = await env.DB.prepare(
    'SELECT id FROM users WHERE supabase_user_id = ?'
  ).bind(supabaseUserId).first<{ id: string }>()
  return row?.id ?? null
}

async function getMemberRole(
  env: Env,
  householdId: string,
  userId: string
): Promise<string | null> {
  const row = await env.DB.prepare(
    `SELECT role FROM household_memberships
     WHERE household_id = ? AND user_id = ? AND status = 'active'`
  ).bind(householdId, userId).first<{ role: string }>()
  return row?.role ?? null
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/households
 * List all households the caller belongs to.
 */
export async function getHouseholds(
  _request: Request,
  env: Env,
  ctx: AppContext
): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const result = await env.DB.prepare(`
    SELECT h.id, h.name, h.timezone, h.currency, h.created_at, hm.role
    FROM households h
    JOIN household_memberships hm ON hm.household_id = h.id
    WHERE hm.user_id = ? AND hm.status = 'active'
    ORDER BY h.created_at ASC
  `).bind(userId).all()

  return jsonResponse(result.results)
}

/**
 * POST /api/v1/households
 * Create a new household and make the caller the owner.
 */
export async function createHousehold(
  request: Request,
  env: Env,
  ctx: AppContext
): Promise<Response> {
  const body = await request.json().catch(() => null)
  const parsed = createHouseholdSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR')
  }

  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const id = generateId()
  const membershipId = generateId()
  const now = new Date().toISOString()
  const { name, timezone, currency } = parsed.data

  await env.DB.prepare(`
    INSERT INTO households (id, name, timezone, currency, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, name, timezone, currency, userId, now, now).run()

  await env.DB.prepare(`
    INSERT INTO household_memberships (id, household_id, user_id, role, status, joined_at)
    VALUES (?, ?, ?, 'owner', 'active', ?)
  `).bind(membershipId, id, userId, now).run()

  // Audit log
  await env.DB.prepare(`
    INSERT INTO audit_logs (id, household_id, actor_user_id, action, entity_type, entity_id, at)
    VALUES (?, ?, ?, 'CREATE', 'household', ?, ?)
  `).bind(generateId(), id, userId, id, now).run()

  const household = await env.DB.prepare(
    'SELECT * FROM households WHERE id = ?'
  ).bind(id).first()

  return jsonResponse({ ...household, role: 'owner' }, 201)
}

/**
 * POST /api/v1/households/switch
 * Records household preference; primarily client-side context but can log on server.
 */
export async function switchHousehold(
  request: Request,
  env: Env,
  ctx: AppContext
): Promise<Response> {
  const body = await request.json().catch(() => ({})) as { householdId?: string }
  const { householdId } = body
  if (!householdId) return errorResponse('householdId is required', 400, 'VALIDATION_ERROR')

  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const role = await getMemberRole(env, householdId, userId)
  if (!role) return errorResponse('Not a member of this household', 403, 'FORBIDDEN')

  const household = await env.DB.prepare(
    'SELECT id, name, timezone, currency FROM households WHERE id = ?'
  ).bind(householdId).first()

  return jsonResponse({ ...household, role })
}

/**
 * GET /api/v1/households/:id/members
 * List members of a household.
 */
export async function getHouseholdMembers(
  _request: Request,
  env: Env,
  ctx: AppContext,
  householdId: string
): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const role = await getMemberRole(env, householdId, userId)
  if (!role) return errorResponse('Access denied', 403, 'FORBIDDEN')

  const result = await env.DB.prepare(`
    SELECT u.id AS user_id, u.name, u.email, hm.role, hm.status, hm.joined_at
    FROM household_memberships hm
    JOIN users u ON u.id = hm.user_id
    WHERE hm.household_id = ?
    ORDER BY
      CASE hm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'member' THEN 2 ELSE 3 END,
      hm.joined_at ASC
  `).bind(householdId).all()

  return jsonResponse(result.results)
}

/**
 * PATCH /api/v1/households/:householdId/members/:userId
 * Update a member's role (owner/admin only).
 */
export async function updateMemberRole(
  request: Request,
  env: Env,
  ctx: AppContext,
  householdId: string,
  targetUserId: string
): Promise<Response> {
  const callerAppId = await getAppUserId(env, ctx.userId)
  if (!callerAppId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const callerRole = await getMemberRole(env, householdId, callerAppId)
  if (!callerRole || !['owner', 'admin'].includes(callerRole)) {
    return errorResponse('Insufficient permissions', 403, 'FORBIDDEN')
  }

  const body = await request.json().catch(() => null)
  const parsed = updateMemberRoleSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('Invalid role', 400, 'VALIDATION_ERROR')
  }

  // Cannot change owner's role
  const targetRole = await getMemberRole(env, householdId, targetUserId)
  if (targetRole === 'owner') {
    return errorResponse('Cannot change the owner\'s role', 403, 'FORBIDDEN')
  }

  const now = new Date().toISOString()
  await env.DB.prepare(`
    UPDATE household_memberships SET role = ?
    WHERE household_id = ? AND user_id = ?
  `).bind(parsed.data.role, householdId, targetUserId).run()

  // Audit
  await env.DB.prepare(`
    INSERT INTO audit_logs (id, household_id, actor_user_id, action, entity_type, entity_id, before_json, after_json, at)
    VALUES (?, ?, ?, 'UPDATE_ROLE', 'household_membership', ?, ?, ?, ?)
  `).bind(
    generateId(), householdId, callerAppId,
    targetUserId,
    JSON.stringify({ role: targetRole }),
    JSON.stringify({ role: parsed.data.role }),
    now
  ).run()

  return jsonResponse({ success: true })
}

/**
 * DELETE /api/v1/households/:householdId/members/:userId
 * Remove a member (owner/admin only).
 */
export async function removeMember(
  _request: Request,
  env: Env,
  ctx: AppContext,
  householdId: string,
  targetUserId: string
): Promise<Response> {
  const callerAppId = await getAppUserId(env, ctx.userId)
  if (!callerAppId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const callerRole = await getMemberRole(env, householdId, callerAppId)
  if (!callerRole || !['owner', 'admin'].includes(callerRole)) {
    return errorResponse('Insufficient permissions', 403, 'FORBIDDEN')
  }

  const targetRole = await getMemberRole(env, householdId, targetUserId)
  if (targetRole === 'owner') {
    return errorResponse('Cannot remove the household owner', 403, 'FORBIDDEN')
  }

  const now = new Date().toISOString()
  await env.DB.prepare(`
    DELETE FROM household_memberships WHERE household_id = ? AND user_id = ?
  `).bind(householdId, targetUserId).run()

  // Audit
  await env.DB.prepare(`
    INSERT INTO audit_logs (id, household_id, actor_user_id, action, entity_type, entity_id, at)
    VALUES (?, ?, ?, 'REMOVE_MEMBER', 'household_membership', ?, ?)
  `).bind(generateId(), householdId, callerAppId, targetUserId, now).run()

  return jsonResponse({ success: true })
}

