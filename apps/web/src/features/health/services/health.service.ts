import { apiClient } from '@/lib/api-client'

export const RELATIONS     = ['self','spouse','child','parent','grandparent','sibling','other'] as const
export const REMINDER_TYPES= ['medicine','vaccine','doctor','checkup','other'] as const
export const RECURRENCES   = ['none','daily','weekly','monthly','yearly'] as const

export type Relation     = typeof RELATIONS[number]
export type ReminderType = typeof REMINDER_TYPES[number]
export type Recurrence   = typeof RECURRENCES[number]

export const RELATION_LABELS: Record<Relation, string> = {
  self: 'Self', spouse: 'Spouse', child: 'Child', parent: 'Parent',
  grandparent: 'Grandparent', sibling: 'Sibling', other: 'Other',
}
export const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  medicine: 'Medicine', vaccine: 'Vaccine', doctor: 'Doctor Visit',
  checkup: 'Checkup', other: 'Other',
}
export const REMINDER_TYPE_ICONS: Record<ReminderType, string> = {
  medicine: '💊', vaccine: '💉', doctor: '👨‍⚕️', checkup: '🩺', other: '🏥',
}
export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: 'One Time', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly',
}

export interface HealthMember {
  id: string; household_id: string; name: string; dob?: string
  relation: Relation; blood_group?: string; pending_reminders: number
  created_at: string
}

export interface HealthReminder {
  id: string; household_id: string; member_id?: string; member_name?: string
  type: ReminderType; title: string; due_date: string
  recurrence: Recurrence; notes?: string
  status: 'pending'|'done'|'skipped'; created_at: string
}

export async function listHealthMembers(householdId: string) {
  const res = await apiClient.get(`/health/members?household_id=${householdId}`)
  return res.data.data as HealthMember[]
}

export async function createHealthMember(data: { household_id: string; name: string; dob?: string; relation: Relation; blood_group?: string }) {
  const res = await apiClient.post('/health/members', data)
  return res.data.data as HealthMember
}

export async function deleteHealthMember(id: string) {
  await apiClient.delete(`/health/members/${id}`)
}

export async function listReminders(householdId: string, status?: string, type?: string) {
  const params = new URLSearchParams({ household_id: householdId })
  if (status) params.set('status', status)
  if (type)   params.set('type', type)
  const res = await apiClient.get(`/health/reminders?${params}`)
  return res.data.data as HealthReminder[]
}

export async function createReminder(data: {
  household_id: string; member_id?: string; type: ReminderType
  title: string; due_date: string; recurrence?: Recurrence; notes?: string
}) {
  const res = await apiClient.post('/health/reminders', data)
  return res.data.data as HealthReminder
}

export async function updateReminder(id: string, data: Partial<HealthReminder>) {
  const res = await apiClient.patch(`/health/reminders/${id}`, data)
  return res.data.data as HealthReminder
}

export async function deleteReminder(id: string) {
  await apiClient.delete(`/health/reminders/${id}`)
}

export async function completeReminder(id: string) {
  const res = await apiClient.post(`/health/reminders/${id}/complete`)
  return res.data.data as { success: boolean; nextReminder: { id: string; due_date: string } | null }
}

