'use client'

import { useMemo } from 'react'
import {
  Activity,
  BellRing,
  Clock,
  TriangleAlert,
  Users,
  X,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardHeader } from '@/components/dashboard-header'
import { LiveCamera } from '@/components/live-camera'
import { DeviceStatusGrid } from '@/components/device-status'
import { RemoteControl } from '@/components/remote-control'
import { AlertHistory } from '@/components/alert-history'
import { SmsContacts } from '@/components/sms-contacts'
import { StatsCharts } from '@/components/stats-charts'
import { useFallData } from '@/hooks/use-fall-data'
import type { SmsContact } from '@/lib/mock-data'

export default function Page() {
  const {
    status,
    alerts,
    contacts,
    connected,
    webcamRunning,
    fps,
    startCamera,
    stopCamera,
    testAlert,
    clearHistory,
    resolveAlert,
    addContact,
    removeContact,
    toggleContact,
    silenceBuzzer,
    resetSystem,
    acknowledge,
  } = useFallData()

  const activeAlert = alerts.find(a => a.status === 'active') ?? null
  const alerting    = activeAlert != null

  const kpis = useMemo(() => {
    const startOfDay = new Date().setHours(0, 0, 0, 0)
    const today      = alerts.filter(a => a.timestamp >= startOfDay).length
    const falls7d    = alerts.filter(a => a.severity === 'fall').length
    const responses  = alerts
      .map(a => a.responseSeconds)
      .filter((r): r is number => r != null && r > 0)
    const avg = responses.length
      ? Math.round(responses.reduce((s, r) => s + r, 0) / responses.length)
      : 0
    return {
      today,
      falls7d,
      avg,
      activeContacts: contacts.filter(c => c.active).length,
    }
  }, [alerts, contacts])

  const activeNames = contacts.filter(c => c.active).map(c => c.name)

  // ── Handlers ────────────────────────────────────────────────

  function handleSilenceBuzzer() {
    silenceBuzzer()
    toast.info('Đã tắt còi cảnh báo')
  }

  function handleResetSystem() {
    resetSystem()
    toast.success('Hệ thống đã được reset', {
      description: 'ESP32 khởi động lại, LED trở về xanh, còi tắt.',
    })
  }

  async function handleTestAlert() {
    await testAlert()
    toast.success('Đã gửi lệnh test tới Flask server')
  }

  function handleAcknowledge(id: string) {
    resetSystem()
    toast.success('Đã xác nhận an toàn', {
      description: 'Còi đã tắt, lịch sử ghi nhận phản hồi.',
    })
  }

  async function handleToggleContact(id: string) {
    await toggleContact(id)
  }

  async function handleRemoveContact(id: string) {
    await removeContact(id)
    toast.info('Đã xoá liên hệ')
  }

  async function handleAddContact(c: Omit<SmsContact, 'id' | 'priority' | 'active'>) {
    await addContact(c)
    toast.success(`Đã thêm liên hệ ${c.name}`)
  }

  return (
    <div className="min-h-screen">
      <DashboardHeader alerting={alerting} esp32Online={status.esp32Online} />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-6">

        {/* Banner kết nối server */}
        <div className={`flex items-center gap-3 rounded-lg border px-4 py-2 text-sm transition-colors ${
          connected
            ? 'border-success/30 bg-success/10 text-success'
            : 'border-muted bg-muted/30 text-muted-foreground'
        }`}>
          {connected
            ? <Wifi className="size-4 shrink-0" />
            : <WifiOff className="size-4 shrink-0" />}
          {connected
            ? `🟢 Đã kết nối Flask server (ws://localhost:8765) · FPS: ${fps}`
            : '⚪ Chưa kết nối server — Đang hiển thị dữ liệu mô phỏng. Chạy python_server/server.py để kết nối.'}
        </div>

        {/* Banner cảnh báo khẩn cấp */}
        {activeAlert && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/15 p-4"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-destructive/25">
              <TriangleAlert className="size-6 text-destructive" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-destructive">
                Cảnh báo té ngã tại {activeAlert.location}
              </p>
              <p className="text-sm text-destructive/80">{activeAlert.message}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSilenceBuzzer}>
                Tắt còi
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleAcknowledge(activeAlert.id)}
              >
                <X className="size-4" />
                Xác nhận an toàn
              </Button>
            </div>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            icon={<BellRing className="size-5 text-primary" />}
            label="Cảnh báo hôm nay"
            value={kpis.today}
          />
          <KpiCard
            icon={<TriangleAlert className="size-5 text-destructive" />}
            label="Té ngã (7 ngày)"
            value={kpis.falls7d}
          />
          <KpiCard
            icon={<Clock className="size-5 text-warning" />}
            label="Phản hồi TB"
            value={`${kpis.avg}s`}
          />
          <KpiCard
            icon={<Users className="size-5 text-success" />}
            label="Liên hệ hoạt động"
            value={kpis.activeContacts}
          />
        </div>

        {/* Camera + điều khiển / trạng thái */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="size-4 text-primary" />
                  Camera giám sát thời gian thực
                </CardTitle>
                <CardDescription>
                  {connected
                    ? 'Đang nhận AI stream từ YOLOv8 (Flask :5000). Bounding box: đỏ=té ngã, xanh=người.'
                    : 'Kết nối Flask server để xem AI stream với bounding box YOLOv8.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LiveCamera alerting={alerting} />
              </CardContent>
            </Card>
            <RemoteControl
              status={status}
              onSilence={handleSilenceBuzzer}
              onReset={handleResetSystem}
              onTest={handleTestAlert}
              connected={connected}
              webcamRunning={webcamRunning}
            />
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Trạng thái thiết bị</CardTitle>
                <CardDescription>
                  {connected ? `Cập nhật realtime · FPS: ${fps}` : 'Cập nhật theo nhịp tim ESP32'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DeviceStatusGrid status={status} />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="history" className="w-full">
          <TabsList>
            <TabsTrigger value="history">Lịch sử cảnh báo</TabsTrigger>
            <TabsTrigger value="contacts">Liên hệ SMS</TabsTrigger>
            <TabsTrigger value="stats">Thống kê</TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Lịch sử cảnh báo té ngã</CardTitle>
                    <CardDescription>
                      Toàn bộ sự kiện được ghi nhận, kèm trạng thái gửi SMS và thời gian phản hồi.
                    </CardDescription>
                  </div>
                  {alerts.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearHistory}
                      className="text-muted-foreground hover:text-destructive">
                      Xóa lịch sử
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <AlertHistory alerts={alerts} onAcknowledge={handleAcknowledge} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contacts" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Danh bạ nhận cảnh báo SMS</CardTitle>
                <CardDescription>
                  Khi phát hiện té ngã, module SIM A7680C sẽ gửi tin nhắn tới các liên hệ đang bật.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SmsContacts
                  contacts={contacts}
                  onToggle={handleToggleContact}
                  onRemove={handleRemoveContact}
                  onAdd={handleAddContact}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="mt-4">
            <StatsCharts alerts={alerts} />
          </TabsContent>
        </Tabs>

        <p className="text-center text-xs text-muted-foreground text-pretty">
          GuardFall · {connected
            ? 'Dữ liệu thật từ YOLOv8 + ESP32 qua WebSocket.'
            : 'Dữ liệu mô phỏng — kết nối server để xem dữ liệu thật.'}
        </p>
      </main>

      <Toaster position="top-right" richColors />
    </div>
  )
}

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
        </div>
      </div>
    </Card>
  )
}
