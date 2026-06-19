import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { acceptInvite } from '../services/auth.service'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '../hooks/use-auth-context'

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { isAuthenticated, refreshHouseholds } = useAuth()

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      toast({ variant: 'destructive', title: 'Invalid invite link' })
      navigate('/login')
      return
    }

    if (!isAuthenticated) {
      // Save token and redirect to login, come back after login
      sessionStorage.setItem('pendingInviteToken', token)
      navigate('/login')
      return
    }

    acceptInvite(token)
      .then(async () => {
        await refreshHouseholds()
        toast({ title: 'You joined the household!' })
        navigate('/dashboard')
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Invite may be expired or already used.'
        toast({ variant: 'destructive', title: 'Invite error', description: message })
        navigate('/dashboard')
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">Processing invite…</p>
    </div>
  )
}

