import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Flame, CalendarClock, TrendingUp } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/use-auth-context'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { listGasEntries, createGasEntry, deleteGasEntry, CYLINDER_TYPES } from '../services/gas.service'

const schema = z.object({
  refill_date:   z.string(),
  vendor:        z.string().max(80).optional(),
  price:         z.coerce.number().min(0).optional(),
  cylinder_type: z.enum(CYLINDER_TYPES).default('domestic'),
  notes:         z.string().max(200).optional(),
})
type FormValues = z.infer<typeof schema>

function daysAgo(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
}
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }

export function GasPage() {
  const { activeHousehold } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const hId = activeHousehold?.id ?? ''
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['gas', hId],
    queryFn: () => listGasEntries(hId),
    enabled: !!hId,
  })

  const entries    = data?.entries ?? []
  const analytics  = data?.analytics

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { refill_date: new Date().toISOString().split('T')[0], cylinder_type: 'domestic' },
  })

  const createMut = useMutation({
    mutationFn: createGasEntry,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gas', hId] }); toast({ title: 'Refill logged ✓' }); setShowForm(false); reset() },
    onError: () => toast({ variant: 'destructive', title: 'Failed to save' }),
  })

  const deleteMut = useMutation({
    mutationFn: deleteGasEntry,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gas', hId] }); toast({ title: 'Entry deleted' }) },
  })

  const lastEntry  = entries[0]
  const daysSince  = lastEntry ? daysAgo(lastEntry.refill_date) : null
  const avgDays    = analytics?.avgDays
  const daysLeft   = avgDays && daysSince !== null ? Math.max(0, avgDays - daysSince) : null
  const pct        = avgDays && daysSince !== null ? Math.min(100, Math.round((daysSince / avgDays) * 100)) : 0

  if (!hId) return <div className="flex items-center justify-center h-64 text-muted-foreground">Select a household first.</div>

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Gas Cylinder</h1><p className="text-sm text-muted-foreground">{activeHousehold?.name}</p></div>
        <Button size="sm" onClick={() => setShowForm(v => !v)}><Plus className="w-4 h-4 mr-1" /> Log Refill</Button>
      </div>

      {/* Status card */}
      <div className="bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2"><Flame className="w-5 h-5" /><span className="font-semibold">Current Cylinder</span></div>
        {lastEntry ? (
          <>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-3xl font-bold">{daysSince} <span className="text-lg font-normal">days used</span></p>
                {daysLeft !== null && <p className="text-sm opacity-80">~{daysLeft} days remaining (avg {avgDays}d)</p>}
              </div>
              {lastEntry.price && <p className="text-lg font-semibold">₹{lastEntry.price}</p>}
            </div>
            <div className="bg-white/20 rounded-full h-2">
              <div className="bg-white h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            {analytics?.predictedNext && (
              <p className="text-xs opacity-80 flex items-center gap-1">
                <CalendarClock className="w-3.5 h-3.5" /> Next refill predicted: {fmtDate(analytics.predictedNext)}
              </p>
            )}
          </>
        ) : (
          <p className="opacity-80">Log your first refill to start tracking</p>
        )}
      </div>

      {/* Analytics row */}
      {entries.length >= 2 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{analytics?.avgDays ?? '—'}</p>
            <p className="text-xs text-muted-foreground">Avg days/cylinder</p>
          </div>
          <div className="bg-card border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{entries.length}</p>
            <p className="text-xs text-muted-foreground">Total refills</p>
          </div>
          <div className="bg-card border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">
              {entries.filter(e => e.price).length > 0
                ? `₹${Math.round(entries.filter(e => e.price).reduce((s, e) => s + (e.price ?? 0), 0) / entries.filter(e => e.price).length)}`
                : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Avg price</p>
          </div>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleSubmit(d => createMut.mutateAsync({ household_id: hId, ...d }))}
          className="bg-card border rounded-2xl p-4 space-y-3">
          <h3 className="font-semibold">Log Refill</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Date</Label><Input type="date" {...register('refill_date')} /></div>
            <div className="space-y-1"><Label>Price (₹)</Label><Input type="number" placeholder="900" {...register('price')} /></div>
            <div className="space-y-1"><Label>Vendor</Label><Input placeholder="HP / Bharat / Indane" {...register('vendor')} /></div>
            <div className="space-y-1">
              <Label>Type</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('cylinder_type')}>
                {CYLINDER_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <Input placeholder="Notes (optional)" {...register('notes')} />
          <div className="flex gap-3"><Button variant="outline" type="button" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save'}</Button></div>
        </form>
      )}

      {/* History */}
      <div className="space-y-2">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Refill History</h2>
        {isLoading ? <div className="h-20 bg-muted animate-pulse rounded-xl" /> :
          entries.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No refills logged yet</p> :
          entries.map((e, i) => (
            <div key={e.id} className="flex items-center gap-3 bg-card border rounded-xl p-3">
              <Flame className="w-5 h-5 text-orange-500 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-sm">{fmtDate(e.refill_date)} {i === 0 && <span className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 px-2 py-0.5 rounded-full ml-1">Current</span>}</p>
                <p className="text-xs text-muted-foreground">{e.vendor ?? e.cylinder_type}{i > 0 ? ` · ${daysAgo(e.refill_date) - daysAgo(entries[i-1].refill_date)} days this cylinder` : ''}</p>
              </div>
              {e.price && <p className="font-semibold">₹{e.price}</p>}
              <button onClick={() => confirm('Delete?') && deleteMut.mutate(e.id)} className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-lg text-muted-foreground"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))
        }
      </div>
    </div>
  )
}

