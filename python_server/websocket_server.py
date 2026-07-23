# ============================================================
#  WEBSOCKET SERVER — Broadcast real-time data to Next.js
#  ws://localhost:8765
# ============================================================

import asyncio
import json
import websockets
import threading
from datetime import datetime

# Tập hợp các client đang kết nối
_clients: set = set()
_loop: asyncio.AbstractEventLoop | None = None


def _get_loop() -> asyncio.AbstractEventLoop:
    global _loop
    if _loop is None or _loop.is_closed():
        _loop = asyncio.new_event_loop()
    return _loop


# ── Handler cho mỗi kết nối WebSocket ────────────────────────
async def _handler(websocket):
    _clients.add(websocket)
    client_ip = websocket.remote_address
    print(f"[WS] Client kết nối: {client_ip} | Tổng: {len(_clients)}")
    try:
        # Gửi heartbeat chào mừng
        await websocket.send(json.dumps({
            "type"     : "connected",
            "message"  : "GuardFall WebSocket Server",
            "timestamp": _now()
        }))
        async for _ in websocket:
            pass   # Client có thể gửi ping, bỏ qua
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        _clients.discard(websocket)
        print(f"[WS] Client ngắt kết nối: {client_ip} | Còn: {len(_clients)}")


# ── Broadcast tới tất cả client ──────────────────────────────
async def _broadcast(payload: dict):
    if not _clients:
        return
    message = json.dumps(payload, ensure_ascii=False)
    dead = set()
    for ws in list(_clients):
        try:
            await ws.send(message)
        except Exception:
            dead.add(ws)
    _clients.difference_update(dead)


def broadcast(payload: dict):
    """Thread-safe broadcast — gọi từ bất kỳ thread nào."""
    if _loop and not _loop.is_closed():
        asyncio.run_coroutine_threadsafe(_broadcast(payload), _loop)


# ── Các hàm helper broadcast cụ thể ─────────────────────────

def broadcast_detection(fall_detected: bool, confidence: float,
                        detected_classes: list, consecutive: int):
    """Broadcast kết quả detection mỗi frame."""
    broadcast({
        "type"            : "detection",
        "fall_detected"   : fall_detected,
        "confidence"      : round(confidence * 100, 1),
        "detected_classes": detected_classes,
        "consecutive"     : consecutive,
        "timestamp"       : _now(),
    })


def broadcast_alert(confidence: float, timestamp: str,
                    img_path: str, history: list):
    """Broadcast khi kích hoạt cảnh báo (đủ frame liên tiếp)."""
    broadcast({
        "type"       : "fall_alert",
        "confidence" : round(confidence * 100, 1),
        "timestamp"  : timestamp,
        "image_path" : img_path,
        "history"    : history,
    })


def broadcast_status(webcam_running: bool, fps: float, uptime: str):
    """Broadcast trạng thái hệ thống (heartbeat)."""
    broadcast({
        "type"          : "status",
        "webcam_running": webcam_running,
        "fps"           : fps,
        "uptime"        : uptime,
        "timestamp"     : _now(),
    })


def broadcast_emergency(source: str = "button"):
    """Broadcast khi bấm nút khẩn cấp."""
    broadcast({
        "type"     : "emergency",
        "source"   : source,
        "timestamp": _now(),
    })


def broadcast_led(color: str):
    """Broadcast thay đổi màu LED."""
    broadcast({
        "type"     : "led",
        "color"    : color,
        "timestamp": _now(),
    })


# ── Khởi động WebSocket server trong thread riêng ────────────
def start(host: str = "0.0.0.0", port: int = 8765):
    def _run():
        global _loop
        _loop = asyncio.new_event_loop()
        asyncio.set_event_loop(_loop)

        async def _serve():
            async with websockets.serve(_handler, host, port):
                print(f"[WS] Server lắng nghe tại ws://{host}:{port}")
                await asyncio.Future()  # chạy mãi mãi

        _loop.run_until_complete(_serve())

    t = threading.Thread(target=_run, daemon=True, name="ws-server")
    t.start()
    print(f"[WS] Thread khởi động")


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
