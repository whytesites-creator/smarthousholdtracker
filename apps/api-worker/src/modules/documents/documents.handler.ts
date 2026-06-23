import { z } from 'zod'
import { jsonResponse, errorResponse, generateId } from '../../utils/helpers'
import type { Env, AppContext } from '../../utils/helpers'

// ─── Constants ───────────────────────────────────────────────────────────────
export const DOC_CATEGORIES = [
  'aadhaar','pan','passport','voter_id','driving_license',
  'insurance','property','vehicle','medical','other',
] as const

// ─── Schemas ─────────────────────────────────────────────────────────────────
const documentSchema = z.object({
  title:       z.string().min(1).max(100),
  category:    z.enum(DOC_CATEGORIES),
  member_name: z.string().max(80).optional(),
  doc_number:  z.string().max(60).optional(),
  issue_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  file_url:    z.string().url().max(500).optional(),
  notes:       z.string().max(500).optional(),
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

/** GET /api/v1/documents */
export async function listDocuments(request: Request, env: Env, ctx: AppContext): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const url = new URL(request.url)
  const hId = url.searchParams.get('household_id') ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')

  const membership = await getMembership(env, hId, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')

  const category = url.searchParams.get('category')
  const conditions: string[] = ['d.household_id = ?', 'd.deleted_at IS NULL']
  const binds: unknown[] = [hId]

  if (category) { conditions.push('d.category = ?'); binds.push(category) }

  const rows = await env.DB.prepare(
    `SELECT d.*, u.name AS created_by_name
     FROM documents d JOIN users u ON u.id = d.created_by
     WHERE ${conditions.join(' AND ')}
     ORDER BY d.category ASC, d.title ASC`
  ).bind(...binds).all()

  return jsonResponse(rows.results)
}

/** POST /api/v1/documents */
export async function createDocument(request: Request, env: Env, ctx: AppContext): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const body = await request.json().catch(() => null)
  const hId = (body as Record<string, unknown>)?.household_id as string ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')

  const membership = await getMembership(env, hId, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')
  if (membership.role === 'viewer') return errorResponse('Viewers cannot add documents', 403, 'FORBIDDEN')

  const parsed = documentSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR')

  const { title, category, member_name, doc_number, issue_date, expiry_date, file_url, notes } = parsed.data
  const id = generateId()
  const now = new Date().toISOString()

  await env.DB.prepare(`
    INSERT INTO documents (id, household_id, title, category, member_name, doc_number, issue_date, expiry_date, file_url, notes, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, hId, title, category, member_name ?? null, doc_number ?? null, issue_date ?? null, expiry_date ?? null, file_url ?? null, notes ?? null, userId, now, now).run()

  const doc = await env.DB.prepare('SELECT * FROM documents WHERE id = ?').bind(id).first()
  return jsonResponse(doc, 201)
}

/** PATCH /api/v1/documents/:id */
export async function updateDocument(request: Request, env: Env, ctx: AppContext, documentId: string): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const existing = await env.DB.prepare(`SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL`).bind(documentId).first<{ household_id: string }>()
  if (!existing) return errorResponse('Document not found', 404, 'NOT_FOUND')

  const membership = await getMembership(env, existing.household_id, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')
  if (membership.role === 'viewer') return errorResponse('Viewers cannot edit documents', 403, 'FORBIDDEN')

  const body = await request.json().catch(() => null)
  const parsed = documentSchema.partial().safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400, 'VALIDATION_ERROR')

  const updates: string[] = []
  const values: unknown[] = []
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) { updates.push(`${k} = ?`); values.push(v) }
  }
  if (updates.length === 0) return errorResponse('Nothing to update', 400, 'VALIDATION_ERROR')

  const now = new Date().toISOString()
  updates.push('updated_at = ?'); values.push(now)
  values.push(documentId)

  await env.DB.prepare(`UPDATE documents SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
  const updated = await env.DB.prepare('SELECT * FROM documents WHERE id = ?').bind(documentId).first()
  return jsonResponse(updated)
}

/** DELETE /api/v1/documents/:id */
export async function deleteDocument(_request: Request, env: Env, ctx: AppContext, documentId: string): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const existing = await env.DB.prepare(`SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL`).bind(documentId).first<{ household_id: string }>()
  if (!existing) return errorResponse('Document not found', 404, 'NOT_FOUND')

  const membership = await getMembership(env, existing.household_id, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')
  if (membership.role === 'viewer') return errorResponse('Viewers cannot delete documents', 403, 'FORBIDDEN')

  const now = new Date().toISOString()
  await env.DB.prepare(`UPDATE documents SET deleted_at = ? WHERE id = ?`).bind(now, documentId).run()
  return jsonResponse({ success: true })
}

/** GET /api/v1/documents/expiring  — docs expiring in next N days */
export async function getExpiringDocuments(request: Request, env: Env, ctx: AppContext): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const url = new URL(request.url)
  const hId = url.searchParams.get('household_id') ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')

  const membership = await getMembership(env, hId, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')

  const days = Number(url.searchParams.get('days') ?? 90)
  const today = new Date().toISOString().split('T')[0]
  const future = new Date(Date.now() + days * 86400000).toISOString().split('T')[0]

  const rows = await env.DB.prepare(
    `SELECT * FROM documents
     WHERE household_id = ? AND deleted_at IS NULL
       AND expiry_date IS NOT NULL AND expiry_date BETWEEN ? AND ?
     ORDER BY expiry_date ASC`
  ).bind(hId, today, future).all()

  return jsonResponse(rows.results)
}

