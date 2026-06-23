import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, FolderLock, X, Search, Calendar, AlertTriangle, Pencil } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/use-auth-context'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  listDocuments, createDocument, updateDocument, deleteDocument, getExpiringDocuments,
  DOC_CATEGORIES, CATEGORY_LABELS, CATEGORY_ICONS,
  type Document, type DocCategory,
} from '../services/documents.service'

// ── Schema ────────────────────────────────────────────────────────────────────
const docSchema = z.object({
  title:       z.string().min(1).max(100),
  category:    z.enum(DOC_CATEGORIES),
  member_name: z.string().max(80).optional(),
  doc_number:  z.string().max(60).optional(),
  issue_date:  z.string().optional(),
  expiry_date: z.string().optional(),
  file_url:    z.string().url().optional().or(z.literal('')),
  notes:       z.string().max(500).optional(),
})
type DocForm = z.infer<typeof docSchema>

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
function daysUntil(dateStr?: string) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}
function expiryBadge(dateStr?: string) {
  const days = daysUntil(dateStr)
  if (days === null) return null
  if (days < 0) return { text: 'Expired', cls: 'text-red-600 bg-red-100 dark:bg-red-950' }
  if (days <= 90) return { text: `${days}d left`, cls: 'text-amber-600 bg-amber-100 dark:bg-amber-950' }
  return { text: `${days}d left`, cls: 'text-green-600 bg-green-100 dark:bg-green-950' }
}

