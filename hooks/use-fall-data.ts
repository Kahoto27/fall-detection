'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DeviceStatus, FallAlert, SmsContact } from '@/lib/mock-data'
import {
  initialDeviceStatus,
  initialAlerts,
} from '@/lib/mock-data'

// ── Types từ WebSocket server ──────────────────────────────

type WsDetection = {
  type: 'detection'
  fall_detected: boolean
  confidence: number
  detected_classes: string[]
  consecutive: number
  timestamp: string
}

type WsAlert = {
  type: 'fall_alert'
  confidence: number
  timestamp: string
  image_path: string
  history: FallAlert[]
}

type WsStatus = {
  type: 'status'
  webcam_running: boolean
  fps: number
  uptime: string
  timestamp: string
}

type WsEmergency = {
  type: 'emergency'
  source: string
  timestamp: string
}

type WsLed = {
  type: 'led'
  color: DeviceStatus['ledColor']
  timestamp: string
}

type WsMessage =
  | WsDetection
  | WsAlert
  | WsStatus
  | WsEmergency
  | WsLed
  | { type: 'connected'; message: string; timestamp: string }
  | { type: 'history'; history: FallAlert[] }
  | { type: 'buzzer'; state: 'on' | 'off'; timestamp: string }
  | { type: 'esp32_status'; online: boolean; timestamp: string }

// ── Config ─────────────────────────────────────────────────

let API_BASE = '/flask'
let WS_URL   = ''

if (typeof window !== 'undefined') {
  const host = window.location.hostname
  // Nếu truy cập từ mạng LAN hoặc localhost, nối thẳng tới port 8765
  if (host === 'localhost' || host.startsWith('192.168.') || host.startsWith('10.')) {
    WS_URL = `ws://${host}:8765`
  } else {
    // Nếu truy cập qua ngrok, đi qua Next.js proxy
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    WS_URL = `${wsProtocol}//${window.location.host}/ws-api`
  }
}
const RECONNECT_MS = 3000

// ── Hook chính ─────────────────────────────────────────────

export interface FallDataState {
  status: DeviceStatus
  alerts: FallAlert[]
  contacts: SmsContact[]
  connected: boolean
  webcamRunning: boolean
  fps: number
  // Actions
  startCamera: () => Promise<void>
  stopCamera: () => Promise<void>
  testAlert: () => Promise<void>
  clearHistory: () => Promise<void>
  resolveAlert: (id: string) => Promise<void>
  setThreshold: (value: number) => Promise<void>
  setCooldown: (value: number) => Promise<void>
  addContact: (c: Omit<SmsContact, 'id' | 'priority' | 'active'>) => Promise<void>
  removeContact: (id: string) => Promise<void>
  toggleContact: (id: string) => Promise<void>
  silenceBuzzer: () => Promise<void>
  resetSystem: () => void
  acknowledge: (id: string) => Promise<void>
}

