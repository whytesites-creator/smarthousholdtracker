import { z } from 'zod'
import { jsonResponse, errorResponse, generateId } from '../../utils/helpers'
import type { Env, AppContext } from '../../utils/helpers'

// ─── Schemas ─────────────────────────────────────────────────────────────────

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
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
 * POST /api/v1/households/:id/invites
 * Create an invite for a new member. Only owner/admin may invite.
 */
export async function createInvite(
  request: Request,
  env: Env,
  ctx: AppContext,
  householdId: string
): Promise<Response> {
  const callerAppId = await getAppUserId(env, ctx.userId)
  if (!callerAppId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const callerRole = await getMemberRole(env, householdId, callerAppId)
  if (!callerRole || !['owner', 'admin'].includes(callerRole)) {
    return errorResponse('Insufficient permissions to invite', 403, 'FORBIDDEN')
  }

  const body = await request.json().catch(() => null)
  const parsed = inviteMemberSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR')
  }

  const { email, role } = parsed.data
  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  // Check for active pending invite for the same email+household
  const existing = await env.DB.prepare(`
    SELECT id FROM invites
    WHERE household_id = ? AND email = ? AND status = 'pending'
  `).bind(householdId, email).first()

  if (existing) {
    return errorResponse('An active invite already exists for this email', 409, 'CONFLICT')
  }

  const inviteId = generateId()
  // Token is a secure 64-hex-char string
  const tokenBytes = new Uint8Array(32)
  crypto.getRandomValues(tokenBytes)
  const token = Array.from(tokenBytes, (b) => b.toString(16).padStart(2, '0')).join('')

  await env.DB.prepare(`
    INSERT INTO invites (id, household_id, invited_by, email, role, token, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(inviteId, householdId, callerAppId, email, role, token, expiresAt, now).run()

  // Audit
  await env.DB.prepare(`
    INSERT INTO audit_logs (id, household_id, actor_user_id, action, entity_type, entity_id, at)
    VALUES (?, ?, ?, 'INVITE_SENT', 'invite', ?, ?)
  `).bind(generateId(), householdId, callerAppId, inviteId, now).run()

  // In production: send an email with the invite link here
  // For now, return the invite details (token visible to admin/owner)
  return jsonResponse({ id: inviteId, email, role, token, expiresAt }, 201)
}

/**
 * POST /api/v1/invites/:token/accept
 * Accept a household invite. Must be authenticated.
 */
export async function acceptInvite(
  _request: Request,
  env: Env,
  ctx: AppContext,
  token: string
): Promise<Response> {
  const callerAppId = await getAppUserId(env, ctx.userId)
  if (!callerAppId) return errorResponse('User not found — please complete registration first', 404, 'NOT_FOUND')

  const now = new Date().toISOString()

  // Fetch invite
  const invite = await env.DB.prepare(`
    SELECT * FROM invites WHERE token = ?
  `).bind(token).first<{
    id: string; household_id: string; email: string; role: string;
    status: string; expires_at: string
  }>()

  if (!invite) return errorResponse('Invite not found', 404, 'NOT_FOUND')

  // Edge case: already used
  if (invite.status !== 'pending') {
    return errorResponse(
      invite.status === 'accepted'
        ? 'This invite has already been accepted'
        : 'This invite has been revoked or expired',
      410,
      'INVITE_USED'
    )
  }

  // Edge case: expired
  if (new Date(invite.expires_at) < new Date()) {
    await env.DB.prepare(
      `UPDATE invites SET status = 'expired' WHERE id = ?`
    ).bind(invite.id).run()
    return errorResponse('This invite link has expired. Please request a new one.', 410, 'INVITE_EXPIRED')
  }

  // Edge case: email mismatch
  const user = await env.DB.prepare(
    'SELECT email FROM users WHERE id = ?'
  ).bind(callerAppId).first<{ email: string }>()

  if (user?.email !== invite.email) {
    return errorResponse(
      'This invite was sent to a different email address',
      403,
      'INVITE_EMAIL_MISMATCH'
    )
  }

  // Check if already a member
  const existingMembership = await env.DB.prepare(`
    SELECT id FROM household_memberships WHERE household_id = ? AND user_id = ?
  `).bind(invite.household_id, callerAppId).first()

  if (existingMembership) {
    return errorResponse('You are already a member of this household', 409, 'ALREADY_MEMBER')
  }

  // Create membership
  const membershipId = generateId()
  await env.DB.prepare(`
    INSERT INTO household_memberships (id, household_id, user_id, role, status, joined_at)
    VALUES (?, ?, ?, ?, 'active', ?)
  `).bind(membershipId, invite.household_id, callerAppId, invite.role, now).run()

  // Mark invite as accepted
  await env.DB.prepare(`
    UPDATE invites SET status = 'accepted', accepted_at = ? WHERE id = ?
  `).bind(now, invite.id).run()

  // Session audit
  await env.DB.prepare(`
    INSERT INTO sessions_audit (id, user_id, event, created_at)
    VALUES (?, ?, 'invite_accepted', ?)
  `).bind(generateId(), callerAppId, now).run()

  // Audit log
  await env.DB.prepare(`
    INSERT INTO audit_logs (id, household_id, actor_user_id, action, entity_type, entity_id, at)
    VALUES (?, ?, ?, 'INVITE_ACCEPTED', 'invite', ?, ?)
  `).bind(generateId(), invite.household_id, callerAppId, invite.id, now).run()

  const household = await env.DB.prepare(
    'SELECT id, name, timezone, currency FROM households WHERE id = ?'
  ).bind(invite.household_id).first()

  return jsonResponse({ household, role: invite.role })
}

