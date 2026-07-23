# ============================================================
#  ALERT DISPATCHER — MQTT + Telegram + WebSocket + LED
# ============================================================

import os
import time
import threading
import json
import requests
import cv2
import paho.mqtt.client as mqtt
from datetime import datetime
import config
import websocket_server as ws


class AlertDispatcher:
    def __init__(self):
        self.last_alert_time = 0
        os.makedirs(config.EVIDENCE_DIR, exist_ok=True)
        os.makedirs("logs", exist_ok=True)

        # MQTT client
        self.mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        self.mqtt_client.on_connect = self._on_mqtt_connect
        self.mqtt_client.on_message = self._on_mqtt_message
        self._mqtt_connected = False
        try:
            self.mqtt_client.connect(config.MQTT_BROKER, config.MQTT_PORT)
            self.mqtt_client.loop_start()
            self._mqtt_connected = True
            print(f"[MQTT] Kết nối tới {config.MQTT_BROKER}:{config.MQTT_PORT}")
        except Exception as e:
            print(f"[MQTT] Không khả dụng: {e} — Sẽ dùng WebSocket thay thế")

    def _on_mqtt_connect(self, client, userdata, flags, rc, properties=None):
        if rc == 0:
            print("[MQTT] Đã kết nối, đang đăng ký lắng nghe ESP32...")
            self.mqtt_client.subscribe(config.MQTT_TOPIC_STATUS)
            self.mqtt_client.subscribe(config.MQTT_TOPIC_EMERGENCY)
            # Đồng bộ số điện thoại xuống ESP32 ngay khi kết nối
            self.broadcast_contacts_to_mqtt()
        else:
            print(f"[MQTT] Lỗi kết nối, rc={rc}")

    def _on_mqtt_message(self, client, userdata, msg):
        topic = msg.topic
        payload = msg.payload.decode("utf-8")
        try:
            data = json.loads(payload)
            if topic == config.MQTT_TOPIC_STATUS:
                # Trạng thái ESP32 gửi lên
                is_online = data.get("status") == "online"
                if is_online:
                    self.broadcast_contacts_to_mqtt()
                ws.broadcast({
                    "type": "esp32_status",
                    "online": is_online,
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                })
            elif topic == config.MQTT_TOPIC_EMERGENCY:
                # Nút nhấn khẩn cấp
                source = data.get("source", "button")
                ws.broadcast_emergency(source)
        except Exception as e:
            print(f"[MQTT] Lỗi xử lý message: {e}")

    # ── Cooldown ──────────────────────────────────────────────
    def should_alert(self) -> bool:
        now = time.time()
        if now - self.last_alert_time >= config.ALERT_COOLDOWN_SEC:
            return True
        remaining = config.ALERT_COOLDOWN_SEC - (now - self.last_alert_time)
        print(f"[Cooldown] Còn {remaining:.0f}s")
        return False

    # ── Dispatch chính ────────────────────────────────────────
    def dispatch(self, confidence: float, annotated_frame, history: list, is_test: bool = False):
        if not self.should_alert() and not is_test:
            return
        self.last_alert_time = time.time()

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        img_path  = f"{config.EVIDENCE_DIR}/fall_{timestamp}.jpg"
        cv2.imwrite(img_path, annotated_frame)
        print(f"[ALERT] Evidence: {img_path}")

        # Ghi log
        if not is_test:
            with open(config.LOG_FILE, "a", encoding="utf-8") as f:
                f.write(f"{timestamp}|{confidence:.3f}|{img_path}\n")

        # Gửi song song
        threading.Thread(
            target=self._send_mqtt_alert,
            args=(confidence, timestamp, is_test),
            daemon=True
        ).start()
        
        if not is_test:
            threading.Thread(
                target=self._send_telegram,
                args=(img_path, confidence, timestamp),
                daemon=True
            ).start()

        # Broadcast WebSocket
        ws.broadcast_alert(confidence, timestamp, img_path, history)

    # ── LED ───────────────────────────────────────────────────
    def set_led(self, color: str):
        """Gửi lệnh LED: green | yellow | red | off"""
        self._mqtt_publish(config.MQTT_TOPIC_LED, color)
        ws.broadcast_led(color)

    # ── Monitoring status ─────────────────────────────────────
    def notify_monitoring(self, active: bool):
        status = "active" if active else "idle"
        self._mqtt_publish("fall/monitoring", status)

    # ── History broadcast ─────────────────────────────────────
    def broadcast_history(self, history: list):
        payload = json.dumps(history, ensure_ascii=False)
        self._mqtt_publish(config.MQTT_TOPIC_HISTORY, payload)

    # ── Contacts broadcast ────────────────────────────────────
    def broadcast_contacts_to_mqtt(self):
        active_phones = []
        try:
            import os, json
            if os.path.exists("data/contacts.json"):
                with open("data/contacts.json", "r", encoding="utf-8") as f:
                    contacts = json.load(f)
                    active_phones = [c["phone"] for c in contacts if c.get("active", False)]
        except Exception as e:
            print(f"[Dispatcher] Lỗi đọc contacts.json: {e}")
        
        payload = json.dumps(active_phones)
        self._mqtt_publish(config.MQTT_TOPIC_CONTACTS, payload)
        print(f"[MQTT] Đã đồng bộ {len(active_phones)} số điện thoại xuống ESP32")

    # ── Emergency (từ ESP32 qua MQTT) ────────────────────────
    def handle_emergency(self):
        ws.broadcast_emergency("button")
        self._mqtt_publish(config.MQTT_TOPIC_BUZZER, "ON")

    # ── MQTT helpers ──────────────────────────────────────────
    def _mqtt_publish(self, topic: str, payload: str):
        if self._mqtt_connected:
            try:
                self.mqtt_client.publish(topic, payload)
            except Exception as e:
                print(f"[MQTT] Lỗi publish {topic}: {e}")

    def _send_mqtt_alert(self, confidence: float, timestamp: str, is_test: bool = False):
        active_phones = []
        try:
            import json, os
            if os.path.exists("data/contacts.json"):
                with open("data/contacts.json", "r", encoding="utf-8") as f:
                    contacts = json.load(f)
                    active_phones = [c["phone"] for c in contacts if c.get("active", False)]
        except Exception as e:
            print(f"[Dispatcher] Lỗi đọc contacts: {e}")

        payload = json.dumps({
            "event"      : "FALL_DETECTED",
            "confidence" : round(confidence * 100, 1),
            "timestamp"  : timestamp,
            "phones"     : active_phones,
            "is_test"    : is_test
        })
        self._mqtt_publish(config.MQTT_TOPIC_ALERT,  payload)
        self._mqtt_publish(config.MQTT_TOPIC_BUZZER, "ON")
        print(f"[MQTT] Cảnh báo gửi thành công (is_test={is_test})")

    def _send_telegram(self, img_path: str, confidence: float, timestamp: str):
        if not config.TELEGRAM_TOKEN or not config.TELEGRAM_CHAT_ID:
            print("[Telegram] Chưa cấu hình token/chat_id")
            return
        msg = (
            f"\u26a0\ufe0f CẢNH BÁO TÉ NGÃ!\n"
            f"Thời điểm : {timestamp}\n"
            f"Độ tin cậy: {confidence*100:.1f}%\n"
            f"Hệ thống  : GuardFall ESP32"
        )
        try:
            url = f"https://api.telegram.org/bot{config.TELEGRAM_TOKEN}/sendPhoto"
            with open(img_path, "rb") as photo:
                requests.post(
                    url,
                    data={"chat_id": config.TELEGRAM_CHAT_ID, "caption": msg},
                    files={"photo": photo},
                    timeout=10
                )
            print("[Telegram] Ảnh cảnh báo đã gửi")
        except Exception as e:
            print(f"[Telegram] Lỗi: {e}")
