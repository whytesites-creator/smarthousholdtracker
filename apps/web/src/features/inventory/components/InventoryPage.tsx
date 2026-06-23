import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, Trash2, AlertTriangle, CheckCircle2,
  Package, History, RefreshCw, Sparkles,
} from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/use-auth-context'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { InventoryItemModal } from './InventoryItemModal'
import { TransactionModal } from './TransactionModal'
import {
  listInventoryItems, createInventoryItem, updateInventoryItem,
  deleteInventoryItem, addInventoryTransaction, getInventoryTransactions,
  PRESET_ITEMS, TXN_LABELS, TXN_COLORS,
  type InventoryItem, type TxnType,
} from '../services/inventory.service'

// ── Stock status helpers ──────────────────────────────────────────────────────
function stockStatus(item: InventoryItem): 'low' | 'ok' | 'none' {
  if (item.min_threshold === 0) return 'none'
  return item.current_qty <= item.min_threshold ? 'low' : 'ok'
}

function StockBar({ item }: { item: InventoryItem }) {
  if (item.min_threshold === 0) return null
  const pct = Math.min(100, Math.round((item.current_qty / (item.min_threshold * 3)) * 100))
  const color = item.is_low_stock ? 'bg-red-500' : 'bg-green-500'
  return (
    <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ── Transaction history panel ─────────────────────────────────────────────────
function TransactionHistory({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const { data: txns = [], isLoading } = useQuery({
    queryKey: ['inv-txns', item.id],
    queryFn: () => getInventoryTransactions(item.id),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-card border rounded-2xl w-full max-w-sm shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div>
            <h2 className="font-semibold">{item.name}</h2>
            <p className="text-xs text-muted-foreground">Transaction history</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground text-lg">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
          ) : txns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No transactions yet</p>
          ) : txns.map(t => (
            <div key={t.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/40">
              <span className={`text-xs font-semibold mt-0.5 ${TXN_COLORS[t.type]}`}>
                {t.qty > 0 ? '+' : ''}{t.qty} {item.unit}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium ${TXN_COLORS[t.type]}`}>{TXN_LABELS[t.type]}</p>
                {t.note && <p className="text-xs text-muted-foreground truncate">{t.note}</p>}
                <p className="text-xs text-muted-foreground">
                  {new Date(t.txn_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  {' · '}{t.by_name}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Preset quick-add panel ────────────────────────────────────────────────────
function PresetPanel({
  existingNames, householdId, onAdd, onClose,
}: {
  existingNames: Set<string>
  householdId: string
  onAdd: (name: string) => void
  onClose: () => void
}) {
  const available = PRESET_ITEMS.filter(p => !existingNames.has(p.name.toLowerCase()))
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-card border rounded-2xl w-full max-w-sm shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">Quick Add Common Items</h2>
          <button onClick={onClose} className="text-muted-foreground text-lg">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">All common items already added!</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {available.map(p => (
                <button
                  key={p.name}
                  onClick={() => onAdd(p.name)}
                  className="flex items-center gap-2 p-2.5 border rounded-xl hover:bg-accent transition-colors text-sm text-left"
                >
                  <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="font-medium text-xs">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.unit}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function InventoryPage() {
  const { activeHousehold } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const hId = activeHousehold?.id ?? ''

  const [filter, setFilter] = useState<'all' | 'low'>('all')
  const [showAddItem, setShowAddItem]     = useState(false)
  const [showPresets, setShowPresets]     = useState(false)
  const [editItem, setEditItem]           = useState<InventoryItem | null>(null)
  const [txnItem, setTxnItem]             = useState<InventoryItem | null>(null)
  const [txnType, setTxnType]             = useState<TxnType>('purchase')
  const [historyItem, setHistoryItem]     = useState<InventoryItem | null>(null)
  const [presetName, setPresetName]       = useState<string | null>(null)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['inventory', hId] })
    qc.invalidateQueries({ queryKey: ['inventory-summary', hId] })
  }

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory', hId, filter],
    queryFn: () => listInventoryItems(hId, filter === 'low'),
    enabled: !!hId,
  })

  const lowCount  = items.filter(i => i.is_low_stock).length
  const totalItems = items.length

  const createMutation = useMutation({
    mutationFn: createInventoryItem,
    onSuccess: () => { invalidate(); toast({ title: 'Item added ✓' }) },
    onError:   () => toast({ variant: 'destructive', title: 'Failed to add item' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateInventoryItem>[1] }) =>
      updateInventoryItem(id, data),
    onSuccess: () => { invalidate(); toast({ title: 'Item updated ✓' }) },
    onError:   () => toast({ variant: 'destructive', title: 'Failed to update' }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteInventoryItem,
    onSuccess: () => { invalidate(); toast({ title: 'Item removed' }) },
    onError:   () => toast({ variant: 'destructive', title: 'Failed to remove' }),
  })

  const txnMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: Parameters<typeof addInventoryTransaction>[1] }) =>
      addInventoryTransaction(itemId, data),
    onSuccess: () => { invalidate(); toast({ title: 'Stock updated ✓' }) },
    onError:   () => toast({ variant: 'destructive', title: 'Failed to update stock' }),
  })

  const existingNames = new Set(items.map(i => i.name.toLowerCase()))

  const handlePresetAdd = async (name: string) => {
    const preset = PRESET_ITEMS.find(p => p.name === name)!
    await createMutation.mutateAsync({
      household_id: hId, name: preset.name, unit: preset.unit,
      min_threshold: preset.min_threshold, current_qty: 0, is_custom: false,
    })
    setShowPresets(false)
  }

  if (!hId) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      Please select a household first.
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Grocery Inventory</h1>
          <p className="text-sm text-muted-foreground">{activeHousehold?.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPresets(true)}>
            <Sparkles className="w-4 h-4 mr-1" /> Quick Add
          </Button>
          <Button size="sm" onClick={() => { setEditItem(null); setShowAddItem(true) }}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex gap-3">
        <button
          onClick={() => setFilter('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
            filter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
          }`}
        >
          <Package className="w-4 h-4" /> All ({totalItems})
        </button>
        <button
          onClick={() => setFilter('low')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
            filter === 'low'
              ? 'bg-red-500 text-white border-red-500'
              : lowCount > 0
                ? 'border-red-300 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950'
                : 'hover:bg-accent'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Low Stock {lowCount > 0 && `(${lowCount})`}
        </button>
      </div>

      {/* Items grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-5xl">🛒</p>
          <p className="font-medium">No items yet</p>
          <p className="text-sm text-muted-foreground">
            {filter === 'low' ? 'No low stock items!' : 'Add your pantry items to start tracking'}
          </p>
          {filter === 'all' && (
            <div className="flex gap-2 justify-center">
              <Button size="sm" variant="outline" onClick={() => setShowPresets(true)}>
                <Sparkles className="w-4 h-4 mr-1" /> Quick Add Common Items
              </Button>
              <Button size="sm" onClick={() => setShowAddItem(true)}>
                <Plus className="w-4 h-4 mr-1" /> Add Custom
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {items.map((item) => {
            const status = stockStatus(item)
            const isLow  = status === 'low'
            return (
              <div
                key={item.id}
                className={`bg-card border rounded-xl p-3 space-y-1 transition-shadow hover:shadow-sm ${
                  isLow ? 'border-red-300 dark:border-red-700' : ''
                }`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{item.name}</p>
                  </div>
                  {isLow
                    ? <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    : status === 'ok' ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> : null
                  }
                </div>

                {/* Stock */}
                <p className={`text-xl font-bold ${isLow ? 'text-red-600 dark:text-red-400' : ''}`}>
                  {item.current_qty}
                  <span className="text-sm font-normal text-muted-foreground ml-1">{item.unit}</span>
                </p>
                {item.min_threshold > 0 && (
                  <p className="text-xs text-muted-foreground">Min: {item.min_threshold} {item.unit}</p>
                )}

                <StockBar item={item} />

                {/* Quick actions */}
                <div className="flex gap-1 pt-1">
                  <button
                    onClick={() => { setTxnItem(item); setTxnType('purchase'); }}
                    className="flex-1 text-xs py-1 rounded-lg bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900 font-medium transition-colors"
                    title="Add stock"
                  >+ Add</button>
                  <button
                    onClick={() => { setTxnItem(item); setTxnType('consume'); }}
                    className="flex-1 text-xs py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 font-medium transition-colors"
                    title="Use stock"
                  >- Use</button>
                  <button
                    onClick={() => setHistoryItem(item)}
                    className="p-1 rounded-lg hover:bg-accent text-muted-foreground"
                    title="History"
                  ><History className="w-3.5 h-3.5" /></button>
                  <button
                    onClick={() => { setEditItem(item); setShowAddItem(true) }}
                    className="p-1 rounded-lg hover:bg-accent text-muted-foreground"
                  ><Pencil className="w-3.5 h-3.5" /></button>
                  <button
                    onClick={() => {
                      if (confirm(`Remove "${item.name}"?`)) deleteMutation.mutate(item.id)
                    }}
                    className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  ><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {showAddItem && (
        <InventoryItemModal
          item={editItem}
          onSave={async (data) => {
            if (editItem) {
              await updateMutation.mutateAsync({ id: editItem.id, data })
            } else {
              await createMutation.mutateAsync({ household_id: hId, ...data })
            }
            setEditItem(null)
          }}
          onClose={() => { setShowAddItem(false); setEditItem(null) }}
        />
      )}

      {txnItem && (
        <TransactionModal
          item={txnItem}
          defaultType={txnType}
          onSave={async (data) => {
            await txnMutation.mutateAsync({ itemId: txnItem.id, data })
          }}
          onClose={() => setTxnItem(null)}
        />
      )}

      {historyItem && (
        <TransactionHistory item={historyItem} onClose={() => setHistoryItem(null)} />
      )}

      {showPresets && (
        <PresetPanel
          existingNames={existingNames}
          householdId={hId}
          onAdd={handlePresetAdd}
          onClose={() => setShowPresets(false)}
        />
      )}
    </div>
  )
}

