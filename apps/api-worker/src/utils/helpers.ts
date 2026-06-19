export interface Env {
  DB: D1Database
  // File storage: Supabase Storage (free tier, no credit card needed — R2 not used)
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  SUPABASE_STORAGE_BUCKET: string
  SUPABASE_JWT_SECRET: string
  ENVIRONMENT: string
  /** Comma-separated list of allowed CORS origins */
  ALLOWED_ORIGINS: string
}

export interface AppContext {
  userId: string
  email: string
  householdId?: string
  role?: string
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data, error: null }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function errorResponse(message: string, status = 400, code?: string): Response {
  return new Response(
    JSON.stringify({ data: null, error: { message, code: code ?? 'ERROR' } }),
    { status, headers: { 'Content-Type': 'application/json' } }
  )
}

export function generateId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function addCorsHeaders(response: Response, env?: Env, requestOrigin?: string): Response {
  const headers = new Headers(response.headers)

  // Determine the reflected origin (only allow listed origins)
  let allowedOrigin = '*'
  if (env?.ALLOWED_ORIGINS && requestOrigin) {
    const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    if (allowed.includes(requestOrigin)) {
      allowedOrigin = requestOrigin
    }
  }

  headers.set('Access-Control-Allow-Origin', allowedOrigin)
  headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  headers.set('Access-Control-Max-Age', '86400')
  if (allowedOrigin !== '*') {
    headers.set('Vary', 'Origin')
  }
  return new Response(response.body, { status: response.status, headers })
}

