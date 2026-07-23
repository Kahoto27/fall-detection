'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Camera,
  CameraOff,
  Circle,
  Loader2,
  Maximize2,
  Minimize2,
  MonitorPlay,
  RefreshCw,
  VideoOff,
  Wifi,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ── Kiểu nguồn camera ────────────────────────────────────────
type CamState = 'idle' | 'loading' | 'live' | 'error'

const API_BASE  = process.env.NEXT_PUBLIC_API_BASE || '/flask'
const MJPEG_URL = `${API_BASE}/video_feed`

// ── Component chính ──────────────────────────────────────────
export function LiveCamera({ alerting }: { alerting: boolean }) {
  const [state, setState] = useState<CamState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [clock, setClock] = useState('')
  const [mjpegKey, setMjpegKey] = useState(0) // force reload

  const videoRef  = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [isFullscreen, setIsFullscreen] = useState(false)

  // Theo dõi fullscreen
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Đồng hồ
  useEffect(() => {
    const id = setInterval(() => {
      setClock(
        new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        })
      )
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // ── MJPEG: chỉ cần img src ────────────────────────────────
  function startMjpeg() {
    setState('loading')
    setError(null)
    // Gọi Flask API để bật webcam
    fetch(`${API_BASE}/webcam/start`)
      .then(() => {
        setState('live')
        setMjpegKey(k => k + 1) // reload <img>
      })
      .catch(() => {
        setError('Không kết nối được Flask server (localhost:5000). Hãy chạy python server trước.')
        setState('error')
      })
  }

  function stopMjpeg() {
    fetch(`${API_BASE}/webcam/stop`).catch(() => {})
    setState('idle')
  }

  function reloadMjpeg() {
    setMjpegKey(k => k + 1)
  }

  const handleStart = () => startMjpeg()
  const handleStop  = () => stopMjpeg()

  return (
    <div className="space-y-2">
      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Nguồn camera:</span>
        <button
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors bg-primary text-primary-foreground'
          )}
        >
          <MonitorPlay className="size-3.5" />
          AI Stream (Flask)
        </button>
      </div>

      {/* Khung video */}
      <div
        className={cn(
          'relative aspect-video w-full overflow-hidden rounded-lg border bg-black',
          alerting && 'ring-2 ring-destructive animate-pulse'
        )}
      >
        {/* MJPEG <img> */}
        {state === 'live' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={mjpegKey}
            src={`${MJPEG_URL}?t=${mjpegKey}`}
            alt="MJPEG stream"
            className="h-full w-full object-cover"
            onError={() => {
              setError('Mất kết nối stream. Flask server đã dừng?')
              setState('error')
            }}
          />
        )}

        {/* Overlay khi chưa bật */}
        {state !== 'live' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            {state === 'loading' ? (
              <Loader2 className="size-8 animate-spin text-primary" />
            ) : state === 'error' ? (
              <VideoOff className="size-8 text-destructive" />
            ) : (
              <Camera className="size-8 text-muted-foreground" />
            )}
            <p className="max-w-xs text-sm text-muted-foreground text-pretty">
              {state === 'error'
                ? error
                : state === 'loading'
                  ? 'Đang kết nối AI stream...'
                  : 'Bật camera để xem stream YOLOv8 từ Flask server.'}
            </p>
            {state !== 'loading' && (
              <Button onClick={handleStart} size="sm">
                <Camera className="size-4" />
                {state === 'error' ? 'Thử lại' : 'Bật camera'}
              </Button>
            )}
          </div>
        )}

        {/* HUD overlay khi live */}
        {state === 'live' && (
          <>
            {/* Top bar */}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3">
              <Badge className="gap-1.5 border-transparent bg-destructive/90 text-destructive-foreground">
                <Circle className="size-2 animate-pulse fill-current" />
                LIVE
              </Badge>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-black/50 text-white border-white/20 font-mono text-[10px]">
                  🤖 YOLOv8 AI
                </Badge>
                <span className="rounded bg-black/55 px-2 py-1 font-mono text-xs text-white tabular-nums">
                  {clock}
                </span>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-3">
              <span className="rounded bg-black/55 px-2 py-1 font-mono text-[11px] text-white">
                CAM-01 · Phòng giám sát
              </span>
              <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="size-8"
                    onClick={reloadMjpeg}
                    aria-label="Tải lại stream"
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  className="size-8"
                  onClick={() => {
                    if (!document.fullscreenElement) {
                      const el = document.querySelector('.aspect-video') as HTMLElement
                      el?.requestFullscreen?.()
                    } else {
                      document.exitFullscreen?.()
                    }
                  }}
                  aria-label={isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
                >
                  {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                </Button>
                <Button
                  size="icon"
                  variant="destructive"
                  className="size-8"
                  onClick={handleStop}
                  aria-label="Tắt camera"
                >
                  <CameraOff className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
