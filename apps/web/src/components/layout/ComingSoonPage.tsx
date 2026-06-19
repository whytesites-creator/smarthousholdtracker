import { useNavigate } from 'react-router-dom'
import { Construction, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ComingSoonPageProps {
  title: string
  description: string
  icon: React.ElementType
}

export function ComingSoonPage({ title, description, icon: Icon }: ComingSoonPageProps) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
        <Icon className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted-foreground mt-2 max-w-sm">{description}</p>
      <div className="flex items-center gap-2 mt-4 px-4 py-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
        <Construction className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="text-sm text-amber-700 dark:text-amber-300">
          This module is coming soon in the next update.
        </p>
      </div>
      <Button variant="outline" className="mt-6" onClick={() => navigate('/dashboard')}>
        <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
      </Button>
    </div>
  )
}

