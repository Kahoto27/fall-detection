'use client'

import { Check, MessageSquare, MessageSquareOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type AlertSeverity,
  type AlertStatus,
  type FallAlert,
  formatDateTime,
  severityLabels,
  statusLabels,
} from '@/lib/mock-data'
import { cn } from '@/lib/utils'

const severityStyle: Record<AlertSeverity, string> = {
  fall: 'border-destructive/30 bg-destructive/15 text-destructive',
  emergency: 'border-warning/30 bg-warning/15 text-warning',
  test: 'border-primary/30 bg-primary/15 text-primary',
  info: 'border-border bg-muted text-muted-foreground',
}

const statusStyle: Record<AlertStatus, string> = {
  active: 'border-destructive/30 bg-destructive/15 text-destructive',
  acknowledged: 'border-warning/30 bg-warning/15 text-warning',
  resolved: 'border-success/30 bg-success/15 text-success',
}

export function AlertHistory({
  alerts,
  onAcknowledge,
}: {
  alerts: FallAlert[]
  onAcknowledge: (id: string) => void
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Thời gian</TableHead>
            <TableHead>Loại</TableHead>
            <TableHead className="hidden md:table-cell">Vị trí</TableHead>
            <TableHead className="hidden lg:table-cell">Chi tiết</TableHead>
            <TableHead>SMS</TableHead>
            <TableHead className="hidden sm:table-cell">Phản hồi</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead className="text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map((a) => (
            <TableRow key={a.id} className={cn(a.status === 'active' && 'bg-destructive/5')}>
              <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                {formatDateTime(a.timestamp)}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={cn('font-medium', severityStyle[a.severity])}>
                  {severityLabels[a.severity]}
                </Badge>
              </TableCell>
              <TableCell className="hidden md:table-cell text-sm">{a.location}</TableCell>
              <TableCell className="hidden lg:table-cell max-w-xs text-sm text-muted-foreground">
                <span className="line-clamp-1">{a.message}</span>
              </TableCell>
              <TableCell>
                {a.smsSent ? (
                  <span className="inline-flex items-center gap-1 text-xs text-success">
                    <MessageSquare className="size-3.5" /> Đã gửi
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <MessageSquareOff className="size-3.5" /> Không
                  </span>
                )}
              </TableCell>
              <TableCell className="hidden sm:table-cell text-sm tabular-nums text-muted-foreground">
                {a.responseSeconds != null ? `${a.responseSeconds}s` : '—'}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={statusStyle[a.status]}>
                  {statusLabels[a.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {a.status === 'active' ? (
                  <Button size="sm" variant="outline" onClick={() => onAcknowledge(a.id)}>
                    <Check className="size-4" />
                    Xác nhận
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
