import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Trash2, Pencil, CheckCircle2, AlertCircle,
  Clock, FileText, CreditCard, X,
} from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/use-auth-context'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  listBills, createBill, deleteBill, getUpcomingBills, payBillInstance,
  BILL_TYPES, BILL_LABELS, BILL_ICONS, RECURRENCES, RECURRENCE_LABELS,
  PAYMENT_MODES, MODE_LABELS,
  type Bill, type BillInstance,
} from '../services/bills.service'

// ── Bill Form ─────────────────────────────────────────────────────────────────
const billSchema = z.object({
  name:       z.string().min(1).max(80),
  type:       z.enum(BILL_TYPES),
  provider:   z.string().max(80).optional(),
  amount:     z.coerce.number().min(0).optional(),
  recurrence: z.enum(RECURRENCES).default('monthly'),
  due_day:    z.coerce.number().int().min(1).max(28).optional(),
})
type BillFormValues = z.infer<typeof billSchema>

// ── Pay Form ──────────────────────────────────────────────────────────────────
const paySchema = z.object({
  paid_on:     z.string(),
  amount_paid: z.coerce.number().positive(),
  mode:        z.enum(PAYMENT_MODES).default('upi'),
  reference:   z.string().max(80).optional(),
})
type PayFormValues = z.infer<typeof paySchema>

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }
function fmt(n?: number) { return n ? `₹${n.toLocaleString('en-IN')}` : '—' }

// ── Pay Modal ─────────────────────────────────────────────────────────────────
function PayModal({ instance, onPay, onClose }: { instance: BillInstance; onPay: (data: PayFormValues) => Promise<void>; onClose: () => void }) {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<PayFormValues>({
    resolver: zodResolver(paySchema),
    defaultValues: {
      paid_on: new Date().toISOString().split('T')[0],
      amount_paid: instance.amount_due,
      mode: 'upi',
    },
  })
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-card border rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <div><h2 className="font-semibold">Mark as Paid</h2><p className="text-sm text-muted-foreground">{instance.bill_name}</p></div>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <form onSubmit={handleSubmit(onPay)} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Paid On</Label><Input type="date" {...register('paid_on')} /></div>
            <div className="space-y-1"><Label>Amount (₹)</Label><Input type="number" {...register('amount_paid')} /></div>
          </div>
          <div className="space-y-1">
            <Label>Payment Mode</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('mode')}>
              {PAYMENT_MODES.map(m => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
            </select>
          </div>
          <div className="space-y-1"><Label>Reference / UTR (optional)</Label><Input placeholder="e.g. UPI ref no." {...register('reference')} /></div>
          <div className="flex gap-3"><Button variant="outline" type="button" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Mark Paid'}</Button></div>
        </form>
      </div>
    </div>
  )
}