// ── Document Form Modal ───────────────────────────────────────────────────────
function DocFormModal({ initialData, onSave, onClose }: {
  initialData?: Partial<DocForm>
  onSave: (d: DocForm) => Promise<void>; onClose: () => void
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<DocForm>({
    resolver: zodResolver(docSchema),
    defaultValues: initialData ?? { category: 'aadhaar' },
  })
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-card border rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-card z-10">
          <h2 className="font-semibold">{initialData ? 'Edit Document' : 'Add Document'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <form onSubmit={handleSubmit(onSave)} className="p-4 space-y-4">
          {/* Category grid */}
          <div className="space-y-2">
            <Label>Category</Label>
            <div className="grid grid-cols-5 gap-2">
              {DOC_CATEGORIES.map(cat => (
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
              <Label>Title *</Label>
              <Input placeholder="e.g. Bala's Aadhaar" {...register('title')} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="space-y-1"><Label>Member Name</Label><Input placeholder="Bala / Family" {...register('member_name')} /></div>
            <div className="space-y-1"><Label>Document No.</Label><Input placeholder="XXXX XXXX XXXX" {...register('doc_number')} /></div>
            <div className="space-y-1"><Label>Issue Date</Label><Input type="date" {...register('issue_date')} /></div>
            <div className="space-y-1"><Label>Expiry Date</Label><Input type="date" {...register('expiry_date')} /></div>
            <div className="col-span-2 space-y-1">
              <Label>File URL (optional)</Label>
              <Input placeholder="https://drive.google.com/…" {...register('file_url')} />
            </div>
            <div className="col-span-2 space-y-1"><Label>Notes</Label><Input placeholder="Any additional notes…" {...register('notes')} /></div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" type="button" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : initialData ? 'Update' : 'Add Document'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function DocumentsPage() {
  const { activeHousehold } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const hId = activeHousehold?.id ?? ''

  const [search, setSearch]         = useState('')
  const [catFilter, setCatFilter]   = useState<DocCategory | 'all'>('all')
  const [showAdd, setShowAdd]       = useState(false)
  const [editDoc, setEditDoc]       = useState<Document | null>(null)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['documents', hId] })

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents', hId],
    queryFn:  () => listDocuments(hId),
    enabled:  !!hId,
  })

  const { data: expiring = [] } = useQuery({
    queryKey: ['documents-expiring', hId],
    queryFn:  () => getExpiringDocuments(hId, 90),
    enabled:  !!hId,
  })

  const createMut = useMutation({
    mutationFn: (d: DocForm) => createDocument({ household_id: hId, ...d }),
    onSuccess: () => { invalidate(); toast({ title: 'Document added ✓' }); setShowAdd(false) },
    onError: () => toast({ variant: 'destructive', title: 'Failed to add document' }),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: DocForm }) => updateDocument(id, data),
    onSuccess: () => { invalidate(); toast({ title: 'Document updated ✓' }); setEditDoc(null) },
    onError: () => toast({ variant: 'destructive', title: 'Failed to update document' }),
  })

  const deleteMut = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => { invalidate(); toast({ title: 'Document removed' }) },
  })

  const filtered = documents.filter(d => {
    if (catFilter !== 'all' && d.category !== catFilter) return false
    if (search && !d.title.toLowerCase().includes(search.toLowerCase()) && !(d.member_name ?? '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (!hId) return <div className="flex items-center justify-center h-64 text-muted-foreground">Select a household first.</div>

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><FolderLock className="w-5 h-5 text-indigo-500" /> Document Vault</h1>
          <p className="text-sm text-muted-foreground">{activeHousehold?.name}</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1" /> Add Document</Button>
      </div>

      {/* Expiring alert */}
      {expiring.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">{expiring.length} document{expiring.length > 1 ? 's' : ''} expiring in 90 days</p>
            <p className="text-xs text-amber-700 dark:text-amber-300">{expiring.map(d => d.title).join(', ')}</p>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold">{documents.length}</p>
          <p className="text-xs text-muted-foreground">Total Docs</p>
        </div>
        <div className={`bg-card border rounded-xl p-3 text-center ${expiring.filter(d => daysUntil(d.expiry_date)! < 0).length > 0 ? 'border-red-300 dark:border-red-700' : ''}`}>
          <p className="text-2xl font-bold text-red-600">{expiring.filter(d => daysUntil(d.expiry_date)! < 0).length}</p>
          <p className="text-xs text-muted-foreground">Expired</p>
        </div>
        <div className={`bg-card border rounded-xl p-3 text-center ${expiring.filter(d => daysUntil(d.expiry_date)! >= 0).length > 0 ? 'border-amber-300 dark:border-amber-700' : ''}`}>
          <p className="text-2xl font-bold text-amber-600">{expiring.filter(d => daysUntil(d.expiry_date)! >= 0).length}</p>
          <p className="text-xs text-muted-foreground">Expiring Soon</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search documents…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setCatFilter('all')} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${catFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}>
          All
        </button>
        {DOC_CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setCatFilter(cat)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${catFilter === cat ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}>
            {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Document list */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <FolderLock className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="font-medium">{search || catFilter !== 'all' ? 'No matching documents' : 'No documents added yet'}</p>
          {!search && catFilter === 'all' && (
            <>
              <p className="text-sm text-muted-foreground">Store Aadhaar, PAN, insurance & more</p>
              <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1" /> Add First Document</Button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => {
            const badge = expiryBadge(doc.expiry_date)
            return (
              <div key={doc.id} className={`flex items-center gap-3 bg-card border rounded-xl p-3 ${badge && daysUntil(doc.expiry_date)! <= 0 ? 'border-red-300 dark:border-red-700' : badge && daysUntil(doc.expiry_date)! <= 90 ? 'border-amber-300 dark:border-amber-700' : ''}`}>
                <span className="text-2xl shrink-0">{CATEGORY_ICONS[doc.category]}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{doc.title}</p>
                  <div className="flex flex-wrap items-center gap-x-2 mt-0.5">
                    {doc.member_name && <span className="text-xs text-muted-foreground">{doc.member_name}</span>}
                    {doc.doc_number && <span className="text-xs text-muted-foreground font-mono">{doc.doc_number}</span>}
                    {doc.expiry_date && badge && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1 ${badge.cls}`}>
                        <Calendar className="w-3 h-3" /> Expires {fmtDate(doc.expiry_date)} · {badge.text}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {doc.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-accent rounded-lg text-primary text-xs font-medium">View</a>
                  )}
                  <button onClick={() => setEditDoc(doc)} className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => confirm(`Delete "${doc.title}"?`) && deleteMut.mutate(doc.id)} className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-lg text-muted-foreground">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {showAdd && (
        <DocFormModal onSave={async (d) => { await createMut.mutateAsync(d) }} onClose={() => setShowAdd(false)} />
      )}
      {editDoc && (
        <DocFormModal
          initialData={editDoc}
          onSave={async (d) => { await updateMut.mutateAsync({ id: editDoc.id, data: d }) }}
          onClose={() => setEditDoc(null)}
        />
      )}
    </div>
  )
}

