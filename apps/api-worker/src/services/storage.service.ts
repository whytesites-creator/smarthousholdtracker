/**
 * Supabase Storage Service
 *
 * Wraps Supabase Storage REST API for use inside Cloudflare Workers.
 * Uses the service-role key for server-side uploads/deletes/signed URLs.
 * No R2 or credit card required — works on Supabase free tier (1 GB).
 */

import type { Env } from '../utils/helpers'

export interface UploadResult {
  path: string
  fullPath: string
  publicUrl: string | null
}

/**
 * Upload a file to Supabase Storage.
 * @param env     Worker env bindings
 * @param path    Storage path: e.g. "household/abc123/documents/2026/06/uuid-invoice.pdf"
 * @param body    Raw file bytes
 * @param mime    MIME type (e.g. "application/pdf")
 */
export async function uploadFile(
  env: Env,
  path: string,
  body: ArrayBuffer,
  mime: string
): Promise<UploadResult> {
  const url = `${env.SUPABASE_URL}/storage/v1/object/${env.SUPABASE_STORAGE_BUCKET}/${path}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': mime,
      'x-upsert': 'false',
    },
    body,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase Storage upload failed (${res.status}): ${err}`)
  }

  return {
    path,
    fullPath: `${env.SUPABASE_STORAGE_BUCKET}/${path}`,
    publicUrl: null, // bucket is private — use signed URL for download
  }
}

/**
 * Generate a time-limited signed URL for downloading a private file.
 * @param env         Worker env bindings
 * @param storagePath Storage path stored in DB (e.g. "household/abc/docs/2026/06/file.pdf")
 * @param expiresIn   Seconds until URL expires (default: 300 = 5 minutes)
 */
export async function getSignedUrl(
  env: Env,
  storagePath: string,
  expiresIn = 300
): Promise<string> {
  const url = `${env.SUPABASE_URL}/storage/v1/object/sign/${env.SUPABASE_STORAGE_BUCKET}/${storagePath}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase Storage sign failed (${res.status}): ${err}`)
  }

  const data = (await res.json()) as { signedURL: string }
  // Supabase returns a relative path — prefix with project URL
  const signedUrl = data.signedURL.startsWith('http')
    ? data.signedURL
    : `${env.SUPABASE_URL}${data.signedURL}`

  return signedUrl
}

/**
 * Delete a file from Supabase Storage.
 * @param env         Worker env bindings
 * @param storagePath Storage path to delete
 */
export async function deleteFile(env: Env, storagePath: string): Promise<void> {
  const url = `${env.SUPABASE_URL}/storage/v1/object/${env.SUPABASE_STORAGE_BUCKET}`

  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefixes: [storagePath] }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase Storage delete failed (${res.status}): ${err}`)
  }
}

/**
 * Build a canonical storage path for a document.
 * Pattern: household/{householdId}/{module}/{yyyy}/{mm}/{uuid}-{safeName}
 */
export function buildStoragePath(
  householdId: string,
  module: string,
  fileName: string,
  uuid: string
): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  // Strip dangerous characters from filename
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
  return `household/${householdId}/${module}/${yyyy}/${mm}/${uuid}-${safeName}`
}

/** Allowed MIME types for document uploads */
export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
])

/** Max upload size: 10 MB */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

