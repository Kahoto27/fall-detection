# GuardFall — Hệ thống Phát Hiện Té Ngã
**Sinh viên:** Nguyễn Vũ Hải Dương | **MSSV:** 42200226  
**Đề tài:** Hệ thống phát hiện té ngã sử dụng AI tích hợp cảnh báo tự động qua WiFi và SMS

---

## Kiến trúc hệ thống

```
[Webcam USB]
     │
     ▼
[Python Server :5000]  ──── MJPEG Stream ────► [Browser]
     │   └── WebSocket :8765 ──────────────────► [Next.js :3000]
     │
     ├── MQTT publish ──────────────────────► [Mosquitto :1883]
     │                                              │
     │                                                          ▼
     │                                                   [ESP32 DevKit V1]
     │                                                          │
     │                                                 ┌────────┴────────┐
     └── Telegram Bot ──────────► [📱 Điện thoại]  [SIM A7680C] [LED/Còi/Nút]
                                                         │
                                                    [SMS 4G LTE]
```

---

## Cấu trúc thư mục

```
Fall-detection_anti/
├── app/                    Next.js pages
├── components/             React components (shadcn/ui)
├── hooks/
│   └── use-fall-data.ts    WebSocket real-time hook
├── lib/                    Types & mock data
├── python_server/          Flask + YOLOv8 + WebSocket
│   ├── server.py           Entry point
│   ├── inference.py        YOLOv8 2-class detector
│   ├── websocket_server.py Real-time broadcast
│   ├── alert_dispatcher.py MQTT + Telegram
│   ├── config.py           Cấu hình (đọc từ .env)
│   ├── .env                Credentials (không commit!)
│   └── requirements.txt
├── esp32_firmware/
│   └── fall_detection/
│       ├── fall_detection.ino  Main sketch
│       ├── config.h            Pin mapping + credentials
│       ├── led_rgb.h           LED controller
│       ├── sim_a7680c.h        SIM 4G AT commands
│       └── button_isr.h        Emergency button ISR

└── trained_models/
    ├── best.pt             Model tốt nhất
    └── last.pt             Checkpoint cuối
```

---

## Hướng dẫn cài đặt

### Bước 1: Python Server

```powershell
# Cài dependencies vào môi trường ảo hiện có
D:\Projects\Fall_detection\fall_env\Scripts\pip.exe install -r python_server\requirements.txt

# Copy .env
copy python_server\.env.example python_server\.env
# Sửa .env với token Telegram và số điện thoại thật

# Chạy server
D:\Projects\Fall_detection\fall_env\Scripts\python.exe python_server\server.py
```

Server chạy tại:
- **Flask API**: `http://localhost:5000`
- **Video Stream**: `http://localhost:5000/video_feed`
- **WebSocket**: `ws://localhost:8765`

### Bước 2: Mosquitto MQTT Broker

```powershell
# Cài Mosquitto: https://mosquitto.org/download/
# Chạy broker
mosquitto -v
```

### Bước 3: Next.js Dashboard

```powershell
# Cài dependencies
cd D:\Projects\Fall-detection_anti
pnpm install

# Chạy development server
pnpm dev
```

Dashboard tại: `http://localhost:3000`



### Bước 5: ESP32 Firmware

1. Mở **Arduino IDE** (hoặc PlatformIO)
2. Cài Libraries:
   - `PubSubClient` by Nick O'Leary
   - `ArduinoJson` by Benoît Blanchon
3. Mở `esp32_firmware/fall_detection/fall_detection.ino`
4. Sửa `config.h`:
   - `WIFI_SSID` và `WIFI_PASSWORD`
   - `MQTT_BROKER` = địa chỉ IP LAN của máy tính
   - `SMS_PHONE` = số điện thoại người thân
5. Chọn Board: **ESP32 Dev Module**
6. Nạp firmware

---

## Sơ đồ kết nối phần cứng

| Thiết bị | Pin ESP32 | Ghi chú |
|----------|-----------|---------|
| LED RGB - Red | GPIO 25 | PWM |
| LED RGB - Green | GPIO 26 | PWM |
| LED RGB - Blue | GPIO 27 | PWM |
| Còi Buzzer | GPIO 32 | Active HIGH |
| Nút khẩn cấp | GPIO 33 | INPUT_PULLUP |
| SIM A7680C TX→ESP RX | GPIO 16 (RX2) | Serial2 |
| SIM A7680C RX←ESP TX | GPIO 17 (TX2) | Serial2 |
| SIM A7680C RST | GPIO 4 | Active LOW |

---

## MQTT Topics

| Topic | Publisher | Subscriber | Payload |
|-------|-----------|------------|---------|
| `fall/alert` | Python | ESP32 | `{"event":"FALL_DETECTED","confidence":85.2}` |
| `fall/led` | Python | ESP32 | `"green"` / `"red"` / `"yellow"` |
| `fall/buzzer` | Python | ESP32 | `"ON"` / `"OFF"` |
| `fall/emergency` | ESP32 | Python | `{"event":"EMERGENCY_BUTTON"}` |

---

## Logic LED RGB

| Trạng thái | Màu LED |
|-----------|---------|
| Hệ thống bình thường | 🟢 Xanh lá (solid) |
| Phát hiện người | 🟢 Xanh lá (solid) |
| Đang khởi động / WiFi | 🔵 Xanh dương |
| Mất WiFi → dùng SIM | 🟡 Vàng |
| Phát hiện té ngã | 🔴 Đỏ nhấp nháy |
| Bấm nút khẩn cấp | 🔴 Đỏ nhấp nháy |

---

## Luồng xử lý khi phát hiện té ngã

```
[Webcam] → [YOLOv8 inference]
              │
              ▼ class=fall, conf≥70%
           [Counter++]
              │
              ▼ counter ≥ 3 frames
           [Trigger Alert]
              │
    ┌─────────┼─────────────┐
    ▼         ▼             ▼
[Telegram]  [MQTT]    [WebSocket]
 Ảnh+text   buzzer    Next.js UI
            led=red
              │
              ▼ (nếu WiFi mất)
           [ESP32 → SIM A7680C → SMS]
```

---

## Test nhanh

```powershell
# 1. Kiểm tra server
curl http://localhost:5000/health

# 2. Bật webcam
curl http://localhost:5000/webcam/start

# 3. Test cảnh báo
curl http://localhost:5000/test_alert

# 4. Xem lịch sử
curl http://localhost:5000/history

# 5. Xem video stream
# Mở trình duyệt: http://localhost:5000/video_feed
```
