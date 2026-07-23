@echo off
chcp 65001 > nul
title GuardFall — Start All Services

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║           GuardFall — Khởi động hệ thống           ║
echo  ║   MSSV: 42200226 — Nguyễn Vũ Hải Dương            ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

:: ── 1. Python AI Server (Flask + WebSocket) ──────────────────
echo  [1/4] Khoi dong Python Server (YOLOv8 + Flask)...
start "Python Server" cmd /k "cd /d D:\Projects\Fall-detection_anti\python_server && D:\Projects\Fall_detection\fall_env\Scripts\python.exe server.py"
timeout /t 3 /nobreak > nul
echo       ✅ Python Server da khoi dong
echo.

:: ── 2. MQTT Broker (Mosquitto) ──────────────────────────────
echo  [2/4] Khoi dong MQTT Broker (Giao tiep ESP32)...
tasklist /fi "imagename eq mosquitto.exe" | find "mosquitto.exe" > nul
if %ERRORLEVEL% EQU 0 (
    echo       ✅ Mosquitto đang chạy rồi
) else (
    start "Mosquitto MQTT" /min "D:\Program Files\Mosquitto\mosquitto.exe" -c "D:\Projects\Fall-detection_anti\mosquitto.conf" -v
    timeout /t 2 /nobreak > nul
    echo       ✅ Mosquitto đã khởi động
)
echo.

:: ── 3. Frontend Next.js (Dashboard) ────────────────────────
echo  [3/4] Khoi dong Next.js Dashboard (San sang cho 4G Ngrok)...
start "GuardFall Dashboard" cmd /c "run_dashboard.bat"
timeout /t 5 /nobreak > nul
echo       » Next.js dang chay che do Production (pnpm start)
echo.

:: ── 4. Mo trinh duyet ────────────────────────────────────────
echo  [4/4] Thông tin truy cập:
echo.
echo  ┌────────────────────────────────────────────────────────┐
echo  │  🌐 Dashboard    : http://localhost:3000              │
echo  │  🤖 Flask API    : http://localhost:5000              │
echo  │  🔌 WebSocket    : ws://localhost:8765                │
echo  │  📡 MQTT Broker  : localhost:1883                     │
echo  └────────────────────────────────────────────────────────┘
echo.
echo  ── Để xem trên điện thoại ──────────────────────────────────
echo.
echo  Truy cập IP LAN trên điện thoại (vd: http://192.168.1.62:3000)
echo.
echo  Nhấn phím bất kỳ để đóng cửa sổ này...
pause > nul
