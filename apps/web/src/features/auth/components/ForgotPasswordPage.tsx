import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { MailCheck, Home } from 'lucide-react'
import { forgotPasswordSchema, type ForgotPasswordInput } from '../schemas/auth.schema'
import { sendForgotPasswordEmail } from '../services/auth.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

export function ForgotPasswordPage() {
  const { toast } = useToast()
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) })

  const onSubmit = async (values: ForgotPasswordInput) => {
    try {
      await sendForgotPasswordEmail(values)
      setSent(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      toast({ variant: 'destructive', title: 'Error', description: message })
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-2">
                <MailCheck className="w-12 h-12 text-primary" />
              </div>
              <CardTitle>Check your inbox</CardTitle>
              <CardDescription>
                We sent a password reset link to{' '}
                <span className="font-medium text-foreground">{getValues('email')}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground text-center">
              Didn't receive it? Check your spam folder or{' '}
              <button
                onClick={() => setSent(false)}
                className="text-primary hover:underline"
              >
                try again
              </button>
              .
            </CardContent>
            <CardFooter>
              <Link to="/login" className="w-full">
                <Button variant="outline" className="w-full">
                  Back to login
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary">
            <Home className="text-primary-foreground w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Smart Household Tracker</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Forgot password?</CardTitle>
            <CardDescription>
              Enter your email and we'll send you a reset link.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Sending…' : 'Send Reset Link'}
              </Button>
              <Link to="/login" className="text-sm text-primary hover:underline">
                Back to login
              </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}

