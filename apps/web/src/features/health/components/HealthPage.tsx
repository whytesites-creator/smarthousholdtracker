import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, HeartPulse, X, CheckCircle2, Clock, Users } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/use-auth-context'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  listHealthMembers, createHealthMember, deleteHealthMember,
  listReminders, createReminder, deleteReminder, completeReminder,
  RELATIONS, RELATION_LABELS, REMINDER_TYPES, REMINDER_TYPE_LABELS, REMINDER_TYPE_ICONS,
  RECURRENCES, RECURRENCE_LABELS,
  type HealthMember, type HealthReminder,
} from '../services/health.service'

// ── Schemas ───────────────────────────────────────────────────────────────────
const memberSchema = z.object({
  name:        z.string().min(1).max(80),
  dob:         z.string().optional(),
  relation:    z.enum(RELATIONS),
  blood_group: z.string().max(5).optional(),
})
type MemberForm = z.infer<typeof memberSchema>

const reminderSchema = z.object({
  member_id:  z.string().optional(),
  type:       z.enum(REMINDER_TYPES),
  title:      z.string().min(1).max(200),
  due_date:   z.string().min(1, 'Date required'),
  recurrence: z.enum(RECURRENCES).default('none'),
  notes:      z.string().max(500).optional(),
})
type ReminderFormData = z.infer<typeof reminderSchema>

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