// ── Bill Form Modal ───────────────────────────────────────────────────────────
function BillFormModal({ householdId, onSave, onClose }: { householdId: string; onSave: (d: BillFormValues) => Promise<void>; onClose: () => void }) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<BillFormValues>({
    resolver: zodResolver(billSchema),
    defaultValues: { type: 'electricity', recurrence: 'monthly' },
  })
  const recurrence = watch('recurrence')

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-card border rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-card z-10">
          <h2 className="font-semibold">Add Bill</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <form onSubmit={handleSubmit(d => onSave(d))} className="p-4 space-y-4">
          {/* Bill type grid */}
          <div className="space-y-2">
            <Label>Bill Type</Label>
            <div className="grid grid-cols-4 gap-2">
              {BILL_TYPES.map(t => (
                <label key={t} className="flex flex-col items-center gap-1 p-2 border rounded-xl cursor-pointer hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-all text-center">
                  <input type="radio" value={t} className="sr-only" {...register('type')} />
                  <span className="text-xl">{BILL_ICONS[t]}</span>
                  <span className="text-xs leading-tight">{BILL_LABELS[t]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1"><Label>Bill Name</Label><Input placeholder="e.g. EB Bill - Home" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}</div>
            <div className="space-y-1"><Label>Provider</Label><Input placeholder="TNEB / Jio / Airtel" {...register('provider')} /></div>
            <div className="space-y-1"><Label>Amount (₹)</Label><Input type="number" placeholder="1500" {...register('amount')} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Recurrence</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('recurrence')}>
                {RECURRENCES.map(r => <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>)}
              </select>
            </div>
            {recurrence === 'monthly' && (
              <div className="space-y-1"><Label>Due Day of Month</Label><Input type="number" min="1" max="28" placeholder="15" {...register('due_day')} /></div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" type="button" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Add Bill'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function BillsPage() {
  const { activeHousehold } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const hId = activeHousehold?.id ?? ''

  const [tab,          setTab]          = useState<'upcoming' | 'all'>('upcoming')
  const [showAddBill,  setShowAddBill]  = useState(false)
  const [payInstance,  setPayInstance]  = useState<BillInstance | null>(null)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['bills', hId] })
    qc.invalidateQueries({ queryKey: ['bills-upcoming', hId] })
    qc.invalidateQueries({ queryKey: ['bills-summary', hId] })
  }

  const { data: billsData = [], isLoading: billsLoading } = useQuery({
    queryKey: ['bills', hId],
    queryFn: () => listBills(hId),
    enabled: !!hId,
  })

  const { data: upcomingData, isLoading: upcomingLoading } = useQuery({
    queryKey: ['bills-upcoming', hId],
    queryFn: () => getUpcomingBills(hId, 30),
    enabled: !!hId,
  })

  const createMut = useMutation({
    mutationFn: (d: BillFormValues) => createBill({ household_id: hId, ...d }),
    onSuccess: () => { invalidate(); toast({ title: 'Bill added ✓' }); setShowAddBill(false) },
    onError: () => toast({ variant: 'destructive', title: 'Failed to add bill' }),
  })

  const deleteMut = useMutation({
    mutationFn: deleteBill,
    onSuccess: () => { invalidate(); toast({ title: 'Bill removed' }) },
  })

  const payMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PayFormValues }) => payBillInstance(id, data),
    onSuccess: (res) => {
      invalidate()
      toast({ title: `Paid ✓${res.nextDue ? ` · Next due: ${fmtDate(res.nextDue)}` : ''}` })
      setPayInstance(null)
    },
    onError: () => toast({ variant: 'destructive', title: 'Payment failed' }),
  })

  const upcoming    = upcomingData?.instances ?? []
  const overdueList = upcoming.filter(i => i.status === 'overdue')
  const pendingList = upcoming.filter(i => i.status === 'pending')

  if (!hId) return <div className="flex items-center justify-center h-64 text-muted-foreground">Select a household first.</div>

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Bills</h1><p className="text-sm text-muted-foreground">{activeHousehold?.name}</p></div>
        <Button size="sm" onClick={() => setShowAddBill(true)}><Plus className="w-4 h-4 mr-1" /> Add Bill</Button>
      </div>

      {/* Summary chips */}
      {upcomingData && (
        <div className="grid grid-cols-3 gap-3">
          <div className={`bg-card border rounded-xl p-3 text-center ${overdueList.length > 0 ? 'border-red-300 dark:border-red-700' : ''}`}>
            <p className={`text-2xl font-bold ${overdueList.length > 0 ? 'text-red-600' : ''}`}>{overdueList.length}</p>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </div>
          <div className="bg-card border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{pendingList.length}</p>
            <p className="text-xs text-muted-foreground">Due this month</p>
          </div>
          <div className="bg-card border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{billsData.length}</p>
            <p className="text-xs text-muted-foreground">Active bills</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border rounded-xl overflow-hidden">
        <button onClick={() => setTab('upcoming')} className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'upcoming' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
          Upcoming / Due
        </button>
        <button onClick={() => setTab('all')} className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
          All Bills
        </button>
      </div>

      {/* Upcoming tab */}
      {tab === 'upcoming' && (
        <div className="space-y-2">
          {upcomingLoading ? <div className="h-20 bg-muted animate-pulse rounded-xl" /> :
            upcoming.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
                <p className="font-medium">All caught up!</p>
                <p className="text-sm text-muted-foreground">No bills due in the next 30 days</p>
              </div>
            ) : (
              upcoming.map((inst) => {
                const days = daysUntil(inst.due_date)
                const isOverdue = inst.status === 'overdue'
                return (
                  <div key={inst.id} className={`flex items-center gap-3 bg-card border rounded-xl p-3 ${isOverdue ? 'border-red-300 dark:border-red-700' : days <= 7 ? 'border-amber-300 dark:border-amber-700' : ''}`}>
                    <span className="text-2xl shrink-0">{BILL_ICONS[inst.type]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{inst.bill_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {isOverdue
                          ? <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><AlertCircle className="w-3 h-3" />Overdue · {fmtDate(inst.due_date)}</span>
                          : <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" />Due {fmtDate(inst.due_date)} · {days}d left</span>
                        }
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {inst.amount_due && <p className="font-semibold text-sm">{fmt(inst.amount_due)}</p>}
                      <Button size="sm" variant="outline" className="mt-1 h-7 text-xs" onClick={() => setPayInstance(inst)}>
                        <CreditCard className="w-3 h-3 mr-1" /> Pay
                      </Button>
                    </div>
                  </div>
                )
              })
            )
          }
        </div>
      )}

      {/* All bills tab */}
      {tab === 'all' && (
        <div className="space-y-2">
          {billsLoading ? <div className="h-20 bg-muted animate-pulse rounded-xl" /> :
            billsData.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <FileText className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="font-medium">No bills added yet</p>
                <p className="text-sm text-muted-foreground">Add your recurring bills to track due dates</p>
                <Button size="sm" onClick={() => setShowAddBill(true)}><Plus className="w-4 h-4 mr-1" /> Add First Bill</Button>
              </div>
            ) : (
              billsData.map((bill: Bill) => (
                <div key={bill.id} className="flex items-center gap-3 bg-card border rounded-xl p-3">
                  <span className="text-2xl shrink-0">{BILL_ICONS[bill.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{bill.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {RECURRENCE_LABELS[bill.recurrence]}{bill.provider ? ` · ${bill.provider}` : ''}
                      {bill.due_day ? ` · Due on ${bill.due_day}th` : ''}
                    </p>
                    {(bill.overdue_count > 0) && <span className="text-xs text-red-600 font-medium">{bill.overdue_count} overdue</span>}
                  </div>
                  <div className="text-right shrink-0">
                    {bill.amount && <p className="font-semibold text-sm">{fmt(bill.amount)}</p>}
                    {bill.next_due && <p className="text-xs text-muted-foreground">Next: {fmtDate(bill.next_due)}</p>}
                  </div>
                  <button onClick={() => confirm(`Delete "${bill.name}"?`) && deleteMut.mutate(bill.id)} className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-lg text-muted-foreground shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )
          }
        </div>
      )}

      {/* Modals */}
      {showAddBill && (
        <BillFormModal
          householdId={hId}
          onSave={async (d) => { await createMut.mutateAsync(d) }}
          onClose={() => setShowAddBill(false)}
        />
      )}
      {payInstance && (
        <PayModal
          instance={payInstance}
          onPay={async (data) => { await payMut.mutateAsync({ id: payInstance.id, data }) }}
          onClose={() => setPayInstance(null)}
        />
      )}
    </div>
  )
}

