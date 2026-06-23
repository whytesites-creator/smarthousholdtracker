import { apiClient } from '@/lib/api-client'

export const NOTIFICATION_TYPES = [
  'bill_due','vehicle_expiry','appliance_warranty',
  'health_reminder','inventory_low','document_expiry','general',
] as const

export type NotificationType = typeof NOTIFICATION_TYPES[number]

export const TYPE_ICONS: Record<NotificationType, string> = {
  bill_due: '📄', vehicle_expiry: '🚗', appliance_warranty: '🔧',
  health_reminder: '💊', inventory_low: '📦', document_expiry: '🪪', general: '🔔',
}

export const TYPE_LABELS: Record<NotificationType, string> = {
  bill_due: 'Bill Due', vehicle_expiry: 'Vehicle Expiry', appliance_warranty: 'Appliance Warranty',
  health_reminder: 'Health Reminder', inventory_low: 'Low Stock', document_expiry: 'Document Expiry',
  general: 'General',
}

export interface Notification {
  id: string; household_id: string; user_id: string
  type: NotificationType; title: string; body?: string
  entity_type?: string; entity_id?: string
  is_read: number; created_at: string
}

export async function listNotifications(householdId?: string, unreadOnly = false) {
  const params = new URLSearchParams()
  if (householdId) params.set('household_id', householdId)
  if (unreadOnly)  params.set('unread', 'true')
  const res = await apiClient.get(`/notifications?${params}`)
  return res.data.data as { notifications: Notification[]; unreadCount: number }
}

export async function markRead(notificationId: string) {
  const res = await apiClient.post(`/notifications/${notificationId}/read`)
  return res.data.data as { success: boolean }
}

export async function markAllRead(householdId?: string) {
  const params = householdId ? `?household_id=${householdId}` : ''
  const res = await apiClient.post(`/notifications/read-all${params}`)
  return res.data.data as { success: boolean }
}

export async function generateNotifications(householdId: string) {
  const res = await apiClient.post(`/notifications/generate?household_id=${householdId}`)
  return res.data.data as { generated: number }
}

