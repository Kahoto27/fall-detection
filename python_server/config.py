# ============================================================
#  CẤU HÌNH TRUNG TÂM — GuardFall System
#  Đọc secrets từ .env, fallback về giá trị mặc định
# ============================================================

import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def make_absolute(path):
    if not path: return path
    if os.path.isabs(path): return path
    return os.path.join(BASE_DIR, path)

# --- Flask Server ---
FLASK_HOST = os.getenv("FLASK_HOST", "0.0.0.0")
FLASK_PORT = int(os.getenv("FLASK_PORT", 5000))

# --- WebSocket Server ---
WEBSOCKET_HOST = os.getenv("WEBSOCKET_HOST", "0.0.0.0")
WEBSOCKET_PORT = int(os.getenv("WEBSOCKET_PORT", 8765))

# --- Webcam ---
WEBCAM_INDEX  = int(os.getenv("WEBCAM_INDEX", "1"))
WEBCAM_WIDTH  = 640
WEBCAM_HEIGHT = 480
WEBCAM_FPS    = 30  # Tăng FPS vì đọc từ luồng go2rtc rất nhẹ

# --- go2rtc ---
GO2RTC_URL = os.getenv("GO2RTC_URL", "rtsp://0.0.0.0:8554/webcam")

# --- Model AI (2-class: fall / person) ---
MODEL_PATH           = make_absolute(os.getenv("MODEL_PATH", "trained_models/best.pt"))
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.55"))
FRAME_COUNT_TO_ALERT = int(os.getenv("FRAME_COUNT_TO_ALERT", "2"))
ALERT_COOLDOWN_SEC   = int(os.getenv("ALERT_COOLDOWN_SEC", "30"))

# --- MQTT ---
MQTT_BROKER       = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT         = int(os.getenv("MQTT_PORT", "1883"))
MQTT_TOPIC_ALERT  = "fall/alert"
MQTT_TOPIC_BUZZER = "fall/buzzer"
MQTT_TOPIC_LED    = "fall/led"
MQTT_TOPIC_STATUS = "fall/status"
MQTT_TOPIC_HISTORY= "fall/history"
MQTT_TOPIC_EMERGENCY = "fall/emergency"
MQTT_TOPIC_CONTACTS = "fall/contacts"

# --- Telegram ---
TELEGRAM_TOKEN   = os.getenv("TELEGRAM_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

# --- SMS / SIM ---
SMS_PHONE_NUMBER = os.getenv("SMS_PHONE_NUMBER", "")

# --- Lưu trữ ---
EVIDENCE_DIR = make_absolute(os.getenv("EVIDENCE_DIR", "evidence"))
LOG_FILE     = make_absolute(os.getenv("LOG_FILE", "logs/fall_log.txt"))
