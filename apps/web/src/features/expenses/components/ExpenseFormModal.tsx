import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  EXPENSE_CATEGORIES, CATEGORY_LABELS, CATEGORY_ICONS,
  type Expense, type CreateExpenseInput,
} from '../services/expense.service'

const schema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount:   z.coerce.number().positive('Amount must be positive'),
  note:     z.string().max(200).optional(),
  spent_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date'),
})
type FormValues = z.infer<typeof schema>

interface Props {
  householdId: string
  expense?: Expense | null
  onSave: (data: CreateExpenseInput) => Promise<void>
  onClose: () => void
}

export function ExpenseFormModal({ householdId, expense, onSave, onClose }: Props) {
  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: 'groceries',
      amount:   undefined,
      note:     '',
      spent_on: new Date().toISOString().split('T')[0],
    },
  })

  useEffect(() => {
    if (expense) {
      reset({
        category: expense.category,
        amount:   expense.amount,
        note:     expense.note ?? '',
        spent_on: expense.spent_on,
      })
    }
  }, [expense, reset])

  const onSubmit = async (values: FormValues) => {
    await onSave({ ...values, household_id: householdId })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-card border rounded-2xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">{expense ? 'Edit Expense' : 'Add Expense'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <div className="grid grid-cols-3 gap-2">
              {EXPENSE_CATEGORIES.map((cat) => {
                const input = register('category')
                return (
                  <label
                    key={cat}
                    className="flex flex-col items-center gap-1 p-2 border rounded-lg cursor-pointer hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-colors"
                  >
                    <input type="radio" value={cat} className="sr-only" {...input} />
                    <span className="text-xl">{CATEGORY_ICONS[cat]}</span>
                    <span className="text-xs text-center leading-tight">{CATEGORY_LABELS[cat]}</span>
                  </label>
                )
              })}
            </div>
            {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (₹)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="pl-7"
                {...register('amount')}
              />
            </div>
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="spent_on">Date</Label>
            <Input id="spent_on" type="date" {...register('spent_on')} />
            {errors.spent_on && <p className="text-xs text-destructive">{errors.spent_on.message}</p>}
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Input id="note" placeholder="e.g. Big Bazaar monthly stock" {...register('note')} />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : expense ? 'Save Changes' : 'Add Expense'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

