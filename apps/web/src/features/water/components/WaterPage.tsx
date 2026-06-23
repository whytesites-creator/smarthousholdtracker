import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Droplets, CalendarClock } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/use-auth-context'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { listWaterDeliveries, createWaterDelivery, deleteWaterDelivery } from '../services/water.service'

const schema = z.object({
  qty:           z.coerce.number().positive(),
  unit:          z.enum(['cans','L']).default('cans'),
  vendor:        z.string().max(80).optional(),
  cost:          z.coerce.number().min(0).optional(),
  delivery_date: z.string(),
  notes:         z.string().max(200).optional(),
})
type FormValues = z.infer<typeof schema>
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }

export function WaterPage() {
  const { activeHousehold } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const hId = activeHousehold?.id ?? ''
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['water', hId],
    queryFn: () => listWaterDeliveries(hId),
    enabled: !!hId,
  })

  const deliveries = data?.deliveries ?? []
  const analytics  = data?.analytics

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { delivery_date: new Date().toISOString().split('T')[0], unit: 'cans' },
  })

  const createMut = useMutation({
    mutationFn: createWaterDelivery,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['water', hId] }); toast({ title: 'Delivery logged ✓' }); setShowForm(false); reset() },
    onError: () => toast({ variant: 'destructive', title: 'Failed to save' }),
  })
  const deleteMut = useMutation({
    mutationFn: deleteWaterDelivery,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['water', hId] }); toast({ title: 'Entry deleted' }) },
  })

  if (!hId) return <div className="flex items-center justify-center h-64 text-muted-foreground">Select a household first.</div>

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Water Can</h1><p className="text-sm text-muted-foreground">{activeHousehold?.name}</p></div>
        <Button size="sm" onClick={() => setShowForm(v => !v)}><Plus className="w-4 h-4 mr-1" /> Log Delivery</Button>
      </div>

      {/* Status card */}
      <div className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2"><Droplets className="w-5 h-5" /><span className="font-semibold">Water Supply</span></div>
        {deliveries.length > 0 ? (
          <div className="flex justify-between items-end">
            <div>
              <p className="text-3xl font-bold">{analytics?.avgQty ?? '—'} <span className="text-lg font-normal">cans avg/delivery</span></p>
              {analytics?.avgDays && <p className="text-sm opacity-80">Delivery every ~{analytics.avgDays} days</p>}
            </div>
          </div>
        ) : <p className="opacity-80">Log your first delivery to start tracking</p>}
        {analytics?.predictedNext && (
          <p className="text-xs opacity-80 flex items-center gap-1">
            <CalendarClock className="w-3.5 h-3.5" /> Next delivery predicted: {fmtDate(analytics.predictedNext)}
          </p>
        )}
      </div>

      {/* Stats */}
      {deliveries.length >= 2 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border rounded-xl p-3 text-center"><p className="text-2xl font-bold">{deliveries.length}</p><p className="text-xs text-muted-foreground">Total deliveries</p></div>
          <div className="bg-card border rounded-xl p-3 text-center"><p className="text-2xl font-bold">{analytics?.avgDays ?? '—'}</p><p className="text-xs text-muted-foreground">Avg days between</p></div>
          <div className="bg-card border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{deliveries.filter(d => d.cost).length > 0 ? `₹${Math.round(deliveries.filter(d => d.cost).reduce((s, d) => s + (d.cost ?? 0), 0) / deliveries.filter(d => d.cost).length)}` : '—'}</p>
            <p className="text-xs text-muted-foreground">Avg cost</p>
          </div>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleSubmit(d => createMut.mutateAsync({ household_id: hId, ...d }))}
          className="bg-card border rounded-2xl p-4 space-y-3">
          <h3 className="font-semibold">Log Delivery</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Date</Label><Input type="date" {...register('delivery_date')} /></div>
            <div className="space-y-1"><Label>Qty</Label><Input type="number" placeholder="2" {...register('qty')} /></div>
            <div className="space-y-1">
              <Label>Unit</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('unit')}>
                <option value="cans">Cans</option><option value="L">Litres</option>
              </select>
            </div>
            <div className="space-y-1"><Label>Cost (₹)</Label><Input type="number" placeholder="80" {...register('cost')} /></div>
          </div>
          <Input placeholder="Vendor (optional)" {...register('vendor')} />
          <div className="flex gap-3"><Button variant="outline" type="button" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save'}</Button></div>
        </form>
      )}

      {/* History */}
      <div className="space-y-2">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Delivery History</h2>
        {isLoading ? <div className="h-20 bg-muted animate-pulse rounded-xl" /> :
          deliveries.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No deliveries logged yet</p> :
          deliveries.map((d, i) => (
            <div key={d.id} className="flex items-center gap-3 bg-card border rounded-xl p-3">
              <Droplets className="w-5 h-5 text-cyan-500 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-sm">{fmtDate(d.delivery_date)} {i === 0 && <span className="text-xs bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300 px-2 py-0.5 rounded-full ml-1">Latest</span>}</p>
                <p className="text-xs text-muted-foreground">{d.qty} {d.unit}{d.vendor ? ` · ${d.vendor}` : ''}</p>
              </div>
              {d.cost && <p className="font-semibold">₹{d.cost}</p>}
              <button onClick={() => confirm('Delete?') && deleteMut.mutate(d.id)} className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-lg text-muted-foreground"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))
        }
      </div>
    </div>
  )
}

