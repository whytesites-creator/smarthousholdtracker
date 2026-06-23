import { apiClient } from '@/lib/api-client'

export const UNITS = ['kg', 'g', 'L', 'ml', 'count', 'dozen', 'pack'] as const
export type Unit = typeof UNITS[number]

export const TXN_TYPES = ['purchase', 'consume', 'adjust', 'waste'] as const
export type TxnType = typeof TXN_TYPES[number]

export const TXN_LABELS: Record<TxnType, string> = {
  purchase: 'Purchased',
  consume:  'Consumed',
  adjust:   'Adjusted',
  waste:    'Wasted',
}

export const TXN_COLORS: Record<TxnType, string> = {
  purchase: 'text-green-600 dark:text-green-400',
  consume:  'text-blue-600 dark:text-blue-400',
  adjust:   'text-yellow-600 dark:text-yellow-400',
  waste:    'text-red-600 dark:text-red-400',
}

// Preset items for quick setup
export const PRESET_ITEMS = [
  { name: 'Rice',       unit: 'kg'    as Unit, min_threshold: 2  },
  { name: 'Wheat',      unit: 'kg'    as Unit, min_threshold: 2  },
  { name: 'Sugar',      unit: 'kg'    as Unit, min_threshold: 1  },
  { name: 'Salt',       unit: 'kg'    as Unit, min_threshold: 0.5},
  { name: 'Oil',        unit: 'L'     as Unit, min_threshold: 1  },
  { name: 'Dal',        unit: 'kg'    as Unit, min_threshold: 0.5},
  { name: 'Eggs',       unit: 'dozen' as Unit, min_threshold: 1  },
  { name: 'Milk',       unit: 'L'     as Unit, min_threshold: 2  },
  { name: 'Onion',      unit: 'kg'    as Unit, min_threshold: 1  },
  { name: 'Tomato',     unit: 'kg'    as Unit, min_threshold: 0.5},
  { name: 'Potato',     unit: 'kg'    as Unit, min_threshold: 1  },
  { name: 'Atta',       unit: 'kg'    as Unit, min_threshold: 2  },
  { name: 'Turmeric',   unit: 'g'     as Unit, min_threshold: 50 },
  { name: 'Chilli Pwd', unit: 'g'     as Unit, min_threshold: 50 },
  { name: 'Soap',       unit: 'count' as Unit, min_threshold: 2  },
  { name: 'Toothpaste', unit: 'count' as Unit, min_threshold: 1  },
]

export interface InventoryItem {
  id:            string
  household_id:  string
  name:          string
  unit:          Unit
  current_qty:   number
  min_threshold: number
  is_custom:     number
  is_active:     number
  is_low_stock:  number
  created_at:    string
  updated_at:    string
}

export interface InventoryTransaction {
  id:          string
  item_id:     string
  type:        TxnType
  qty:         number
  unit_price?: number
  total_price?: number
  note?:       string
  txn_date:    string
  by_name:     string
}

export interface InventorySummary {
  total_items:     number
  low_stock_count: number
  low_stock_items: InventoryItem[]
}

export async function listInventoryItems(householdId: string, lowStock?: boolean) {
  const p = new URLSearchParams({ household_id: householdId })
  if (lowStock) p.set('low_stock', 'true')
  const res = await apiClient.get(`/inventory/items?${p}`)
  return res.data.data as InventoryItem[]
}

export async function createInventoryItem(data: {
  household_id: string; name: string; unit: Unit
  current_qty?: number; min_threshold?: number; is_custom?: boolean
}) {
  const res = await apiClient.post('/inventory/items', data)
  return res.data.data as InventoryItem
}

export async function updateInventoryItem(id: string, data: {
  name?: string; unit?: Unit; min_threshold?: number
}) {
  const res = await apiClient.patch(`/inventory/items/${id}`, data)
  return res.data.data as InventoryItem
}

export async function deleteInventoryItem(id: string) {
  await apiClient.delete(`/inventory/items/${id}`)
}

export async function addInventoryTransaction(itemId: string, data: {
  type: TxnType; qty: number
  unit_price?: number; total_price?: number; note?: string; txn_date?: string
}) {
  const res = await apiClient.post(`/inventory/items/${itemId}/transactions`, data)
  return res.data.data as { item: InventoryItem; transaction_id: string }
}

export async function getInventoryTransactions(itemId: string, limit = 30) {
  const res = await apiClient.get(`/inventory/items/${itemId}/transactions?limit=${limit}`)
  return res.data.data as InventoryTransaction[]
}

export async function getInventorySummary(householdId: string) {
  const res = await apiClient.get(`/inventory/summary?household_id=${householdId}`)
  return res.data.data as InventorySummary
}

