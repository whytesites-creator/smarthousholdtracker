import { apiClient } from '@/lib/api-client'

export const APPLIANCE_CATEGORIES = [
  'ac','refrigerator','washing_machine','tv','microwave',
  'water_purifier','geyser','fan','mixer','laptop','phone','other',
] as const
export const APPLIANCE_SERVICE_TYPES = ['repair','maintenance','installation','warranty_claim','other'] as const

export type ApplianceCategory    = typeof APPLIANCE_CATEGORIES[number]
export type ApplianceServiceType = typeof APPLIANCE_SERVICE_TYPES[number]

export const CATEGORY_LABELS: Record<ApplianceCategory, string> = {
  ac: 'Air Conditioner', refrigerator: 'Refrigerator', washing_machine: 'Washing Machine',
  tv: 'Television', microwave: 'Microwave', water_purifier: 'Water Purifier',
  geyser: 'Geyser', fan: 'Fan', mixer: 'Mixer/Grinder', laptop: 'Laptop',
  phone: 'Mobile Phone', other: 'Other',
}
export const CATEGORY_ICONS: Record<ApplianceCategory, string> = {
  ac: '❄️', refrigerator: '🧊', washing_machine: '🫧', tv: '📺', microwave: '📦',
  water_purifier: '💧', geyser: '🔥', fan: '💨', mixer: '🍳', laptop: '💻',
  phone: '📱', other: '🔧',
}
export const SERVICE_TYPE_LABELS: Record<ApplianceServiceType, string> = {
  repair: 'Repair', maintenance: 'Maintenance', installation: 'Installation',
  warranty_claim: 'Warranty Claim', other: 'Other',
}

export interface Appliance {
  id: string; household_id: string; name: string; category: ApplianceCategory
  brand?: string; model?: string; serial_no?: string
  purchase_date?: string; warranty_expiry?: string; purchase_price?: number
  shop?: string; notes?: string; service_count: number; created_at: string
}

export interface ApplianceService {
  id: string; appliance_id: string; household_id: string
  service_date: string; service_type: ApplianceServiceType
  cost?: number; provider?: string; notes?: string
  created_by_name: string; created_at: string
}

export async function listAppliances(householdId: string) {
  const res = await apiClient.get(`/appliances?household_id=${householdId}`)
  return res.data.data as Appliance[]
}

export async function createAppliance(data: Partial<Appliance> & { household_id: string; name: string; category: ApplianceCategory }) {
  const res = await apiClient.post('/appliances', data)
  return res.data.data as Appliance
}

export async function updateAppliance(id: string, data: Partial<Appliance>) {
  const res = await apiClient.patch(`/appliances/${id}`, data)
  return res.data.data as Appliance
}

export async function deleteAppliance(id: string) {
  await apiClient.delete(`/appliances/${id}`)
}

export async function listApplianceServices(applianceId: string) {
  const res = await apiClient.get(`/appliances/${applianceId}/services`)
  return res.data.data as ApplianceService[]
}

export async function addApplianceService(applianceId: string, data: { service_date: string; service_type: ApplianceServiceType; cost?: number; provider?: string; notes?: string }) {
  const res = await apiClient.post(`/appliances/${applianceId}/services`, data)
  return res.data.data as ApplianceService
}

