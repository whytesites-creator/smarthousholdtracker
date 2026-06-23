import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UNITS, type InventoryItem } from '../services/inventory.service'

const schema = z.object({
  name:          z.string().min(1, 'Name is required').max(60),
  unit:          z.enum(UNITS),
  current_qty:   z.coerce.number().min(0),
  min_threshold: z.coerce.number().min(0),
})
type FormValues = z.infer<typeof schema>

interface Props {
  item?: InventoryItem | null
  onSave: (data: FormValues & { is_custom: boolean }) => Promise<void>
  onClose: () => void
}

export function InventoryItemModal({ item, onSave, onClose }: Props) {
  const isEdit = !!item
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', unit: 'kg', current_qty: 0, min_threshold: 0 },
  })

  useEffect(() => {
    if (item) reset({ name: item.name, unit: item.unit, current_qty: item.current_qty, min_threshold: item.min_threshold })
  }, [item, reset])

  const onSubmit = async (values: FormValues) => {
    await onSave({ ...values, is_custom: true })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-card border rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">{isEdit ? 'Edit Item' : 'Add Item'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div className="space-y-2">
            <Label>Item Name</Label>
            <Input placeholder="e.g. Rice" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Unit</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('unit')}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          {!isEdit && (
            <div className="space-y-2">
              <Label>Current Stock</Label>
              <Input type="number" step="0.01" min="0" placeholder="0" {...register('current_qty')} />
              <p className="text-xs text-muted-foreground">Enter how much you have right now</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Low Stock Alert Threshold</Label>
            <Input type="number" step="0.01" min="0" placeholder="0" {...register('min_threshold')} />
            <p className="text-xs text-muted-foreground">Alert when stock falls below this level (0 = no alert)</p>
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : isEdit ? 'Save' : 'Add Item'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

