import { apiClient } from '@/lib/api-client'

export interface WaterDelivery {
  id: string; household_id: string; vendor?: string
  qty: number; unit: 'cans' | 'L'; cost?: number
  delivery_date: string; notes?: string; created_by_name?: string; created_at: string
}
export interface WaterAnalytics { avgQty: number | null; avgDays: number | null; predictedNext: string | null }

export async function listWaterDeliveries(householdId: string) {
  const res = await apiClient.get(`/water?household_id=${householdId}`)
  return res.data.data as { deliveries: WaterDelivery[]; analytics: WaterAnalytics }
}
export async function createWaterDelivery(data: { household_id: string; qty: number; unit?: 'cans'|'L'; vendor?: string; cost?: number; delivery_date: string; notes?: string }) {
  const res = await apiClient.post('/water', data)
  return res.data.data as WaterDelivery
}
export async function deleteWaterDelivery(id: string) { await apiClient.delete(`/water/${id}`) }

