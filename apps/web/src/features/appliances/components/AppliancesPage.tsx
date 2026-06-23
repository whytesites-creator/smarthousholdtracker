import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Wrench, X, ChevronDown, ChevronUp, Calendar, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/use-auth-context'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  listAppliances, createAppliance, deleteAppliance,
  listApplianceServices, addApplianceService,
  APPLIANCE_CATEGORIES, CATEGORY_LABELS, CATEGORY_ICONS,
  APPLIANCE_SERVICE_TYPES, SERVICE_TYPE_LABELS,
  type Appliance, type ApplianceService,
} from '../services/appliances.service'

// ── Schemas ───────────────────────────────────────────────────────────────────
const applianceSchema = z.object({
  name:            z.string().min(1).max(100),
  category:        z.enum(APPLIANCE_CATEGORIES),
  brand:           z.string().max(60).optional(),
  model:           z.string().max(60).optional(),
  serial_no:       z.string().max(60).optional(),
  purchase_date:   z.string().optional(),
  warranty_expiry: z.string().optional(),
  purchase_price:  z.coerce.number().positive().optional(),
  shop:            z.string().max(100).optional(),
})
type ApplianceForm = z.infer<typeof applianceSchema>

const serviceSchema = z.object({
  service_date: z.string().min(1, 'Date required'),
  service_type: z.enum(APPLIANCE_SERVICE_TYPES),
  cost:         z.coerce.number().positive().optional(),
  provider:     z.string().max(100).optional(),
  notes:        z.string().max(300).optional(),
})
type ServiceForm = z.infer<typeof serviceSchema>

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysUntil(dateStr?: string) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}
function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
function warrantyBadge(dateStr?: string) {
  const days = daysUntil(dateStr)
  if (days === null) return null
  if (days < 0) return { text: 'Expired', cls: 'text-red-600 bg-red-100 dark:bg-red-950' }
  if (days <= 90) return { text: `${days}d left`, cls: 'text-amber-600 bg-amber-100 dark:bg-amber-950' }
  return { text: `${days}d left`, cls: 'text-green-600 bg-green-100 dark:bg-green-950' }
}

