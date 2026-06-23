import { apiClient } from '@/lib/api-client'

export const FUEL_TYPES = ['petrol', 'diesel', 'cng', 'electric', 'hybrid'] as const
export const SERVICE_TYPES = ['regular', 'repair', 'insurance_renewal', 'puc', 'tyre', 'other'] as const

export type FuelType    = typeof FUEL_TYPES[number]
export type ServiceType = typeof SERVICE_TYPES[number]

export const FUEL_LABELS: Record<FuelType, string> = {
  petrol: 'Petrol', diesel: 'Diesel', cng: 'CNG', electric: 'Electric', hybrid: 'Hybrid',
}
export const SERVICE_LABELS: Record<ServiceType, string> = {
  regular: 'Regular Service', repair: 'Repair', insurance_renewal: 'Insurance Renewal',
  puc: 'PUC', tyre: 'Tyre Change', other: 'Other',
}

export interface Vehicle {
  id: string; household_id: string; nickname: string
  make?: string; model?: string; year?: number; reg_number?: string
  fuel_type: FuelType; color?: string
  insurance_expiry?: string; puc_expiry?: string
  last_service?: string; next_service?: string
  notes?: string; service_count: number; created_at: string
}

export interface VehicleService {
  id: string; vehicle_id: string; household_id: string
  service_date: string; service_type: ServiceType
  odometer?: number; cost?: number; provider?: string; notes?: string
  created_by_name: string; created_at: string
}

export async function listVehicles(householdId: string) {
  const res = await apiClient.get(`/vehicles?household_id=${householdId}`)
  return res.data.data as Vehicle[]
}

export async function createVehicle(data: Partial<Vehicle> & { household_id: string; nickname: string }) {
  const res = await apiClient.post('/vehicles', data)
  return res.data.data as Vehicle
}

export async function updateVehicle(id: string, data: Partial<Vehicle>) {
  const res = await apiClient.patch(`/vehicles/${id}`, data)
  return res.data.data as Vehicle
}

export async function deleteVehicle(id: string) {
  await apiClient.delete(`/vehicles/${id}`)
}

export async function listVehicleServices(vehicleId: string) {
  const res = await apiClient.get(`/vehicles/${vehicleId}/services`)
  return res.data.data as VehicleService[]
}

export async function addVehicleService(vehicleId: string, data: Omit<VehicleService, 'id'|'vehicle_id'|'household_id'|'created_by_name'|'created_at'>) {
  const res = await apiClient.post(`/vehicles/${vehicleId}/services`, data)
  return res.data.data as VehicleService
}

