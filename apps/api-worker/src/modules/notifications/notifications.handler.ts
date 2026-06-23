import { jsonResponse, errorResponse, generateId } from '../../utils/helpers'
import type { Env, AppContext } from '../../utils/helpers'

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

/** GET /api/v1/notifications */
export async function listNotifications(request: Request, env: Env, ctx: AppContext): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const url = new URL(request.url)
  const hId = url.searchParams.get('household_id') ?? ctx.householdId
  const onlyUnread = url.searchParams.get('unread') === 'true'
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100)

  const conditions: string[] = ['user_id = ?']
  const binds: unknown[] = [userId]

  if (hId) { conditions.push('household_id = ?'); binds.push(hId) }
  if (onlyUnread) { conditions.push('is_read = 0') }

  const rows = await env.DB.prepare(
    `SELECT * FROM notifications WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT ?`
  ).bind(...binds, limit).all()

  const unreadCount = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0${hId ? ' AND household_id = ?' : ''}`
  ).bind(...(hId ? [userId, hId] : [userId])).first<{ count: number }>()

  return jsonResponse({ notifications: rows.results, unreadCount: unreadCount?.count ?? 0 })
}

/** POST /api/v1/notifications/:id/read */
export async function markNotificationRead(_request: Request, env: Env, ctx: AppContext, notifId: string): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const notif = await env.DB.prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?').bind(notifId, userId).first()
  if (!notif) return errorResponse('Notification not found', 404, 'NOT_FOUND')

  await env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').bind(notifId).run()
  return jsonResponse({ success: true })
}

/** POST /api/v1/notifications/read-all */
export async function markAllNotificationsRead(request: Request, env: Env, ctx: AppContext): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const url = new URL(request.url)
  const hId = url.searchParams.get('household_id') ?? ctx.householdId

  if (hId) {
    const membership = await getMembership(env, hId, userId)
    if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')
    await env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND household_id = ?').bind(userId, hId).run()
  } else {
    await env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').bind(userId).run()
  }

  return jsonResponse({ success: true })
}

/** POST /api/v1/notifications/generate  — generate smart notifications from expiry data */
export async function generateNotifications(request: Request, env: Env, ctx: AppContext): Promise<Response> {
  const userId = await getAppUserId(env, ctx.userId)
  if (!userId) return errorResponse('User not found', 404, 'NOT_FOUND')

  const url = new URL(request.url)
  const hId = url.searchParams.get('household_id') ?? ctx.householdId
  if (!hId) return errorResponse('household_id required', 400, 'VALIDATION_ERROR')

  const membership = await getMembership(env, hId, userId)
  if (!membership) return errorResponse('Access denied', 403, 'FORBIDDEN')

  const now = new Date().toISOString()
  const today = now.split('T')[0]
  const in30  = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  let created = 0

  // ── Overdue pending bills ──
  const overdueBills = await env.DB.prepare(
    `SELECT bi.id, b.name, bi.due_date FROM bill_instances bi
     JOIN bills b ON b.id = bi.bill_id
     WHERE bi.household_id = ? AND bi.status = 'pending' AND bi.due_date < ?`
  ).bind(hId, today).all<{ id: string; name: string; due_date: string }>()

  for (const bill of overdueBills.results) {
    const exists = await env.DB.prepare(
      `SELECT id FROM notifications WHERE entity_id = ? AND type = 'bill_due' AND user_id = ?`
    ).bind(bill.id, userId).first()
    if (!exists) {
      await env.DB.prepare(`INSERT INTO notifications (id, household_id, user_id, type, title, body, entity_type, entity_id, created_at)
        VALUES (?, ?, ?, 'bill_due', ?, ?, 'bill', ?, ?)`
      ).bind(generateId(), hId, userId, `Bill Overdue: ${bill.name}`, `Due on ${bill.due_date}`, bill.id, now).run()
      created++
    }
  }

  // ── Vehicle insurance/PUC expiring ──
  const vehiclesExpiring = await env.DB.prepare(
    `SELECT id, nickname, insurance_expiry, puc_expiry FROM vehicles
     WHERE household_id = ? AND deleted_at IS NULL
       AND (insurance_expiry BETWEEN ? AND ? OR puc_expiry BETWEEN ? AND ?)`
  ).bind(hId, today, in30, today, in30).all<{ id: string; nickname: string; insurance_expiry?: string; puc_expiry?: string }>()

  for (const v of vehiclesExpiring.results) {
    if (v.insurance_expiry && v.insurance_expiry <= in30) {
      const exists = await env.DB.prepare(
        `SELECT id FROM notifications WHERE entity_id = ? AND type = 'vehicle_expiry' AND body LIKE '%insurance%' AND user_id = ?`
      ).bind(v.id, userId).first()
      if (!exists) {
        await env.DB.prepare(`INSERT INTO notifications (id, household_id, user_id, type, title, body, entity_type, entity_id, created_at)
          VALUES (?, ?, ?, 'vehicle_expiry', ?, ?, 'vehicle', ?, ?)`
        ).bind(generateId(), hId, userId, `Insurance Expiring: ${v.nickname}`, `Insurance expires on ${v.insurance_expiry}`, v.id, now).run()
        created++
      }
    }
    if (v.puc_expiry && v.puc_expiry <= in30) {
      const exists = await env.DB.prepare(
        `SELECT id FROM notifications WHERE entity_id = ? AND type = 'vehicle_expiry' AND body LIKE '%PUC%' AND user_id = ?`
      ).bind(v.id, userId).first()
      if (!exists) {
        await env.DB.prepare(`INSERT INTO notifications (id, household_id, user_id, type, title, body, entity_type, entity_id, created_at)
          VALUES (?, ?, ?, 'vehicle_expiry', ?, ?, 'vehicle', ?, ?)`
        ).bind(generateId(), hId, userId, `PUC Expiring: ${v.nickname}`, `PUC expires on ${v.puc_expiry}`, v.id, now).run()
        created++
      }
    }
  }

  // ── Appliance warranty expiring ──
  const appliancesExpiring = await env.DB.prepare(
    `SELECT id, name, warranty_expiry FROM appliances
     WHERE household_id = ? AND deleted_at IS NULL AND warranty_expiry BETWEEN ? AND ?`
  ).bind(hId, today, in30).all<{ id: string; name: string; warranty_expiry: string }>()

  for (const a of appliancesExpiring.results) {
    const exists = await env.DB.prepare(
      `SELECT id FROM notifications WHERE entity_id = ? AND type = 'appliance_warranty' AND user_id = ?`
    ).bind(a.id, userId).first()
    if (!exists) {
      await env.DB.prepare(`INSERT INTO notifications (id, household_id, user_id, type, title, body, entity_type, entity_id, created_at)
        VALUES (?, ?, ?, 'appliance_warranty', ?, ?, 'appliance', ?, ?)`
      ).bind(generateId(), hId, userId, `Warranty Expiring: ${a.name}`, `Warranty expires on ${a.warranty_expiry}`, a.id, now).run()
      created++
    }
  }

  // ── Health reminders due ──
  const healthDue = await env.DB.prepare(
    `SELECT r.id, r.title, r.due_date FROM health_reminders r
     WHERE r.household_id = ? AND r.status = 'pending' AND r.deleted_at IS NULL AND r.due_date <= ?`
  ).bind(hId, in30).all<{ id: string; title: string; due_date: string }>()

  for (const h of healthDue.results) {
    const exists = await env.DB.prepare(
      `SELECT id FROM notifications WHERE entity_id = ? AND type = 'health_reminder' AND user_id = ?`
    ).bind(h.id, userId).first()
    if (!exists) {
      await env.DB.prepare(`INSERT INTO notifications (id, household_id, user_id, type, title, body, entity_type, entity_id, created_at)
        VALUES (?, ?, ?, 'health_reminder', ?, ?, 'health', ?, ?)`
      ).bind(generateId(), hId, userId, `Health Reminder: ${h.title}`, `Due on ${h.due_date}`, h.id, now).run()
      created++
    }
  }

  // ── Document expiring ──
  const docsExpiring = await env.DB.prepare(
    `SELECT id, title, expiry_date FROM documents
     WHERE household_id = ? AND deleted_at IS NULL AND expiry_date BETWEEN ? AND ?`
  ).bind(hId, today, in30).all<{ id: string; title: string; expiry_date: string }>()

  for (const d of docsExpiring.results) {
    const exists = await env.DB.prepare(
      `SELECT id FROM notifications WHERE entity_id = ? AND type = 'document_expiry' AND user_id = ?`
    ).bind(d.id, userId).first()
    if (!exists) {
      await env.DB.prepare(`INSERT INTO notifications (id, household_id, user_id, type, title, body, entity_type, entity_id, created_at)
        VALUES (?, ?, ?, 'document_expiry', ?, ?, 'document', ?, ?)`
      ).bind(generateId(), hId, userId, `Document Expiring: ${d.title}`, `Expires on ${d.expiry_date}`, d.id, now).run()
      created++
    }
  }

  return jsonResponse({ generated: created })
}

