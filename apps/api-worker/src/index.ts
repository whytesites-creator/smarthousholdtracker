import { authMiddleware } from './middleware/auth.middleware'
import { syncProfile, getProfile, updateProfile } from './modules/auth/auth.handler'
import { getHouseholds, createHousehold, switchHousehold, getHouseholdMembers, updateMemberRole, removeMember } from './modules/households/household.handler'
import { createInvite, acceptInvite } from './modules/invites/invite.handler'
import { listExpenses, createExpense, updateExpense, deleteExpense, getExpenseSummary } from './modules/expenses/expense.handler'
import { listItems, createItem, updateItem, deleteItem, addTransaction, getTransactions, getInventorySummary } from './modules/inventory/inventory.handler'
import { listGasEntries, createGasEntry, deleteGasEntry } from './modules/gas/gas.handler'
import { listWaterDeliveries, createWaterDelivery, deleteWaterDelivery } from './modules/water/water.handler'
import { listBills, createBill, updateBill, deleteBill, getUpcomingBills, addBillInstance, payBillInstance, getBillsSummary } from './modules/bills/bills.handler'
import { listVehicles, createVehicle, updateVehicle, deleteVehicle, addVehicleService, listVehicleServices } from './modules/vehicles/vehicles.handler'
import { listAppliances, createAppliance, updateAppliance, deleteAppliance, addApplianceService, listApplianceServices } from './modules/appliances/appliances.handler'
import { listHealthMembers, createHealthMember, deleteHealthMember, listReminders, createReminder, updateReminder, deleteReminder, completeReminder } from './modules/health/health.handler'
import { listDocuments, createDocument, updateDocument, deleteDocument, getExpiringDocuments } from './modules/documents/documents.handler'
import { listNotifications, markNotificationRead, markAllNotificationsRead, generateNotifications } from './modules/notifications/notifications.handler'
import { addCorsHeaders, errorResponse } from './utils/helpers'
import type { Env } from './utils/helpers'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? undefined

    // ─── CORS Pre-flight ────────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return addCorsHeaders(new Response(null, { status: 204 }), env, origin)
    }

    const url = new URL(request.url)
    const path = url.pathname

    // Health check (used by CI smoke test — no auth required)
    if (path === '/health') {
      return addCorsHeaders(
        new Response(JSON.stringify({ status: 'ok', env: env.ENVIRONMENT }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
        env,
        origin
      )
    }

    // Strip /api/v1 prefix
    const route = path.replace(/^\/api\/v1/, '')

    let response: Response

    try {
      response = await routeRequest(request, env, route)
    } catch (err) {
      console.error('Unhandled error:', err)
      response = errorResponse('Internal server error', 500, 'INTERNAL')
    }

    return addCorsHeaders(response, env, origin)
  },
}

