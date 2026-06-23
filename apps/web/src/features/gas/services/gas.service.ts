import { apiClient } from '@/lib/api-client'

export const CYLINDER_TYPES = ['domestic', 'commercial', 'auto'] as const
export type CylinderType = typeof CYLINDER_TYPES[number]

export interface GasEntry {
  id: string; household_id: string; refill_date: string
  vendor?: string; price?: number; cylinder_type: CylinderType; notes?: string
  created_by_name?: string; created_at: string
}
export interface GasAnalytics { avgDays: number | null; predictedNext: string | null; totalEntries: number }

export async function listGasEntries(householdId: string) {
  const res = await apiClient.get(`/gas?household_id=${householdId}`)
  return res.data.data as { entries: GasEntry[]; analytics: GasAnalytics }
}
export async function createGasEntry(data: { household_id: string; refill_date: string; vendor?: string; price?: number; cylinder_type?: CylinderType; notes?: string }) {
  const res = await apiClient.post('/gas', data)
  return res.data.data as GasEntry
}
export async function deleteGasEntry(id: string) { await apiClient.delete(`/gas/${id}`) }

