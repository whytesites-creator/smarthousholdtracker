import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronDown, Plus, Users } from 'lucide-react'
import { useAuth } from '../hooks/use-auth-context'
import { createHousehold, switchHousehold } from '../services/auth.service'
import { createHouseholdSchema, type CreateHouseholdInput } from '../schemas/auth.schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import type { Household } from '../services/auth.service'

export function HouseholdSwitcher() {
  const { households, activeHousehold, setActiveHousehold, refreshHouseholds } = useAuth()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateHouseholdInput>({ resolver: zodResolver(createHouseholdSchema) })

  const handleSwitch = async (h: Household) => {
    try {
      await switchHousehold(h.id)
      setActiveHousehold(h)
      setOpen(false)
      toast({ title: `Switched to ${h.name}` })
    } catch {
      toast({ variant: 'destructive', title: 'Failed to switch household' })
    }
  }

  const onCreateHousehold = async (values: CreateHouseholdInput) => {
    try {
      await createHousehold(values)
      await refreshHouseholds()
      reset()
      setShowCreate(false)
      toast({ title: 'Household created!', description: `"${values.name}" is ready.` })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not create household.'
      toast({ variant: 'destructive', title: 'Error', description: message })
    }
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 max-w-xs"
      >
        <Users className="w-4 h-4 shrink-0" />
        <span className="truncate">{activeHousehold?.name ?? 'Select Household'}</span>
        <ChevronDown className="w-3 h-3 shrink-0 ml-auto" />
      </Button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-64 bg-popover border rounded-md shadow-lg py-1">
          {households.map((h) => (
            <button
              key={h.id}
              onClick={() => handleSwitch(h)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
            >
              {activeHousehold?.id === h.id && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
              {activeHousehold?.id !== h.id && <span className="w-3.5" />}
              <span className="truncate">{h.name}</span>
              <span className="ml-auto text-xs text-muted-foreground capitalize">{h.role}</span>
            </button>
          ))}

          <div className="border-t mt-1 pt-1">
            <button
              onClick={() => { setShowCreate(true); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-primary"
            >
              <Plus className="w-3.5 h-3.5" />
              Create new household
            </button>
          </div>
        </div>
      )}

      {/* Create Household Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Create Household</CardTitle>
              <CardDescription>Set up a new household to manage.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit(onCreateHousehold)}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="hh-name">Household Name</Label>
                  <Input id="hh-name" placeholder="e.g. Ravi's Home" {...register('name')} />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hh-timezone">Timezone</Label>
                  <Input id="hh-timezone" defaultValue="Asia/Kolkata" {...register('timezone')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hh-currency">Currency</Label>
                  <Input id="hh-currency" defaultValue="INR" {...register('currency')} />
                </div>
              </CardContent>
              <CardFooter className="flex gap-3 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating…' : 'Create'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}

