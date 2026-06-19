import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { User, Phone, Globe } from 'lucide-react'
import { profileUpdateSchema, type ProfileUpdateInput } from '../schemas/auth.schema'
import { updateProfile } from '../services/auth.service'
import { useAuth } from '../hooks/use-auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

export function ProfilePage() {
  const { profile, refreshProfile } = useAuth()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: { name: '', phone: '', timezone: 'Asia/Kolkata' },
  })

  useEffect(() => {
    if (profile) {
      reset({
        name: profile.name,
        phone: profile.phone ?? '',
        timezone: profile.timezone ?? 'Asia/Kolkata',
      })
    }
  }, [profile, reset])

  const onSubmit = async (values: ProfileUpdateInput) => {
    try {
      await updateProfile(values)
      await refreshProfile()
      toast({ title: 'Profile updated', description: 'Your details have been saved.' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Update failed.'
      toast({ variant: 'destructive', title: 'Error', description: message })
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-8 p-4 space-y-4">
      {/* Avatar display */}
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary text-primary-foreground text-2xl font-semibold">
          {profile?.name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div>
          <p className="font-semibold text-lg">{profile?.name}</p>
          <p className="text-sm text-muted-foreground">{profile?.email}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
          <CardDescription>Update your personal information.</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Full Name
                </span>
              </Label>
              <Input id="name" placeholder="Your name" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Mobile Number
                </span>
              </Label>
              <Input id="phone" type="tel" placeholder="+91 98765 43210" {...register('phone')} />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Timezone
                </span>
              </Label>
              <Input id="timezone" placeholder="Asia/Kolkata" {...register('timezone')} />
            </div>
          </CardContent>

          <CardFooter className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => reset()}
              disabled={!isDirty || isSubmitting}
            >
              Discard
            </Button>
            <Button type="submit" disabled={!isDirty || isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save Changes'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

