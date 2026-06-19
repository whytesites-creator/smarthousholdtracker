import { errorResponse } from '../utils/helpers'
import type { Env, AppContext } from '../utils/helpers'

/**
 * Validates the Supabase JWT from the Authorization header.
 * Uses the JWKS endpoint approach – validates signature and extracts sub/email.
 */
export async function authMiddleware(
  request: Request,
  env: Env
): Promise<{ context: AppContext } | Response> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse('Missing or invalid Authorization header', 401, 'AUTH_REQUIRED')
  }

  const token = authHeader.slice(7)

  try {
    const payload = await verifySupabaseJwt(token, env.SUPABASE_JWT_SECRET)
    return {
      context: {
        userId: payload.sub,
        email: payload.email ?? '',
      },
    }
  } catch (err) {
    return errorResponse('Invalid or expired token', 401, 'AUTH_INVALID')
  }
}

interface JwtPayload {
  sub: string
  email?: string
  exp: number
  iat: number
  role?: string
}

async function verifySupabaseJwt(token: string, secret: string): Promise<JwtPayload> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT structure')

  const [headerB64, payloadB64, signatureB64] = parts

  // Decode payload
  const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload

  // Verify expiry
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired')
  }

  // Verify signature using HMAC-SHA256
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(`${headerB64}.${payloadB64}`)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )

  const signatureBytes = Uint8Array.from(
    atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0)
  )

  const valid = await crypto.subtle.verify('HMAC', cryptoKey, signatureBytes, messageData)
  if (!valid) throw new Error('Signature verification failed')

  return payload
}

