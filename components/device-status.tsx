'use client'

import {
  BatteryMedium,
  Bell,
  BellOff,
  Cpu,
  Lightbulb,
  Wifi,
  WifiOff,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { DeviceStatus } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

interface Tone {
  text: string
  bg: string
  ring: string
}

const tones: Record<'good' | 'warn' | 'bad' | 'idle', Tone> = {
  good: { text: 'text-success', bg: 'bg-success/15', ring: 'ring-success/30' },
  warn: { text: 'text-warning', bg: 'bg-warning/15', ring: 'ring-warning/30' },
  bad: {
    text: 'text-destructive',
    bg: 'bg-destructive/15',
    ring: 'ring-destructive/30',
  },
  idle: {
    text: 'text-muted-foreground',
    bg: 'bg-muted',
    ring: 'ring-border',
  },
}

function StatItem({
  icon: Icon,
  label,
  value,
  tone,
  pulse,
}: {
  icon: LucideIcon
  label: string
  value: string
  tone: keyof typeof tones
  pulse?: boolean
}) {
  const t = tones[tone]
  return (
    <Card className="flex flex-row items-center gap-3 p-3">
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-md ring-1',
          t.bg,
          t.ring,
          pulse && 'animate-pulse',
        )}
      >
        <Icon className={cn('size-5', t.text)} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className={cn('truncate text-sm font-semibold', t.text)}>{value}</p>
      </div>
    </Card>
  )
}

const ledMap: Record<DeviceStatus['ledColor'], { label: string; tone: keyof typeof tones }> = {
  green: { label: 'Xanh · Bình thường', tone: 'good' },
  blue: { label: 'Xanh dương · Đang xử lý', tone: 'idle' },
  red: { label: 'Đỏ · Cảnh báo', tone: 'bad' },
  off: { label: 'Tắt', tone: 'idle' },
}

export function DeviceStatusGrid({ status }: { status: DeviceStatus }) {
  const led = ledMap[status.ledColor]

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatItem
        icon={status.esp32Online ? Cpu : Cpu}
        label="Bo mạch ESP32"
        value={status.esp32Online ? 'Trực tuyến' : 'Mất kết nối'}
        tone={status.esp32Online ? 'good' : 'bad'}
      />
      <StatItem
        icon={status.esp32Online ? Wifi : WifiOff}
        label="Kết nối"
        value={status.esp32Online ? 'Ổn định' : 'Ngắt'}
        tone={status.esp32Online ? 'good' : 'bad'}
      />
      <StatItem
        icon={status.buzzerActive ? Bell : BellOff}
        label="Còi cảnh báo"
        value={status.buzzerActive ? 'Đang kêu' : 'Im lặng'}
        tone={status.buzzerActive ? 'bad' : 'idle'}
        pulse={status.buzzerActive}
      />
      <StatItem
        icon={Lightbulb}
        label="LED RGB"
        value={led.label}
        tone={led.tone}
        pulse={status.ledColor === 'red'}
      />
    </div>
  )
}