export function useFallData(): FallDataState {
  const [status, setStatus]       = useState<DeviceStatus>(initialDeviceStatus)
  const [alerts, setAlerts]       = useState<FallAlert[]>([])
  const [contacts, setContacts] = useState<SmsContact[]>([])

  // Load contacts from API
  useEffect(() => {
    fetch(`${API_BASE}/api/contacts`, { headers: { 'ngrok-skip-browser-warning': '1' } })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setContacts(data)
      })
      .catch(e => console.error('Failed to load contacts:', e))
  }, [])

  // CRUD contacts via API
  const addContact = async (c: Omit<SmsContact, 'id' | 'priority' | 'active'>) => {
    try {
      const res = await fetch(`${API_BASE}/api/contacts`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '1'
        },
        body: JSON.stringify({ ...c, active: true }),
      })
      if (res.ok) {
        const newContact = await res.json()
        setContacts(prev => [...prev, newContact])
      }
    } catch (e) { console.error('Failed to add contact', e) }
  }

  const removeContact = async (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id))
    try {
      await fetch(`${API_BASE}/api/contacts/${id}`, { 
        method: 'DELETE',
        headers: { 'ngrok-skip-browser-warning': '1' }
      })
    } catch (e) { console.error('Failed to remove contact', e) }
  }

  const toggleContact = async (id: string) => {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c))
    try {
      await fetch(`${API_BASE}/api/contacts/${id}`, { 
        method: 'PUT',
        headers: { 'ngrok-skip-browser-warning': '1' }
      })
    } catch (e) { console.error('Failed to toggle contact', e) }
  }

  const [connected, setConnected] = useState(false)
  const [webcamRunning, setWebcamRunning] = useState(false)
  const [fps, setFps]             = useState(0)

  const wsRef      = useRef<WebSocket | null>(null)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMounted  = useRef(true)

  // ── WebSocket connection ──────────────────────────────────
  const connect = useCallback(() => {
    if (!isMounted.current) return
    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        if (!isMounted.current) return
        setConnected(true)
        console.log('[WS] Kết nối thành công')
      }

      ws.onclose = () => {
        if (!isMounted.current) return
        setConnected(false)
        setStatus(s => ({ ...s, esp32Online: false }))
        if (heartbeatTimer.current) clearTimeout(heartbeatTimer.current)
        console.log('[WS] Mất kết nối — thử lại sau', RECONNECT_MS, 'ms')
        retryTimer.current = setTimeout(connect, RECONNECT_MS)
      }

      ws.onerror = () => {
        ws.close()
      }

      ws.onmessage = (event) => {
        if (!isMounted.current) return
        try {
          const msg: WsMessage = JSON.parse(event.data as string)
          handleMessage(msg)
        } catch {
          /* ignore invalid JSON */
        }
      }
    } catch (err) {
      console.warn('[WS] Không kết nối được:', err)
      retryTimer.current = setTimeout(connect, RECONNECT_MS)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleMessage(msg: WsMessage) {
    switch (msg.type) {
      case 'detection':
        if (msg.fall_detected) {
          setStatus(s => ({
            ...s,
            ledColor     : 'red',
          }))
        } else if (msg.detected_classes.includes('person')) {
          setStatus(s => ({ ...s, ledColor: 'green' }))
        }
        break

      case 'fall_alert':
        if (msg.history && msg.history.length > 0) {
          setAlerts(msg.history)
        } else {
          const newAlert: FallAlert = {
            id             : `ws-${Date.now()}`,
            timestamp      : Date.now(),
            severity       : 'fall',
            status         : 'active',
            location       : 'Vị trí giám sát',
            message        : `YOLOv8 phát hiện té ngã. Độ tin cậy: ${msg.confidence}%`,
            smsSent        : true,
            responseSeconds: null,
          }
          setAlerts(prev => [newAlert, ...prev].slice(0, 20))
        }
        setStatus(s => ({ ...s, ledColor: 'red', buzzerActive: true }))
        break

      case 'status':
        setWebcamRunning(msg.webcam_running)
        setFps(msg.fps)
        break

      case 'esp32_status':
        setStatus(s => ({ 
            ...s, 
            lastHeartbeat: Date.now(),
            esp32Online: msg.online 
        }))
        if (heartbeatTimer.current) clearTimeout(heartbeatTimer.current)
        if (msg.online) {
            heartbeatTimer.current = setTimeout(() => {
                setStatus(s => ({ ...s, esp32Online: false }))
            }, 15000)
        }
        break

      case 'emergency':
        setStatus(s => ({
          ...s,
          ledColor       : 'red',
          buzzerActive   : true,
          emergencyButton: true,
        }))
        const emergencyAlert: FallAlert = {
          id             : `em-${Date.now()}`,
          timestamp      : Date.now(),
          severity       : msg.source === 'test' ? 'test' : 'emergency',
          status         : 'active',
          location       : msg.source === 'button' ? 'Nút khẩn cấp' : 'Hệ thống',
          message        : msg.source === 'button'
            ? 'Người dùng nhấn nút khẩn cấp.'
            : 'Kiểm tra cảnh báo thủ công từ dashboard.',
          smsSent        : msg.source === 'button',
          responseSeconds: null,
        }
        setAlerts(prev => [emergencyAlert, ...prev].slice(0, 20))
        break

      case 'led':
        setStatus(s => ({ ...s, ledColor: msg.color }))
        break

      case 'history':
        setAlerts(msg.history)
        break

      case 'buzzer':
        setStatus(s => ({ ...s, buzzerActive: msg.state === 'on' }))
        break
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true
    connect()
    return () => {
      isMounted.current = false
      if (retryTimer.current) clearTimeout(retryTimer.current)
      if (heartbeatTimer.current) clearTimeout(heartbeatTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  // ── API actions ───────────────────────────────────────────
  async function apiGet(path: string) {
    try {
      await fetch(`${API_BASE}${path}`, { headers: { 'ngrok-skip-browser-warning': '1' } })
    } catch (err) {
      console.warn('[API]', path, err)
    }
  }

  const startCamera  = () => apiGet('/webcam/start').then(() => setWebcamRunning(true))
  const stopCamera   = () => apiGet('/webcam/stop').then(() => setWebcamRunning(false))
  const testAlert    = () => apiGet('/test_alert')
  const clearHistory = () => apiGet('/history/clear').then(() => setAlerts([]))
  const setThreshold = (v: number) => apiGet(`/settings/threshold?value=${v}`)
  const setCooldown  = (v: number) => apiGet(`/settings/cooldown?value=${v}`)
  const silenceBuzzer = () =>
    apiGet('/buzzer/off').then(() =>
      setStatus(s => ({ ...s, buzzerActive: false }))
    )

  const resolveAlert = async (id: string) => {
    await apiGet(`/history/${id}/resolve`)
    setAlerts(prev =>
      prev.map(a =>
        a.id === id
          ? { ...a, status: 'resolved', responseSeconds: 30 }
          : a
      )
    )
    setStatus(s => ({
      ...s,
      buzzerActive   : false,
      ledColor       : 'green',
      emergencyButton: false,
    }))
  }

  const acknowledge = resolveAlert

  function resetSystem() {
    setStatus(s => ({
      ...s,
      buzzerActive   : false,
      ledColor       : 'green',
      emergencyButton: false,
    }))
    setAlerts(prev =>
      prev.map(a =>
        a.status === 'active'
          ? { ...a, status: 'resolved', responseSeconds: a.responseSeconds ?? 30 }
          : a
      )
    )
    apiGet('/system/reset')
  }

  return {
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
    setThreshold,
    setCooldown,
    addContact,
    removeContact,
    toggleContact,
    silenceBuzzer,
    resetSystem,
    acknowledge,
  }
}
