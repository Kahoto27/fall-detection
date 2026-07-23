// Kiểu dữ liệu và dữ liệu giả lập cho hệ thống cảnh báo té ngã GuardFall

export type AlertSeverity = 'fall' | 'emergency' | 'test' | 'info'
export type AlertStatus = 'resolved' | 'active' | 'acknowledged'

export interface FallAlert {
  id: string
  timestamp: number
  severity: AlertSeverity
  status: AlertStatus
  location: string
  message: string
  smsSent: boolean
  responseSeconds: number | null
}

export interface SmsContact {
  id: string
  name: string
  relation: string
  phone: string
  priority: number
  active: boolean
}

export interface DeviceStatus {
  esp32Online: boolean
  buzzerActive: boolean
  ledColor: 'green' | 'blue' | 'red' | 'off'
  simSignal: number // 0-100
  emergencyButton: boolean
  batteryLevel: number // 0-100
  lastHeartbeat: number
}

const now = Date.now()
const minute = 60_000
const hour = 60 * minute
const day = 24 * hour

export const initialDeviceStatus: DeviceStatus = {
  esp32Online: false,
  buzzerActive: false,
  ledColor: 'green',
  simSignal: 82,
  emergencyButton: false,
  batteryLevel: 76,
  lastHeartbeat: now,
}

export const severityLabels: Record<AlertSeverity, string> = {
  fall: 'Phát hiện té ngã',
  emergency: 'Nút khẩn cấp',
  test: 'Kiểm tra hệ thống',
  info: 'Thông tin',
}

export const statusLabels: Record<AlertStatus, string> = {
  resolved: 'Đã xử lý',
  active: 'Đang cảnh báo',
  acknowledged: 'Đã xác nhận',
}

export const initialAlerts: FallAlert[] = []

// initialContacts has been removed since contacts are now fetched from backend API

// 7 ngày gần nhất: số sự kiện té ngã và thời gian phản hồi trung bình (giây)
export const weeklyTrend: { day: string; falls: number; response: number }[] = []

// Phân bố sự kiện theo khung giờ trong ngày
export const hourlyDistribution: { range: string; events: number }[] = []

export function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