// ── Appliance Form Modal ──────────────────────────────────────────────────────
function ApplianceFormModal({ onSave, onClose }: { onSave: (d: ApplianceForm) => Promise<void>; onClose: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ApplianceForm>({
    resolver: zodResolver(applianceSchema),
    defaultValues: { category: 'other' },
  })
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-card border rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-card z-10">
          <h2 className="font-semibold">Add Appliance</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <form onSubmit={handleSubmit(onSave)} className="p-4 space-y-4">
          {/* Category grid */}
          <div className="space-y-2">
            <Label>Category</Label>
            <div className="grid grid-cols-4 gap-2">
              {APPLIANCE_CATEGORIES.map(cat => (
                <label key={cat} className="flex flex-col items-center gap-1 p-2 border rounded-xl cursor-pointer hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-all text-center">
                  <input type="radio" value={cat} className="sr-only" {...register('category')} />
                  <span className="text-xl">{CATEGORY_ICONS[cat]}</span>
                  <span className="text-xs leading-tight">{CATEGORY_LABELS[cat].split(' ')[0]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Name *</Label>
              <Input placeholder="e.g. Living Room AC, Kitchen Fridge" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1"><Label>Brand</Label><Input placeholder="Samsung, LG…" {...register('brand')} /></div>
            <div className="space-y-1"><Label>Model</Label><Input placeholder="Model number" {...register('model')} /></div>
            <div className="space-y-1"><Label>Serial No.</Label><Input placeholder="SN123456" {...register('serial_no')} /></div>
            <div className="space-y-1"><Label>Price (₹)</Label><Input type="number" placeholder="25000" {...register('purchase_price')} /></div>
            <div className="space-y-1"><Label>Purchase Date</Label><Input type="date" {...register('purchase_date')} /></div>
            <div className="space-y-1"><Label>Warranty Expiry</Label><Input type="date" {...register('warranty_expiry')} /></div>
            <div className="col-span-2 space-y-1"><Label>Shop / Platform</Label><Input placeholder="Reliance Digital, Amazon…" {...register('shop')} /></div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" type="button" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Add Appliance'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Service Modal ─────────────────────────────────────────────────────────────
function ServiceFormModal({ appliance, onSave, onClose }: { appliance: Appliance; onSave: (d: ServiceForm) => Promise<void>; onClose: () => void }) {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<ServiceForm>({
    resolver: zodResolver(serviceSchema),
    defaultValues: { service_date: new Date().toISOString().split('T')[0], service_type: 'repair' },
  })
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-card border rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <div><h2 className="font-semibold">Log Service</h2><p className="text-sm text-muted-foreground">{appliance.name}</p></div>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <form onSubmit={handleSubmit(onSave)} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Date *</Label><Input type="date" {...register('service_date')} /></div>
            <div className="space-y-1">
              <Label>Type</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('service_type')}>
                {APPLIANCE_SERVICE_TYPES.map(t => <option key={t} value={t}>{SERVICE_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="space-y-1"><Label>Cost (₹)</Label><Input type="number" placeholder="500" {...register('cost')} /></div>
            <div className="space-y-1"><Label>Provider</Label><Input placeholder="Technician / Company" {...register('provider')} /></div>
            <div className="col-span-2 space-y-1"><Label>Notes</Label><Input placeholder="What was done…" {...register('notes')} /></div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" type="button" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Log Service'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Appliance Card ─────────────────────────────────────────────────────────────
function ApplianceCard({ appliance, onDelete }: { appliance: Appliance; onDelete: () => void }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [showService, setShowService] = useState(false)

  const { data: services = [] } = useQuery({
    queryKey: ['appliance-services', appliance.id],
    queryFn:  () => listApplianceServices(appliance.id),
    enabled:  expanded,
  })

  const addServiceMut = useMutation({
    mutationFn: (d: ServiceForm) => addApplianceService(appliance.id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appliance-services', appliance.id] })
      qc.invalidateQueries({ queryKey: ['appliances'] })
      toast({ title: 'Service logged ✓' })
      setShowService(false)
    },
    onError: () => toast({ variant: 'destructive', title: 'Failed to log service' }),
  })

  const warranty = warrantyBadge(appliance.warranty_expiry)

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-100 dark:bg-yellow-950 flex items-center justify-center shrink-0 text-xl">
              {CATEGORY_ICONS[appliance.category]}
            </div>
            <div>
              <p className="font-semibold">{appliance.name}</p>
              <p className="text-sm text-muted-foreground">
                {[appliance.brand, appliance.model].filter(Boolean).join(' ')}
                {appliance.serial_no ? ` · S/N: ${appliance.serial_no}` : ''}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{CATEGORY_LABELS[appliance.category]}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setExpanded(!expanded)} className="p-2 hover:bg-accent rounded-lg text-muted-foreground">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button onClick={() => confirm(`Delete "${appliance.name}"?`) && onDelete()} className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg text-muted-foreground">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Details row */}
        <div className="flex flex-wrap gap-2 mt-3 text-xs">
          {appliance.purchase_date && (
            <span className="flex items-center gap-1 text-muted-foreground"><Calendar className="w-3 h-3" />Purchased: {fmtDate(appliance.purchase_date)}</span>
          )}
          {appliance.purchase_price && (
            <span className="text-muted-foreground">₹{appliance.purchase_price.toLocaleString('en-IN')}</span>
          )}
          {appliance.warranty_expiry && warranty && (
            <span className={`px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${warranty.cls}`}>
              <AlertTriangle className="w-3 h-3" /> Warranty: {fmtDate(appliance.warranty_expiry)} · {warranty.text}
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t p-4 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Service History ({appliance.service_count})</p>
            <Button size="sm" variant="outline" onClick={() => setShowService(true)}>
              <Plus className="w-3 h-3 mr-1" /> Log Service
            </Button>
          </div>
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground">No service records yet.</p>
          ) : (
            services.map((s: ApplianceService) => (
              <div key={s.id} className="bg-card border rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{SERVICE_TYPE_LABELS[s.service_type]}</span>
                  <span className="text-muted-foreground">{fmtDate(s.service_date)}</span>
                </div>
                <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-2 text-xs">
                  {s.cost && <span>₹{s.cost.toLocaleString('en-IN')}</span>}
                  {s.provider && <span>{s.provider}</span>}
                  {s.notes && <span>{s.notes}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showService && (
        <ServiceFormModal
          appliance={appliance}
          onSave={async (d) => { await addServiceMut.mutateAsync(d) }}
          onClose={() => setShowService(false)}
        />
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function AppliancesPage() {
  const { activeHousehold } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const hId = activeHousehold?.id ?? ''
  const [showAdd, setShowAdd] = useState(false)

  const { data: appliances = [], isLoading } = useQuery({
    queryKey: ['appliances', hId],
    queryFn:  () => listAppliances(hId),
    enabled:  !!hId,
  })

  const createMut = useMutation({
    mutationFn: (d: ApplianceForm) => createAppliance({ household_id: hId, ...d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appliances', hId] }); toast({ title: 'Appliance added ✓' }); setShowAdd(false) },
    onError: () => toast({ variant: 'destructive', title: 'Failed to add appliance' }),
  })

  const deleteMut = useMutation({
    mutationFn: deleteAppliance,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appliances', hId] }); toast({ title: 'Appliance removed' }) },
  })

  const warrantyExpiring = appliances.filter(a => {
    const days = daysUntil(a.warranty_expiry)
    return days !== null && days >= 0 && days <= 90
  })

  if (!hId) return <div className="flex items-center justify-center h-64 text-muted-foreground">Select a household first.</div>

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Wrench className="w-5 h-5" /> Appliances</h1>
          <p className="text-sm text-muted-foreground">{activeHousehold?.name}</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1" /> Add Appliance</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold">{appliances.length}</p>
          <p className="text-xs text-muted-foreground">Total Appliances</p>
        </div>
        <div className={`bg-card border rounded-xl p-3 text-center ${warrantyExpiring.length > 0 ? 'border-amber-300 dark:border-amber-700' : ''}`}>
          <p className={`text-2xl font-bold ${warrantyExpiring.length > 0 ? 'text-amber-600' : ''}`}>{warrantyExpiring.length}</p>
          <p className="text-xs text-muted-foreground">Warranty Expiring</p>
        </div>
        <div className="bg-card border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold">{appliances.reduce((s, a) => s + a.service_count, 0)}</p>
          <p className="text-xs text-muted-foreground">Service Records</p>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : appliances.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Wrench className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="font-medium">No appliances added yet</p>
          <p className="text-sm text-muted-foreground">Track warranty, service history & invoices</p>
          <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1" /> Add First Appliance</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {appliances.map(a => (
            <ApplianceCard key={a.id} appliance={a} onDelete={() => deleteMut.mutate(a.id)} />
          ))}
        </div>
      )}

      {showAdd && (
        <ApplianceFormModal
          onSave={async (d) => { await createMut.mutateAsync(d) }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  )
}

