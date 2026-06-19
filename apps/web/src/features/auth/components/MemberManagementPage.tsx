import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus, Trash2, Shield, User, Eye } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/use-auth-context'
import {
  getHouseholdMembers,
  inviteMember,
  removeMember,
  updateMemberRole,
} from '../services/auth.service'
import { inviteMemberSchema, type InviteMemberInput } from '../schemas/auth.schema'
import type { HouseholdMember } from '../services/auth.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

const ROLE_ICONS = {
  owner: Shield,
  admin: Shield,
  member: User,
  viewer: Eye,
}

const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
}

export function MemberManagementPage() {
  const { activeHousehold, user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showInvite, setShowInvite] = useState(false)

  const householdId = activeHousehold?.id ?? ''

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['household-members', householdId],
    queryFn: () => getHouseholdMembers(householdId),
    enabled: !!householdId,
  })

  const inviteMutation = useMutation({
    mutationFn: (data: InviteMemberInput) => inviteMember(householdId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household-members', householdId] })
      toast({ title: 'Invitation sent!' })
      setShowInvite(false)
      reset()
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to invite.'
      toast({ variant: 'destructive', title: 'Error', description: message })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeMember(householdId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household-members', householdId] })
      toast({ title: 'Member removed' })
    },
  })

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'admin' | 'member' | 'viewer' }) =>
      updateMemberRole(householdId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household-members', householdId] })
      toast({ title: 'Role updated' })
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { role: 'member' },
  })

  const myRole = activeHousehold?.role
  const canManage = myRole === 'owner' || myRole === 'admin'

  if (!activeHousehold) {
    return (
      <div className="max-w-2xl mx-auto mt-8 p-4 text-center text-muted-foreground">
        No household selected.
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Members</h2>
          <p className="text-sm text-muted-foreground">{activeHousehold.name}</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setShowInvite(true)}>
            <UserPlus className="w-4 h-4 mr-1" /> Invite
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading members…</p>
      ) : (
        <div className="space-y-2">
          {members.map((m: HouseholdMember) => {
            const RoleIcon = ROLE_ICONS[m.role]
            const isMe = m.user_id === user?.id
            return (
              <div
                key={m.user_id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary font-medium shrink-0">
                  {m.name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {m.name} {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {m.status === 'invited' && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 px-2 py-0.5 rounded-full">
                      Invited
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <RoleIcon className="w-3.5 h-3.5" />
                    {ROLE_LABELS[m.role]}
                  </span>
                  {canManage && m.role !== 'owner' && !isMe && (
                    <div className="flex items-center gap-1">
                      <select
                        className="text-xs border rounded px-1 py-0.5 bg-background"
                        value={m.role}
                        onChange={(e) =>
                          roleMutation.mutate({
                            userId: m.user_id,
                            role: e.target.value as 'admin' | 'member' | 'viewer',
                          })
                        }
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${m.name} from this household?`))
                            removeMutation.mutate(m.user_id)
                        }}
                        className="text-destructive hover:text-destructive/80 p-1"
                        aria-label="Remove member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-sm mx-4">
            <CardHeader>
              <CardTitle>Invite Member</CardTitle>
              <CardDescription>
                They'll receive an email invitation to join{' '}
                <span className="font-medium">{activeHousehold.name}</span>.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit((v) => inviteMutation.mutate(v))}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="inv-email">Email</Label>
                  <Input id="inv-email" type="email" placeholder="family@example.com" {...register('email')} />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-role">Role</Label>
                  <select
                    id="inv-role"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    {...register('role')}
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </CardContent>
              <CardFooter className="flex gap-3 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowInvite(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? 'Sending…' : 'Send Invite'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}

