import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, RefreshCw, Inbox } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/use-auth-context'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import {
  listNotifications, markRead, markAllRead, generateNotifications,
  TYPE_ICONS, TYPE_LABELS,
  type Notification,
} from '../services/notifications.service'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function NotificationsPage() {
  const { activeHousehold } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const hId = activeHousehold?.id ?? ''

  const invalidate = () => qc.invalidateQueries({ queryKey: ['notifications', hId] })

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', hId],
    queryFn:  () => listNotifications(hId),
    enabled:  !!hId,
  })

  const notifications = data?.notifications ?? []
  const unreadCount   = data?.unreadCount ?? 0

  const markReadMut = useMutation({
    mutationFn: markRead,
    onSuccess:  () => invalidate(),
  })

  const markAllMut = useMutation({
    mutationFn: () => markAllRead(hId),
    onSuccess:  () => { invalidate(); toast({ title: 'All notifications marked as read' }) },
  })

  const generateMut = useMutation({
    mutationFn: () => generateNotifications(hId),
    onSuccess:  (res) => {
      invalidate()
      toast({ title: res.generated > 0 ? `${res.generated} new notification${res.generated > 1 ? 's' : ''} generated` : 'All up to date!' })
    },
    onError: () => toast({ variant: 'destructive', title: 'Failed to generate notifications' }),
  })

  if (!hId) return <div className="flex items-center justify-center h-64 text-muted-foreground">Select a household first.</div>

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Bell className="w-5 h-5 text-rose-500" /> Notifications
            {unreadCount > 0 && (
              <span className="text-xs font-bold bg-primary text-primary-foreground rounded-full px-2 py-0.5">{unreadCount}</span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">{activeHousehold?.name}</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm" variant="outline"
            onClick={() => generateMut.mutate()}
            disabled={generateMut.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${generateMut.isPending ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button size="sm" variant="outline" onClick={() => markAllMut.mutate()} disabled={markAllMut.isPending}>
              <CheckCheck className="w-4 h-4 mr-1" /> Mark All Read
            </Button>
          )}
        </div>
      </div>

      {/* Notification list */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <Inbox className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="font-medium">No notifications yet</p>
          <p className="text-sm text-muted-foreground">Click "Refresh" to generate alerts based on your data</p>
          <Button size="sm" onClick={() => generateMut.mutate()} disabled={generateMut.isPending}>
            <RefreshCw className="w-4 h-4 mr-1" /> Generate Notifications
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n: Notification) => (
            <button
              key={n.id}
              className={`w-full flex items-start gap-3 rounded-xl p-4 text-left border transition-colors ${n.is_read ? 'bg-card opacity-70' : 'bg-card border-primary/30 hover:border-primary/60'}`}
              onClick={() => !n.is_read && markReadMut.mutate(n.id)}
            >
              <span className="text-2xl shrink-0 mt-0.5">{TYPE_ICONS[n.type]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-semibold truncate ${!n.is_read ? '' : 'text-muted-foreground'}`}>{n.title}</p>
                  <span className="text-xs text-muted-foreground shrink-0">{timeAgo(n.created_at)}</span>
                </div>
                {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                <span className="text-xs text-primary mt-1 inline-block">{TYPE_LABELS[n.type]}</span>
              </div>
              {!n.is_read && (
                <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Tip */}
      <div className="border rounded-xl p-4 bg-muted/30 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">💡 How notifications work</p>
        <p>Smart alerts are generated based on your bills, vehicles, appliances, health reminders, and documents. Click "Refresh" to generate new notifications anytime.</p>
      </div>
    </div>
  )
}