async function routeRequest(request: Request, env: Env, route: string): Promise<Response> {
  const method = request.method

  // ─── Public routes (no auth required) ────────────────────────────────────

  // ─── Auth-protected routes ────────────────────────────────────────────────
  const authResult = await authMiddleware(request, env)
  if (authResult instanceof Response) return authResult
  const { context } = authResult

  // ── Profile ──────────────────────────────────────────────────────────────
  if (method === 'POST' && route === '/auth/sync-profile') {
    return syncProfile(request, env, context)
  }

  if (method === 'GET' && route === '/profile') {
    return getProfile(request, env, context)
  }

  if (method === 'PATCH' && route === '/profile') {
    return updateProfile(request, env, context)
  }

  // ── Households ────────────────────────────────────────────────────────────
  if (method === 'GET' && route === '/households') {
    return getHouseholds(request, env, context)
  }

  if (method === 'POST' && route === '/households') {
    return createHousehold(request, env, context)
  }

  if (method === 'POST' && route === '/households/switch') {
    return switchHousehold(request, env, context)
  }

  // ── Household Members ─────────────────────────────────────────────────────
  const membersMatch = route.match(/^\/households\/([^/]+)\/members$/)
  if (membersMatch) {
    const householdId = membersMatch[1]
    if (method === 'GET') {
      return getHouseholdMembers(request, env, context, householdId)
    }
  }

  const memberMatch = route.match(/^\/households\/([^/]+)\/members\/([^/]+)$/)
  if (memberMatch) {
    const [, householdId, targetUserId] = memberMatch
    if (method === 'PATCH') {
      return updateMemberRole(request, env, context, householdId, targetUserId)
    }
    if (method === 'DELETE') {
      return removeMember(request, env, context, householdId, targetUserId)
    }
  }

  // ── Invites ───────────────────────────────────────────────────────────────
  const inviteCreateMatch = route.match(/^\/households\/([^/]+)\/invites$/)
  if (inviteCreateMatch && method === 'POST') {
    const householdId = inviteCreateMatch[1]
    return createInvite(request, env, context, householdId)
  }

  const inviteAcceptMatch = route.match(/^\/invites\/([^/]+)\/accept$/)
  if (inviteAcceptMatch && method === 'POST') {
    const token = inviteAcceptMatch[1]
    return acceptInvite(request, env, context, token)
  }

  // ── Expenses ──────────────────────────────────────────────────────────────
  if (method === 'GET' && route === '/expenses') {
    return listExpenses(request, env, context)
  }
  if (method === 'GET' && route === '/expenses/summary') {
    return getExpenseSummary(request, env, context)
  }
  if (method === 'POST' && route === '/expenses') {
    return createExpense(request, env, context)
  }
  const expenseMatch = route.match(/^\/expenses\/([^/]+)$/)
  if (expenseMatch) {
    const expenseId = expenseMatch[1]
    if (method === 'PATCH')  return updateExpense(request, env, context, expenseId)
    if (method === 'DELETE') return deleteExpense(request, env, context, expenseId)
  }

  // ── Inventory ─────────────────────────────────────────────────────────────
  if (method === 'GET'  && route === '/inventory/summary') return getInventorySummary(request, env, context)
  if (method === 'GET'  && route === '/inventory/items')   return listItems(request, env, context)
  if (method === 'POST' && route === '/inventory/items')   return createItem(request, env, context)

  const invItemMatch = route.match(/^\/inventory\/items\/([^/]+)$/)
  if (invItemMatch) {
    const itemId = invItemMatch[1]
    if (method === 'PATCH')  return updateItem(request, env, context, itemId)
    if (method === 'DELETE') return deleteItem(request, env, context, itemId)
  }
  const invTxnMatch = route.match(/^\/inventory\/items\/([^/]+)\/transactions$/)
  if (invTxnMatch) {
    const itemId = invTxnMatch[1]
    if (method === 'POST') return addTransaction(request, env, context, itemId)
    if (method === 'GET')  return getTransactions(request, env, context, itemId)
  }

  // ── Gas ───────────────────────────────────────────────────────────────────
  if (method === 'GET'  && route === '/gas') return listGasEntries(request, env, context)
  if (method === 'POST' && route === '/gas') return createGasEntry(request, env, context)
  const gasMatch = route.match(/^\/gas\/([^/]+)$/)
  if (gasMatch && method === 'DELETE') return deleteGasEntry(request, env, context, gasMatch[1])

  // ── Water ─────────────────────────────────────────────────────────────────
  if (method === 'GET'  && route === '/water') return listWaterDeliveries(request, env, context)
  if (method === 'POST' && route === '/water') return createWaterDelivery(request, env, context)
  const waterMatch = route.match(/^\/water\/([^/]+)$/)
  if (waterMatch && method === 'DELETE') return deleteWaterDelivery(request, env, context, waterMatch[1])

  // ── Bills ─────────────────────────────────────────────────────────────────
  if (method === 'GET'  && route === '/bills/summary')  return getBillsSummary(request, env, context)
  if (method === 'GET'  && route === '/bills/upcoming') return getUpcomingBills(request, env, context)
  if (method === 'GET'  && route === '/bills')          return listBills(request, env, context)
  if (method === 'POST' && route === '/bills')          return createBill(request, env, context)
  const billMatch = route.match(/^\/bills\/([^/]+)$/)
  if (billMatch) {
    const billId = billMatch[1]
    if (method === 'PATCH')  return updateBill(request, env, context, billId)
    if (method === 'DELETE') return deleteBill(request, env, context, billId)
  }
  const billInstanceMatch = route.match(/^\/bills\/([^/]+)\/instances$/)
  if (billInstanceMatch && method === 'POST') return addBillInstance(request, env, context, billInstanceMatch[1])
  const payMatch = route.match(/^\/bills\/instances\/([^/]+)\/pay$/)
  if (payMatch && method === 'POST') return payBillInstance(request, env, context, payMatch[1])

  // ── Vehicles ──────────────────────────────────────────────────────────────
  if (method === 'GET'  && route === '/vehicles') return listVehicles(request, env, context)
  if (method === 'POST' && route === '/vehicles') return createVehicle(request, env, context)
  const vehicleMatch = route.match(/^\/vehicles\/([^/]+)$/)
  if (vehicleMatch) {
    const vehicleId = vehicleMatch[1]
    if (method === 'PATCH')  return updateVehicle(request, env, context, vehicleId)
    if (method === 'DELETE') return deleteVehicle(request, env, context, vehicleId)
  }
  const vehicleServicesMatch = route.match(/^\/vehicles\/([^/]+)\/services$/)
  if (vehicleServicesMatch) {
    const vehicleId = vehicleServicesMatch[1]
    if (method === 'POST') return addVehicleService(request, env, context, vehicleId)
    if (method === 'GET')  return listVehicleServices(request, env, context, vehicleId)
  }

  // ── Appliances ────────────────────────────────────────────────────────────
  if (method === 'GET'  && route === '/appliances') return listAppliances(request, env, context)
  if (method === 'POST' && route === '/appliances') return createAppliance(request, env, context)
  const applianceMatch = route.match(/^\/appliances\/([^/]+)$/)
  if (applianceMatch) {
    const applianceId = applianceMatch[1]
    if (method === 'PATCH')  return updateAppliance(request, env, context, applianceId)
    if (method === 'DELETE') return deleteAppliance(request, env, context, applianceId)
  }
  const applianceServicesMatch = route.match(/^\/appliances\/([^/]+)\/services$/)
  if (applianceServicesMatch) {
    const applianceId = applianceServicesMatch[1]
    if (method === 'POST') return addApplianceService(request, env, context, applianceId)
    if (method === 'GET')  return listApplianceServices(request, env, context, applianceId)
  }

  // ── Health ─────────────────────────────────────────────────────────────────
  if (method === 'GET'  && route === '/health/members') return listHealthMembers(request, env, context)
  if (method === 'POST' && route === '/health/members') return createHealthMember(request, env, context)
  const healthMemberMatch = route.match(/^\/health\/members\/([^/]+)$/)
  if (healthMemberMatch && method === 'DELETE') return deleteHealthMember(request, env, context, healthMemberMatch[1])

  if (method === 'GET'  && route === '/health/reminders') return listReminders(request, env, context)
  if (method === 'POST' && route === '/health/reminders') return createReminder(request, env, context)
  const healthReminderMatch = route.match(/^\/health\/reminders\/([^/]+)$/)
  if (healthReminderMatch) {
    const reminderId = healthReminderMatch[1]
    if (method === 'PATCH')  return updateReminder(request, env, context, reminderId)
    if (method === 'DELETE') return deleteReminder(request, env, context, reminderId)
  }
  const completeReminderMatch = route.match(/^\/health\/reminders\/([^/]+)\/complete$/)
  if (completeReminderMatch && method === 'POST') return completeReminder(request, env, context, completeReminderMatch[1])

  // ── Documents ─────────────────────────────────────────────────────────────
  if (method === 'GET'  && route === '/documents/expiring') return getExpiringDocuments(request, env, context)
  if (method === 'GET'  && route === '/documents') return listDocuments(request, env, context)
  if (method === 'POST' && route === '/documents') return createDocument(request, env, context)
  const documentMatch = route.match(/^\/documents\/([^/]+)$/)
  if (documentMatch) {
    const documentId = documentMatch[1]
    if (method === 'PATCH')  return updateDocument(request, env, context, documentId)
    if (method === 'DELETE') return deleteDocument(request, env, context, documentId)
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  if (method === 'GET'  && route === '/notifications')             return listNotifications(request, env, context)
  if (method === 'POST' && route === '/notifications/read-all')    return markAllNotificationsRead(request, env, context)
  if (method === 'POST' && route === '/notifications/generate')    return generateNotifications(request, env, context)
  const notifReadMatch = route.match(/^\/notifications\/([^/]+)\/read$/)
  if (notifReadMatch && method === 'POST') return markNotificationRead(request, env, context, notifReadMatch[1])

  // ─── 404 fallback ─────────────────────────────────────────────────────────
  return errorResponse(`Route not found: ${method} ${route}`, 404, 'NOT_FOUND')
}

