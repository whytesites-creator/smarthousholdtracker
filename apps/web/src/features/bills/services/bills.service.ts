import { apiClient } from '@/lib/api-client'

export const BILL_TYPES = ['electricity','internet','mobile','water_tax','property_tax','dth','subscription','other'] as const
export const RECURRENCES = ['monthly','quarterly','yearly','one_time'] as const
export const PAYMENT_MODES = ['cash','online','cheque','auto_debit','upi'] as const

export type BillType    = typeof BILL_TYPES[number]
export type Recurrence  = typeof RECURRENCES[number]
export type PaymentMode = typeof PAYMENT_MODES[number]

export const BILL_LABELS: Record<BillType, string> = {
  electricity:'Electricity', internet:'Internet', mobile:'Mobile Recharge',
  water_tax:'Water Tax', property_tax:'Property Tax', dth:'DTH',
  subscription:'Subscription', other:'Other',
}
export const BILL_ICONS: Record<BillType, string> = {
  electricity:'⚡', internet:'📡', mobile:'📱', water_tax:'💧',
  property_tax:'🏠', dth:'📺', subscription:'🔁', other:'📄',
}
export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  monthly:'Monthly', quarterly:'Quarterly', yearly:'Yearly', one_time:'One Time',
}
export const MODE_LABELS: Record<PaymentMode, string> = {
  cash:'Cash', online:'Online', cheque:'Cheque', auto_debit:'Auto Debit', upi:'UPI',
}

export interface Bill {
  id: string; household_id: string; name: string; type: BillType
  provider?: string; amount?: number; recurrence: Recurrence
  due_day?: number; active: number; pending_count: number
  overdue_count: number; next_due?: string; created_at: string
}

export interface BillInstance {
  id: string; bill_id: string; household_id: string
  due_date: string; amount_due?: number; status: 'pending'|'paid'|'overdue'|'skipped'
  bill_name: string; type: BillType; provider?: string; recurrence: Recurrence
}

export interface BillsSummary { due_in_30_days: number; overdue: number }

export async function listBills(householdId: string) {
  const res = await apiClient.get(`/bills?household_id=${householdId}`)
  return res.data.data as Bill[]
}
export async function createBill(data: { household_id: string; name: string; type: BillType; provider?: string; amount?: number; recurrence: Recurrence; due_day?: number }) {
  const res = await apiClient.post('/bills', data)
  return res.data.data as Bill
}
export async function updateBill(id: string, data: Partial<Parameters<typeof createBill>[0]>) {
  const res = await apiClient.patch(`/bills/${id}`, data)
  return res.data.data as Bill
}
export async function deleteBill(id: string) { await apiClient.delete(`/bills/${id}`) }
export async function getUpcomingBills(householdId: string, days = 30) {
  const res = await apiClient.get(`/bills/upcoming?household_id=${householdId}&days=${days}`)
  return res.data.data as { instances: BillInstance[]; overdueCount: number; totalDue: number }
}
export async function addBillInstance(billId: string, data: { due_date: string; amount_due?: number }) {
  const res = await apiClient.post(`/bills/${billId}/instances`, data)
  return res.data.data as BillInstance
}
export async function payBillInstance(instanceId: string, data: { paid_on: string; amount_paid: number; mode: PaymentMode; reference?: string }) {
  const res = await apiClient.post(`/bills/instances/${instanceId}/pay`, data)
  return res.data.data as { success: boolean; nextDue: string | null }
}
export async function getBillsSummary(householdId: string) {
  const res = await apiClient.get(`/bills/summary?household_id=${householdId}`)
  return res.data.data as BillsSummary
}

