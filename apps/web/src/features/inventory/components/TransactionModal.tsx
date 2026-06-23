import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, ShoppingCart, UtensilsCrossed, SlidersHorizontal, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TXN_TYPES, type InventoryItem, type TxnType } from '../services/inventory.service'

const schema = z.object({
  type:        z.enum(TXN_TYPES),
  qty:         z.coerce.number().positive('Must be greater than 0'),
  unit_price:  z.coerce.number().min(0).optional(),
  note:        z.string().max(200).optional(),
  txn_date:    z.string(),
})
type FormValues = z.infer<typeof schema>

const TYPE_CONFIG: Record<TxnType, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  purchase: { icon: ShoppingCart,        label: 'Purchased',  color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' },
  consume:  { icon: UtensilsCrossed,     label: 'Consumed',   color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800' },
  adjust:   { icon: SlidersHorizontal,   label: 'Adjusted',   color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800' },
  waste:    { icon: Trash2,              label: 'Wasted',     color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800' },
}

interface Props {
  item: InventoryItem
  defaultType?: TxnType
  onSave: (data: FormValues) => Promise<void>
  onClose: () => void
}

export function TransactionModal({ item, defaultType = 'purchase', onSave, onClose }: Props) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: defaultType,
      qty: undefined,
      txn_date: new Date().toISOString().split('T')[0],
    },
  })

  const selectedType = watch('type') as TxnType
  const cfg = TYPE_CONFIG[selectedType]

  const onSubmit = async (values: FormValues) => {
    await onSave(values)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-card border rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="font-semibold">Update Stock</h2>
            <p className="text-sm text-muted-foreground">{item.name} — {item.current_qty} {item.unit} in stock</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          {/* Type selector */}
          <div className="grid grid-cols-4 gap-2">
            {TXN_TYPES.map((t) => {
              const c = TYPE_CONFIG[t]
              const Icon = c.icon
              return (
                <label key={t} className={`flex flex-col items-center gap-1 p-2 border rounded-xl cursor-pointer text-center transition-all has-[:checked]:${c.bg} has-[:checked]:border-current`}>
                  <input type="radio" value={t} className="sr-only" {...register('type')} />
                  <Icon className={`w-4 h-4 ${c.color}`} />
                  <span className={`text-xs font-medium ${c.color}`}>{c.label}</span>
                </label>
              )
            })}
          </div>

          <div className={`rounded-lg p-2.5 border text-xs ${cfg.bg} ${cfg.color}`}>
            {selectedType === 'purchase' && 'Stock will increase by the entered quantity.'}
            {selectedType === 'consume'  && 'Stock will decrease (used from inventory).'}
            {selectedType === 'adjust'   && 'Manually correct the stock level.'}
            {selectedType === 'waste'    && 'Stock will decrease (spoiled/discarded).'}
          </div>

          <div className="space-y-2">
            <Label>Quantity ({item.unit})</Label>
            <Input type="number" step="0.01" min="0.01" placeholder="0" {...register('qty')} />
            {errors.qty && <p className="text-xs text-destructive">{errors.qty.message}</p>}
          </div>

          {selectedType === 'purchase' && (
            <div className="space-y-2">
              <Label>Price per {item.unit} (₹, optional)</Label>
              <Input type="number" step="0.01" min="0" placeholder="0.00" {...register('unit_price')} />
            </div>
          )}

          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" {...register('txn_date')} />
          </div>

          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Input placeholder="e.g. Bought from DMart" {...register('note')} />
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Update Stock'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

