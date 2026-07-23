'use client'

import { BellOff, Power, Siren, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { DeviceStatus } from '@/lib/mock-data'

interface Props {
  status: DeviceStatus
  onSilence: () => void
  onReset: () => void
  onTest: () => void
  onStartCamera?: () => void
  onStopCamera?: () => void
  webcamRunning?: boolean
  connected?: boolean
}

export function RemoteControl({
  status,
  onSilence,
  onReset,
  onTest,
  onSimulateFall,
  onStartCamera,
  onStopCamera,
  webcamRunning = false,
  connected = false,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Điều khiển từ xa
          {connected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
              ● Đã kết nối server
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              ○ Demo (chưa kết nối)
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Gửi lệnh tới ESP32 và Flask server qua WebSocket/REST API.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        {/* Tắt còi */}
        <Button
          variant="secondary"
          className="h-auto flex-col items-start gap-1 py-3"
          onClick={onSilence}
          disabled={!status.buzzerActive}
        >
          <BellOff className="size-5" />
          <span className="text-sm font-medium">Tắt còi</span>
          <span className="text-xs text-muted-foreground">
            {status.buzzerActive ? 'Còi đang kêu' : 'Còi đang tắt'}
          </span>
        </Button>

        {/* Reset hệ thống */}
        <Button
          variant="secondary"
          className="h-auto flex-col items-start gap-1 py-3"
          onClick={onReset}
        >
          <Power className="size-5" />
          <span className="text-sm font-medium">Reset hệ thống</span>
          <span className="text-xs text-muted-foreground">Tắt còi + LED xanh</span>
        </Button>

        {/* Kiểm tra cảnh báo */}
        <Button
          variant="outline"
          className="h-auto flex-col items-start gap-1 py-3"
          onClick={onTest}
        >
          <Siren className="size-5 text-warning" />
          <span className="text-sm font-medium">Test cảnh báo</span>
          <span className="text-xs text-muted-foreground">
            {connected ? 'Gửi qua Flask API' : 'Chạy thử local'}
          </span>
        </Button>

      </CardContent>
    </Card>
  )
}
