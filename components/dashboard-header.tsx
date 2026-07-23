'use client'

import { useEffect, useState } from 'react'
import { Circle, ShieldAlert, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'

export function DashboardHeader({
  alerting,
  esp32Online,
}: {
  alerting: boolean
  esp32Online: boolean
}) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex size-10 items-center justify-center rounded-lg',
              alerting ? 'bg-destructive/15' : 'bg-primary/15',
            )}
          >
            {alerting ? (
              <ShieldAlert className="size-6 text-destructive" />
            ) : (
              <ShieldCheck className="size-6 text-primary" />
            )}
          </span>
          <div>
            <h1 className="text-lg font-semibold leading-tight tracking-tight">
              GuardFall
            </h1>
            <p className="text-xs text-muted-foreground">
              Hệ thống cảnh báo té ngã · ESP32
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <span className="hidden font-mono text-sm text-muted-foreground tabular-nums sm:inline">
            {now
              ? now.toLocaleString('vi-VN', {
                  weekday: 'short',
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : '—'}
          </span>

          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
              esp32Online
                ? 'border-success/30 bg-success/15 text-success'
                : 'border-destructive/30 bg-destructive/15 text-destructive',
            )}
          >
            <Circle className="size-2 fill-current" />
            {esp32Online ? 'ESP32 trực tuyến' : 'ESP32 mất kết nối'}
          </span>

          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
              alerting
                ? 'border-destructive/40 bg-destructive/20 text-destructive'
                : 'border-success/30 bg-success/15 text-success',
            )}
          >
            <Circle className={cn('size-2 fill-current', alerting && 'animate-pulse')} />
            {alerting ? 'ĐANG CẢNH BÁO' : 'Bình thường'}
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
