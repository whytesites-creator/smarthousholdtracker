import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { changePasswordSchema, type ChangePasswordInput } from '../schemas/auth.schema'
import { changePassword } from '../services/auth.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

export function ChangePasswordPage() {
  const { toast } = useToast()
  const [show, setShow] = useState({ current: false, next: false, confirm: false })
  const [done, setDone] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) })

  const onSubmit = async (values: ChangePasswordInput) => {
    try {
      await changePassword(values)
      setDone(true)
      reset()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not change password.'
      toast({ variant: 'destructive', title: 'Error', description: message })
    }
  }

  const toggle = (field: keyof typeof show) => setShow((s) => ({ ...s, [field]: !s[field] }))

  return (
    <div className="max-w-md mx-auto mt-8 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your account password.</CardDescription>
        </CardHeader>

        {done ? (
          <CardContent className="text-center py-8 flex flex-col items-center gap-3">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
            <p className="font-medium">Password changed successfully!</p>
            <Button variant="outline" onClick={() => setDone(false)}>
              Change again
            </Button>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={show.current ? 'text' : 'password'}
                    autoComplete="current-password"
                    {...register('currentPassword')}
                  />
                  <button type="button" onClick={() => toggle('current')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {show.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.currentPassword && <p className="text-xs text-destructive">{errors.currentPassword.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={show.next ? 'text' : 'password'}
                    autoComplete="new-password"
                    {...register('newPassword')}
                  />
                  <button type="button" onClick={() => toggle('next')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {show.next ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmNewPassword"
                    type={show.confirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    {...register('confirmNewPassword')}
                  />
                  <button type="button" onClick={() => toggle('confirm')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {show.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmNewPassword && (
                  <p className="text-xs text-destructive">{errors.confirmNewPassword.message}</p>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? 'Updating…' : 'Update Password'}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  )
}

