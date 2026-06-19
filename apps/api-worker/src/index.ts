import { authMiddleware } from './middleware/auth.middleware'
import { syncProfile, getProfile, updateProfile } from './modules/auth/auth.handler'
import {
  getHouseholds, createHousehold, switchHousehold,
  getHouseholdMembers, updateMemberRole, removeMember,
} from './modules/households/household.handler'
import { createInvite, acceptInvite } from './modules/invites/invite.handler'
import {
  listExpenses, createExpense, updateExpense,
  deleteExpense, getExpenseSummary,
} from './modules/expenses/expense.handler'
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

  // ─── 404 fallback ─────────────────────────────────────────────────────────
  return errorResponse(`Route not found: ${method} ${route}`, 404, 'NOT_FOUND')
}

