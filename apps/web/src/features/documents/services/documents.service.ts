import { apiClient } from '@/lib/api-client'

export const DOC_CATEGORIES = [
  'aadhaar','pan','passport','voter_id','driving_license',
  'insurance','property','vehicle','medical','other',
] as const

export type DocCategory = typeof DOC_CATEGORIES[number]

export const CATEGORY_LABELS: Record<DocCategory, string> = {
  aadhaar: 'Aadhaar Card', pan: 'PAN Card', passport: 'Passport',
  voter_id: 'Voter ID', driving_license: 'Driving License',
  insurance: 'Insurance', property: 'Property', vehicle: 'Vehicle',
  medical: 'Medical', other: 'Other',
}

export const CATEGORY_ICONS: Record<DocCategory, string> = {
  aadhaar: '🪪', pan: '💳', passport: '📘', voter_id: '🗳️',
  driving_license: '🚗', insurance: '🛡️', property: '🏠',
  vehicle: '🚘', medical: '🏥', other: '📄',
}

export interface Document {
  id: string; household_id: string; title: string; category: DocCategory
  member_name?: string; doc_number?: string
  issue_date?: string; expiry_date?: string; file_url?: string; notes?: string
  created_by_name: string; created_at: string
}

export async function listDocuments(householdId: string, category?: string) {
  const params = new URLSearchParams({ household_id: householdId })
  if (category) params.set('category', category)
  const res = await apiClient.get(`/documents?${params}`)
  return res.data.data as Document[]
}

export async function createDocument(data: Partial<Document> & { household_id: string; title: string; category: DocCategory }) {
  const res = await apiClient.post('/documents', data)
  return res.data.data as Document
}

export async function updateDocument(id: string, data: Partial<Document>) {
  const res = await apiClient.patch(`/documents/${id}`, data)
  return res.data.data as Document
}

export async function deleteDocument(id: string) {
  await apiClient.delete(`/documents/${id}`)
}

export async function getExpiringDocuments(householdId: string, days = 90) {
  const res = await apiClient.get(`/documents/expiring?household_id=${householdId}&days=${days}`)
  return res.data.data as Document[]
}

