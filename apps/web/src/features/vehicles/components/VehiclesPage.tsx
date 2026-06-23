import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Trash2, Car, Wrench, X, ChevronDown, ChevronUp,
  AlertTriangle, Calendar, Gauge,
} from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/use-auth-context'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  listVehicles, createVehicle, deleteVehicle,
  listVehicleServices, addVehicleService,
  FUEL_TYPES, FUEL_LABELS, SERVICE_TYPES, SERVICE_LABELS,
  type Vehicle, type VehicleService,
} from '../services/vehicles.service'

// ── Schemas ───────────────────────────────────────────────────────────────────
const vehicleSchema = z.object({
  nickname:         z.string().min(1).max(80),
  make:             z.string().max(60).optional(),
  model:            z.string().max(60).optional(),
  year:             z.coerce.number().int().min(1900).max(2100).optional(),
  reg_number:       z.string().max(20).optional(),
  fuel_type:        z.enum(FUEL_TYPES).default('petrol'),
  color:            z.string().max(30).optional(),
  insurance_expiry: z.string().optional(),
  puc_expiry:       z.string().optional(),
  next_service:     z.string().optional(),
})
type VehicleForm = z.infer<typeof vehicleSchema>

const serviceSchema = z.object({
  service_date: z.string().min(1, 'Date required'),
  service_type: z.enum(SERVICE_TYPES),
  odometer:     z.coerce.number().int().positive().optional(),
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
function expiryBadge(dateStr?: string) {
  const days = daysUntil(dateStr)
  if (days === null) return null
  if (days < 0) return { text: 'Expired', cls: 'text-red-600 bg-red-100 dark:bg-red-950' }
  if (days <= 30) return { text: `${days}d left`, cls: 'text-amber-600 bg-amber-100 dark:bg-amber-950' }
  return { text: `${days}d left`, cls: 'text-green-600 bg-green-100 dark:bg-green-950' }
}

// ── Vehicle Form Modal ─────────────────────────────────────────────────────────
function VehicleFormModal({ householdId, onSave, onClose }: { householdId: string; onSave: (d: VehicleForm) => Promise<void>; onClose: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<VehicleForm>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: { fuel_type: 'petrol' },
  })
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-card border rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-card z-10">
          <h2 className="font-semibold">Add Vehicle</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <form onSubmit={handleSubmit(onSave)} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Nickname *</Label>
              <Input placeholder="e.g. My Bike, Family Car" {...register('nickname')} />
              {errors.nickname && <p className="text-xs text-destructive">{errors.nickname.message}</p>}
            </div>
            <div className="space-y-1"><Label>Make</Label><Input placeholder="Honda, Maruti…" {...register('make')} /></div>
            <div className="space-y-1"><Label>Model</Label><Input placeholder="Activa, Swift…" {...register('model')} /></div>
            <div className="space-y-1"><Label>Year</Label><Input type="number" placeholder="2021" {...register('year')} /></div>
            <div className="space-y-1"><Label>Reg. Number</Label><Input placeholder="TN01AB1234" {...register('reg_number')} /></div>
            <div className="space-y-1">
              <Label>Fuel Type</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('fuel_type')}>
                {FUEL_TYPES.map(f => <option key={f} value={f}>{FUEL_LABELS[f]}</option>)}
              </select>
            </div>
            <div className="space-y-1"><Label>Color</Label><Input placeholder="Red, White…" {...register('color')} /></div>
            <div className="space-y-1"><Label>Insurance Expiry</Label><Input type="date" {...register('insurance_expiry')} /></div>
            <div className="space-y-1"><Label>PUC Expiry</Label><Input type="date" {...register('puc_expiry')} /></div>
            <div className="col-span-2 space-y-1"><Label>Next Service Due</Label><Input type="date" {...register('next_service')} /></div>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" type="button" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Add Vehicle'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Service Form Modal ─────────────────────────────────────────────────────────
function ServiceFormModal({ vehicle, onSave, onClose }: { vehicle: Vehicle; onSave: (d: ServiceForm) => Promise<void>; onClose: () => void }) {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<ServiceForm>({
    resolver: zodResolver(serviceSchema),
    defaultValues: { service_date: new Date().toISOString().split('T')[0], service_type: 'regular' },
  })
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-card border rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <div><h2 className="font-semibold">Log Service</h2><p className="text-sm text-muted-foreground">{vehicle.nickname}</p></div>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <form onSubmit={handleSubmit(onSave)} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Date *</Label><Input type="date" {...register('service_date')} /></div>
            <div className="space-y-1">
              <Label>Type</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('service_type')}>
                {SERVICE_TYPES.map(t => <option key={t} value={t}>{SERVICE_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="space-y-1"><Label>Odometer (km)</Label><Input type="number" placeholder="45000" {...register('odometer')} /></div>
            <div className="space-y-1"><Label>Cost (₹)</Label><Input type="number" placeholder="2500" {...register('cost')} /></div>
            <div className="col-span-2 space-y-1"><Label>Provider / Mechanic</Label><Input placeholder="City Honda Service" {...register('provider')} /></div>
            <div className="col-span-2 space-y-1"><Label>Notes</Label><Input placeholder="Oil change, filter replaced…" {...register('notes')} /></div>
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

// ── Vehicle Card ──────────────────────────────────────────────────────────────
function VehicleCard({ vehicle, householdId, onDelete }: { vehicle: Vehicle; householdId: string; onDelete: () => void }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [showService, setShowService] = useState(false)

  const { data: services = [] } = useQuery({
    queryKey: ['vehicle-services', vehicle.id],
    queryFn:  () => listVehicleServices(vehicle.id),
    enabled:  expanded,
  })

  const addServiceMut = useMutation({
    mutationFn: (d: ServiceForm) => addVehicleService(vehicle.id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicle-services', vehicle.id] })
      qc.invalidateQueries({ queryKey: ['vehicles', householdId] })
      toast({ title: 'Service logged ✓' })
      setShowService(false)
    },
    onError: () => toast({ variant: 'destructive', title: 'Failed to log service' }),
  })

  const insur = expiryBadge(vehicle.insurance_expiry)
  const puc   = expiryBadge(vehicle.puc_expiry)

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <Car className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <p className="font-semibold">{vehicle.nickname}</p>
              <p className="text-sm text-muted-foreground">
                {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ')}
                {vehicle.reg_number ? ` · ${vehicle.reg_number}` : ''}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{FUEL_LABELS[vehicle.fuel_type]}{vehicle.color ? ` · ${vehicle.color}` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setExpanded(!expanded)} className="p-2 hover:bg-accent rounded-lg text-muted-foreground">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button onClick={() => confirm(`Delete "${vehicle.nickname}"?`) && onDelete()} className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg text-muted-foreground">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expiry badges */}
        <div className="flex flex-wrap gap-2 mt-3">
          {vehicle.insurance_expiry && insur && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${insur.cls}`}>
              <Calendar className="w-3 h-3" /> Insurance: {fmtDate(vehicle.insurance_expiry)} · {insur.text}
            </span>
          )}
          {vehicle.puc_expiry && puc && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${puc.cls}`}>
              <AlertTriangle className="w-3 h-3" /> PUC: {fmtDate(vehicle.puc_expiry)} · {puc.text}
            </span>
          )}
          {vehicle.next_service && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 text-blue-600 bg-blue-100 dark:bg-blue-950">
              <Gauge className="w-3 h-3" /> Next service: {fmtDate(vehicle.next_service)}
            </span>
          )}
        </div>
      </div>

      {/* Expanded: service history */}
      {expanded && (
        <div className="border-t p-4 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Service History ({vehicle.service_count})</p>
            <Button size="sm" variant="outline" onClick={() => setShowService(true)}>
              <Plus className="w-3 h-3 mr-1" /> Log Service
            </Button>
          </div>
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground">No service records yet.</p>
          ) : (
            services.map((s: VehicleService) => (
              <div key={s.id} className="bg-card border rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{SERVICE_LABELS[s.service_type]}</span>
                  <span className="text-muted-foreground">{fmtDate(s.service_date)}</span>
                </div>
                <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-2 text-xs">
                  {s.cost && <span>₹{s.cost.toLocaleString('en-IN')}</span>}
                  {s.odometer && <span>{s.odometer.toLocaleString('en-IN')} km</span>}
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
          vehicle={vehicle}
          onSave={async (d) => { await addServiceMut.mutateAsync(d) }}
          onClose={() => setShowService(false)}
        />
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function VehiclesPage() {
  const { activeHousehold } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const hId = activeHousehold?.id ?? ''
  const [showAdd, setShowAdd] = useState(false)

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['vehicles', hId],
    queryFn:  () => listVehicles(hId),
    enabled:  !!hId,
  })

  const createMut = useMutation({
    mutationFn: (d: VehicleForm) => createVehicle({ household_id: hId, ...d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles', hId] }); toast({ title: 'Vehicle added ✓' }); setShowAdd(false) },
    onError: () => toast({ variant: 'destructive', title: 'Failed to add vehicle' }),
  })

  const deleteMut = useMutation({
    mutationFn: deleteVehicle,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles', hId] }); toast({ title: 'Vehicle removed' }) },
  })

  const expiringSoon = vehicles.filter(v => {
    const insur = daysUntil(v.insurance_expiry)
    const puc   = daysUntil(v.puc_expiry)
    return (insur !== null && insur <= 30) || (puc !== null && puc <= 30)
  })

  if (!hId) return <div className="flex items-center justify-center h-64 text-muted-foreground">Select a household first.</div>

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Car className="w-5 h-5" /> Vehicles</h1>
          <p className="text-sm text-muted-foreground">{activeHousehold?.name}</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1" /> Add Vehicle</Button>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold">{vehicles.length}</p>
          <p className="text-xs text-muted-foreground">Total Vehicles</p>
        </div>
        <div className={`bg-card border rounded-xl p-3 text-center ${expiringSoon.length > 0 ? 'border-amber-300 dark:border-amber-700' : ''}`}>
          <p className={`text-2xl font-bold ${expiringSoon.length > 0 ? 'text-amber-600' : ''}`}>{expiringSoon.length}</p>
          <p className="text-xs text-muted-foreground">Expiring Soon</p>
        </div>
        <div className="bg-card border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold">{vehicles.reduce((s, v) => s + v.service_count, 0)}</p>
          <p className="text-xs text-muted-foreground">Service Records</p>
        </div>
      </div>

      {/* Vehicle list */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : vehicles.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Car className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="font-medium">No vehicles added yet</p>
          <p className="text-sm text-muted-foreground">Track insurance, PUC expiry & service history</p>
          <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1" /> Add First Vehicle</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {vehicles.map(v => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              householdId={hId}
              onDelete={() => deleteMut.mutate(v.id)}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <VehicleFormModal
          householdId={hId}
          onSave={async (d) => { await createMut.mutateAsync(d) }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  )
}