// ── Add Member Modal ──────────────────────────────────────────────────────────
function MemberModal({ householdId, onSave, onClose }: { householdId: string; onSave: (d: MemberForm) => Promise<void>; onClose: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<MemberForm>({
    resolver: zodResolver(memberSchema),
    defaultValues: { relation: 'self' },
  })
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-card border rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">Add Family Member</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <form onSubmit={handleSubmit(onSave)} className="p-4 space-y-3">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input placeholder="e.g. Bala, Amma" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Relation</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('relation')}>
                {RELATIONS.map(r => <option key={r} value={r}>{RELATION_LABELS[r]}</option>)}
              </select>
            </div>
            <div className="space-y-1"><Label>Blood Group</Label><Input placeholder="O+" {...register('blood_group')} /></div>
            <div className="col-span-2 space-y-1"><Label>Date of Birth</Label><Input type="date" {...register('dob')} /></div>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" type="button" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Add Member'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Add Reminder Modal ────────────────────────────────────────────────────────
function ReminderModal({ householdId, members, onSave, onClose }: {
  householdId: string; members: HealthMember[]
  onSave: (d: ReminderFormData) => Promise<void>; onClose: () => void
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ReminderFormData>({
    resolver: zodResolver(reminderSchema),
    defaultValues: { type: 'medicine', recurrence: 'none', due_date: new Date().toISOString().split('T')[0] },
  })
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-card border rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-card z-10">
          <h2 className="font-semibold">Add Health Reminder</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <form onSubmit={handleSubmit(onSave)} className="p-4 space-y-4">
          {/* Type selector */}
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="grid grid-cols-5 gap-2">
              {REMINDER_TYPES.map(t => (
                <label key={t} className="flex flex-col items-center gap-1 p-2 border rounded-xl cursor-pointer hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-all text-center">
                  <input type="radio" value={t} className="sr-only" {...register('type')} />
                  <span className="text-xl">{REMINDER_TYPE_ICONS[t]}</span>
                  <span className="text-xs">{REMINDER_TYPE_LABELS[t].split(' ')[0]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Title *</Label>
            <Input placeholder="e.g. BP Medicine, Flu Vaccine, Annual Checkup" {...register('title')} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>For Member</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('member_id')}>
                <option value="">All / General</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Recurrence</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('recurrence')}>
                {RECURRENCES.map(r => <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>)}
              </select>
            </div>
            <div className="col-span-2 space-y-1"><Label>Due Date *</Label><Input type="date" {...register('due_date')} />
              {errors.due_date && <p className="text-xs text-destructive">{errors.due_date.message}</p>}
            </div>
            <div className="col-span-2 space-y-1"><Label>Notes</Label><Input placeholder="Dosage, doctor name…" {...register('notes')} /></div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" type="button" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Add Reminder'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function HealthPage() {
  const { activeHousehold } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const hId = activeHousehold?.id ?? ''

  const [tab, setTab] = useState<'pending' | 'done' | 'members'>('pending')
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [showReminderModal, setShowReminderModal] = useState(false)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['health-reminders', hId] })
    qc.invalidateQueries({ queryKey: ['health-members', hId] })
  }

  const { data: members = [] } = useQuery({
    queryKey: ['health-members', hId],
    queryFn:  () => listHealthMembers(hId),
    enabled:  !!hId,
  })

  const { data: pendingReminders = [], isLoading: loadingPending } = useQuery({
    queryKey: ['health-reminders', hId, 'pending'],
    queryFn:  () => listReminders(hId, 'pending'),
    enabled:  !!hId,
  })

  const { data: doneReminders = [], isLoading: loadingDone } = useQuery({
    queryKey: ['health-reminders', hId, 'done'],
    queryFn:  () => listReminders(hId, 'done'),
    enabled:  !!hId && tab === 'done',
  })

  const addMemberMut = useMutation({
    mutationFn: (d: MemberForm) => createHealthMember({ household_id: hId, ...d }),
    onSuccess: () => { invalidate(); toast({ title: 'Member added ✓' }); setShowMemberModal(false) },
    onError: () => toast({ variant: 'destructive', title: 'Failed to add member' }),
  })

  const addReminderMut = useMutation({
    mutationFn: (d: ReminderFormData) => createReminder({ household_id: hId, ...d }),
    onSuccess: () => { invalidate(); toast({ title: 'Reminder added ✓' }); setShowReminderModal(false) },
    onError: () => toast({ variant: 'destructive', title: 'Failed to add reminder' }),
  })

  const completeMut = useMutation({
    mutationFn: completeReminder,
    onSuccess: (res) => {
      invalidate()
      toast({ title: res.nextReminder ? `Done ✓ · Next: ${fmtDate(res.nextReminder.due_date)}` : 'Marked done ✓' })
    },
    onError: () => toast({ variant: 'destructive', title: 'Failed to update' }),
  })

  const deleteMut = useMutation({
    mutationFn: deleteReminder,
    onSuccess: () => { invalidate(); toast({ title: 'Reminder removed' }) },
  })

  const deleteMemberMut = useMutation({
    mutationFn: deleteHealthMember,
    onSuccess: () => { invalidate(); toast({ title: 'Member removed' }) },
  })

  const overdueCount = pendingReminders.filter(r => daysUntil(r.due_date) < 0).length

  if (!hId) return <div className="flex items-center justify-center h-64 text-muted-foreground">Select a household first.</div>

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><HeartPulse className="w-5 h-5 text-rose-500" /> Health</h1>
          <p className="text-sm text-muted-foreground">{activeHousehold?.name}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowMemberModal(true)}>
            <Users className="w-4 h-4 mr-1" /> Member
          </Button>
          <Button size="sm" onClick={() => setShowReminderModal(true)}>
            <Plus className="w-4 h-4 mr-1" /> Reminder
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`bg-card border rounded-xl p-3 text-center ${overdueCount > 0 ? 'border-red-300 dark:border-red-700' : ''}`}>
          <p className={`text-2xl font-bold ${overdueCount > 0 ? 'text-red-600' : ''}`}>{overdueCount}</p>
          <p className="text-xs text-muted-foreground">Overdue</p>
        </div>
        <div className="bg-card border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold">{pendingReminders.length}</p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </div>
        <div className="bg-card border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold">{members.length}</p>
          <p className="text-xs text-muted-foreground">Members</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border rounded-xl overflow-hidden">
        {(['pending', 'done', 'members'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
            {t === 'pending' ? 'Pending' : t === 'done' ? 'Done' : 'Members'}
          </button>
        ))}
      </div>

      {/* Pending reminders */}
      {tab === 'pending' && (
        <div className="space-y-2">
          {loadingPending ? <div className="h-20 bg-muted animate-pulse rounded-xl" /> :
            pendingReminders.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
                <p className="font-medium">All caught up!</p>
                <p className="text-sm text-muted-foreground">No pending health reminders</p>
                <Button size="sm" onClick={() => setShowReminderModal(true)}><Plus className="w-4 h-4 mr-1" /> Add Reminder</Button>
              </div>
            ) : (
              pendingReminders.map((r: HealthReminder) => {
                const days = daysUntil(r.due_date)
                const isOverdue = days < 0
                return (
                  <div key={r.id} className={`flex items-center gap-3 bg-card border rounded-xl p-3 ${isOverdue ? 'border-red-300 dark:border-red-700' : days <= 7 ? 'border-amber-300 dark:border-amber-700' : ''}`}>
                    <span className="text-2xl shrink-0">{REMINDER_TYPE_ICONS[r.type]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{r.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`flex items-center gap-1 text-xs font-medium ${isOverdue ? 'text-red-600' : days <= 7 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          <Clock className="w-3 h-3" />{isOverdue ? `Overdue · ` : 'Due '}{fmtDate(r.due_date)}
                        </span>
                        {r.member_name && <span className="text-xs text-muted-foreground">· {r.member_name}</span>}
                        {r.recurrence !== 'none' && <span className="text-xs text-primary">{RECURRENCE_LABELS[r.recurrence]}</span>}
                      </div>
                      {r.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.notes}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => completeMut.mutate(r.id)}>
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Done
                      </Button>
                      <button onClick={() => confirm('Delete this reminder?') && deleteMut.mutate(r.id)} className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-lg text-muted-foreground">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })
            )
          }
        </div>
      )}

      {/* Done reminders */}
      {tab === 'done' && (
        <div className="space-y-2">
          {loadingDone ? <div className="h-20 bg-muted animate-pulse rounded-xl" /> :
            doneReminders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No completed reminders yet.</div>
            ) : (
              doneReminders.map((r: HealthReminder) => (
                <div key={r.id} className="flex items-center gap-3 bg-card border rounded-xl p-3 opacity-70">
                  <span className="text-2xl shrink-0">{REMINDER_TYPE_ICONS[r.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate line-through">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(r.due_date)}{r.member_name ? ` · ${r.member_name}` : ''}</p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                </div>
              ))
            )
          }
        </div>
      )}

      {/* Members */}
      {tab === 'members' && (
        <div className="space-y-2">
          {members.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Users className="w-10 h-10 text-muted-foreground mx-auto" />
              <p className="font-medium">No family members added</p>
              <Button size="sm" onClick={() => setShowMemberModal(true)}><Plus className="w-4 h-4 mr-1" /> Add Member</Button>
            </div>
          ) : (
            members.map((m: HealthMember) => (
              <div key={m.id} className="flex items-center gap-3 bg-card border rounded-xl p-3">
                <div className="w-9 h-9 rounded-full bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-sm font-bold text-rose-600 shrink-0">
                  {m.name[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{m.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {RELATION_LABELS[m.relation]}{m.blood_group ? ` · ${m.blood_group}` : ''}{m.dob ? ` · DOB: ${fmtDate(m.dob)}` : ''}
                  </p>
                </div>
                {m.pending_reminders > 0 && (
                  <span className="text-xs font-medium text-amber-600 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded-full shrink-0">
                    {m.pending_reminders} pending
                  </span>
                )}
                <button onClick={() => confirm(`Remove "${m.name}"?`) && deleteMemberMut.mutate(m.id)} className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-lg text-muted-foreground shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modals */}
      {showMemberModal && (
        <MemberModal householdId={hId} onSave={async (d) => { await addMemberMut.mutateAsync(d) }} onClose={() => setShowMemberModal(false)} />
      )}
      {showReminderModal && (
        <ReminderModal householdId={hId} members={members} onSave={async (d) => { await addReminderMut.mutateAsync(d) }} onClose={() => setShowReminderModal(false)} />
      )}
    </div>
  )
}

