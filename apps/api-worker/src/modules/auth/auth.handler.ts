import { z } from 'zod'
import { jsonResponse, errorResponse, generateId } from '../../utils/helpers'
import type { Env, AppContext } from '../../utils/helpers'

// ─── Schema ──────────────────────────────────────────────────────────────────

const syncProfileSchema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
})

const profileUpdateSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  phone: z.string().optional(),
  timezone: z.string().optional(),
})

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/sync-profile
 * Called right after Supabase signUp to create/upsert the app-level user row.
 */
export async function syncProfile(request: Request, env: Env, ctx: AppContext): Promise<Response> {
  const body = await request.json().catch(() => null)
  const parsed = syncProfileSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('Validation failed: ' + parsed.error.issues[0]?.message, 400, 'VALIDATION_ERROR')
  }

  const { name, email } = parsed.data
  const id = generateId()
  const now = new Date().toISOString()

  await env.DB.prepare(`
    INSERT INTO users (id, supabase_user_id, email, name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(supabase_user_id) DO UPDATE SET
      email = excluded.email,
      name = excluded.name,
      updated_at = excluded.updated_at
  `).bind(id, ctx.userId, email, name, now, now).run()

  // Log session event
  await env.DB.prepare(`
    INSERT INTO sessions_audit (id, user_id, event, created_at)
    VALUES (?, (SELECT id FROM users WHERE supabase_user_id = ?), 'register', ?)
  `).bind(generateId(), ctx.userId, now).run()

  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE supabase_user_id = ?'
  ).bind(ctx.userId).first()

  return jsonResponse(user, 201)
}

/**
 * GET /api/v1/profile
 * Returns the authenticated user's profile.
 */
export async function getProfile(_request: Request, env: Env, ctx: AppContext): Promise<Response> {
  const user = await env.DB.prepare(
    'SELECT id, email, name, phone, timezone, created_at FROM users WHERE supabase_user_id = ?'
  ).bind(ctx.userId).first()

  if (!user) return errorResponse('Profile not found', 404, 'NOT_FOUND')
  return jsonResponse(user)
}

/**
 * PATCH /api/v1/profile
 * Update user profile fields.
 */
export async function updateProfile(request: Request, env: Env, ctx: AppContext): Promise<Response> {
  const body = await request.json().catch(() => null)
  const parsed = profileUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('Validation error: ' + parsed.error.issues[0]?.message, 400, 'VALIDATION_ERROR')
  }

  const { name, phone, timezone } = parsed.data
  const now = new Date().toISOString()

  const updates: string[] = []
  const values: unknown[] = []

  if (name !== undefined) { updates.push('name = ?'); values.push(name) }
  if (phone !== undefined) { updates.push('phone = ?'); values.push(phone) }
  if (timezone !== undefined) { updates.push('timezone = ?'); values.push(timezone) }
  updates.push('updated_at = ?'); values.push(now)
  values.push(ctx.userId)

  await env.DB.prepare(
    `UPDATE users SET ${updates.join(', ')} WHERE supabase_user_id = ?`
  ).bind(...values).run()

  const user = await env.DB.prepare(
    'SELECT id, email, name, phone, timezone, created_at FROM users WHERE supabase_user_id = ?'
  ).bind(ctx.userId).first()

  return jsonResponse(user)
}

