# ============================================================
#  FLASK SERVER — AI + Webcam + Stream + REST API + WebSocket
#  Entry point: python server.py
# ============================================================

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from inference import FallDetector
from alert_dispatcher import AlertDispatcher
import websocket_server as ws
import config
import threading
import time
import queue
import cv2
import numpy as np
from datetime import datetime
from collections import deque
import threading
import telegram_bot
import os

app = Flask(__name__)
CORS(app) # Cho phép tất cả các nguồn (bao gồm ngrok)

detector   = FallDetector()
dispatcher = AlertDispatcher()

# Webcam state
webcam_running = False
webcam_thread  = None
_start_time    = time.time()

# MJPEG frame queue (maxsize=1 để luôn dùng frame mới nhất)
frame_queue = queue.Queue(maxsize=1)

HISTORY_FILE = "data/history.json"

def _load_history():
    import os, json
    if not os.path.exists(HISTORY_FILE): return []
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []

def _save_history(history):
    import os, json
    os.makedirs("data", exist_ok=True)
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)

# Lịch sử té ngã (tối đa 20 sự kiện)
fall_history: list[dict] = _load_history()

# Trạng thái cảnh báo
last_alert_time = 0
is_emergency_state = False

# FPS tracking
_fps_counter = 0
_fps_value   = 0.0
_fps_ts      = time.time()


# ── WEBCAM LOOP ───────────────────────────────────────────────
def process_alert_async(frame_buffer_copy, result_confidence, result_annotated, buffer_bytes):
    description = "YOLOv8 phát hiện té ngã."
    print(f"[YOLOv8] CẢNH BÁO TÉ NGÃ: {description}")
        
    global is_emergency_state
    is_emergency_state = True
    dispatcher.set_led("red")
    
    _add_to_history(result_confidence, description)
    
    # 1. Gửi báo động NGAY LẬP TỨC xuống ESP32 và Dashboard
    dispatcher.dispatch(
        confidence      = result_confidence,
        annotated_frame = result_annotated,
        history         = fall_history,
    )
    dispatcher.broadcast_history(fall_history)
    
    # 2. Ghi video và gửi Telegram chạy ngầm tiếp để không làm nghẽn báo động
    def save_and_send():
        os.makedirs("evidence", exist_ok=True)
        video_path = f"evidence/fall_{int(time.time())}.mp4"
        if len(frame_buffer_copy) > 0:
            height, width, _ = frame_buffer_copy[0].shape
            out = cv2.VideoWriter(video_path, cv2.VideoWriter_fourcc(*'mp4v'), 30, (width, height))
            for f in frame_buffer_copy:
                out.write(f)
            out.release()
        
        telegram_bot.send_telegram_photo(buffer_bytes, f"🚨 PHÁT HIỆN TÉ NGÃ!\n\nMô tả: {description}\nĐộ tin cậy YOLO: {result_confidence*100:.1f}%")
        if os.path.exists(video_path):
            telegram_bot.send_telegram_video(video_path, "Bằng chứng Video (10 giây trước sự cố)")

    threading.Thread(target=save_and_send, daemon=True).start()


def webcam_loop():
    global webcam_running, _fps_counter, _fps_value, _fps_ts, last_alert_time

    # Kết nối camera chính
    print(f"[Webcam] Khởi tạo camera với INDEX={config.WEBCAM_INDEX}")
    cap = cv2.VideoCapture(config.WEBCAM_INDEX)
    
    # Ép buộc độ phân giải để đảm bảo tốc độ
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    
    if not cap.isOpened():
        print(f"[Webcam] KHÔNG THỂ MỞ CAMERA INDEX {config.WEBCAM_INDEX}!")
        webcam_running = False
        return

    print(f"[Webcam] Bắt đầu lấy luồng hình ảnh")
    dispatcher.notify_monitoring(True)
    
    # Ring buffer lưu 10 giây video ở 30 FPS
    frame_buffer = deque(maxlen=300)
    interval_sec = 1.0 / config.WEBCAM_FPS

    while webcam_running:
        ret, frame = cap.read()
        if not ret:
            print("[Webcam] Mất kết nối camera, đang thử lại...")
            time.sleep(1)
            # Thử reconnect
            cap.open(url if 'rtsp' in url else config.WEBCAM_INDEX)
            continue

        frame_buffer.append(frame.copy())
        
        _, buffer = cv2.imencode(".jpg", frame)
        result    = detector.predict(buffer.tobytes())

        if "error" in result:
            time.sleep(interval_sec if interval_sec > 0 else 0.03)
            continue

        # Điều khiển LED (CHỈ ĐIỀU KHIỂN NẾU CHƯA CÓ BÁO ĐỘNG)
        if not is_emergency_state:
            dom = result.get("dominant_class")
            if dom == "danger":
                dispatcher.set_led("red")
            elif dom == "normal":
                dispatcher.set_led("green")

        # Broadcast detection mỗi frame
        ws.broadcast_detection(
            fall_detected   = result["fall_detected"],
            confidence      = result["confidence"],
            detected_classes= result["detected_classes"],
            consecutive     = result["consecutive_count"],
        )

        # Kích hoạt cảnh báo nếu đủ frame liên tiếp
        if result["consecutive_count"] >= config.FRAME_COUNT_TO_ALERT:
            current_time = time.time()
            if current_time - last_alert_time >= getattr(config, 'ALERT_COOLDOWN_SEC', 30):
                last_alert_time = current_time
                
                # Copy buffer để không bị block loop
                buffer_copy = list(frame_buffer)
                buf_bytes = buffer.tobytes()
                threading.Thread(
                    target=process_alert_async, 
                    args=(buffer_copy, result["confidence"], result["annotated_frame"], buf_bytes),
                    daemon=True
                ).start()
            
            detector.consecutive_count = 0
            frame_buffer.clear() # Tránh spam gọi AI liên tục

        # Đưa annotated frame vào queue để stream MJPEG (fallback)
        if not frame_queue.full():
            frame_queue.put(result["annotated_frame"])

        # FPS tracking
        _fps_counter += 1
        now = time.time()
        if now - _fps_ts >= 5.0:
            _fps_value   = _fps_counter / (now - _fps_ts)
            _fps_counter = 0
            _fps_ts      = now

            uptime = str(int(now - _start_time)) + "s"
            ws.broadcast_status(webcam_running, round(_fps_value, 1), uptime)

        # Bỏ time.sleep() để FPS chạy tối đa theo tốc độ của AI Model
        # time.sleep(interval_sec)

    cap.release()
    webcam_running = False
    dispatcher.notify_monitoring(False)
    dispatcher.set_led("green")
    print("[Webcam] Đã dừng")


def _add_to_history(confidence: float, description: str = ""):
    global fall_history
    msg = f"YOLOv8 phát hiện té ngã. Độ tin cậy: {confidence*100:.1f}%."
    if description:
        msg += f" Mô tả: {description}"
        
    entry = {
        "id"        : f"a-{int(time.time()*1000)}",
        "timestamp" : int(time.time() * 1000),
        "severity"  : "fall",
        "status"    : "active",
        "location"  : "Vị trí giám sát",
        "message"   : msg,
        "smsSent"   : bool(config.SMS_PHONE_NUMBER),
        "responseSeconds": None,
        "confidence": round(confidence * 100, 1),
    }
    fall_history.insert(0, entry)
    if len(fall_history) > 20:
        fall_history = fall_history[:20]
    _save_history(fall_history)


# ── MJPEG STREAM ─────────────────────────────────────────────
def generate_frames():
    blank = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.putText(blank, "Camera chua bat...",
                (140, 240), cv2.FONT_HERSHEY_SIMPLEX,
                1, (120, 120, 120), 2)
    _, blank_buf = cv2.imencode(".jpg", blank)
    blank_bytes  = blank_buf.tobytes()

    while True:
        try:
            frame = frame_queue.get(timeout=1.0)
            _, buffer = cv2.imencode(
                ".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
            data = buffer.tobytes()
        except queue.Empty:
            data = blank_bytes

        yield (b"--frame\r\n"
               b"Content-Type: image/jpeg\r\n\r\n"
               + data
               + b"\r\n")


# ── API ENDPOINTS ────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status"        : "ok",
        "model"         : config.MODEL_PATH,
        "webcam_running": webcam_running,
        "total_alerts"  : len(fall_history),
        "uptime"        : int(time.time() - _start_time),
    })


@app.route("/webcam/start", methods=["GET"])
def webcam_start():
    global webcam_running, webcam_thread
    if webcam_running:
        return jsonify({"status": "already running"})
    webcam_running = True
    webcam_thread  = threading.Thread(target=webcam_loop, daemon=True)
    webcam_thread.start()
    return jsonify({"status": "webcam started"})


@app.route("/webcam/stop", methods=["GET"])
def webcam_stop():
    global webcam_running
    webcam_running = False
    return jsonify({"status": "webcam stopped"})


@app.route("/webcam/status", methods=["GET"])
def webcam_status():
    return jsonify({
        "running": webcam_running,
        "camera" : config.WEBCAM_INDEX,
        "fps"    : round(_fps_value, 1),
    })


@app.route("/video_feed")
def video_feed():
    return Response(
        generate_frames(),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )


@app.route("/history", methods=["GET"])
def get_history():
    return jsonify({"history": fall_history})


@app.route("/history/clear", methods=["GET"])
def clear_history():
    global fall_history
    fall_history = []
    _save_history(fall_history)
    dispatcher.broadcast_history([])
    return jsonify({"status": "cleared"})


@app.route("/history/<alert_id>/resolve", methods=["GET"])
def resolve_alert(alert_id: str):
    global fall_history, is_emergency_state
    for a in fall_history:
        if a["id"] == alert_id:
            a["status"]          = "resolved"
            a["responseSeconds"] = int(
                (time.time() * 1000 - a["timestamp"]) / 1000)
            break
    _save_history(fall_history)
    ws.broadcast({"type": "history", "history": fall_history})
    
    # Kiểm tra xem còn cảnh báo nào đang active không
    has_active = any(a.get("status") == "active" for a in fall_history)
    if not has_active:
        is_emergency_state = False
        dispatcher._mqtt_publish(config.MQTT_TOPIC_BUZZER, "OFF")
        dispatcher.set_led("green")
        
    return jsonify({"status": "resolved"})


@app.route("/test_alert", methods=["GET"])
def test_alert():
    global is_emergency_state
    is_emergency_state = True
    
    dummy = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.putText(dummy, "TEST ALERT",
                (160, 240), cv2.FONT_HERSHEY_SIMPLEX,
                2, (0, 100, 255), 3)
    _add_to_history(0.99)
    dispatcher.dispatch(confidence=0.99,
                        annotated_frame=dummy,
                        history=fall_history,
                        is_test=True)
    dispatcher.set_led("red")
    dispatcher._mqtt_publish(config.MQTT_TOPIC_BUZZER, "ON")
    ws.broadcast_emergency("test")
    return jsonify({"status": "test alert sent"})


@app.route("/system/info", methods=["GET"])
def system_info():
    return jsonify({
        "status"        : "running",
        "webcam_running": webcam_running,
        "model"         : config.MODEL_PATH,
        "threshold"     : config.CONFIDENCE_THRESHOLD,
        "frame_trigger" : config.FRAME_COUNT_TO_ALERT,
        "cooldown"      : config.ALERT_COOLDOWN_SEC,
        "total_alerts"  : len(fall_history),
        "fps"           : round(_fps_value, 1),
        "uptime"        : int(time.time() - _start_time),
        "ws_port"       : config.WEBSOCKET_PORT,
    })


@app.route("/api/stats", methods=["GET"])
def api_stats():
    """Thống kê cho charts trong dashboard."""
    from collections import defaultdict
    daily   = defaultdict(int)
    hourly  = defaultdict(int)
    for a in fall_history:
        dt = datetime.fromtimestamp(a["timestamp"] / 1000)
        daily[dt.strftime("%a")]   += 1
        hourly[dt.hour]            += 1
    return jsonify({
        "daily" : [{"day": d, "falls": c} for d, c in daily.items()],
        "hourly": [{"hour": h, "events": c} for h, c in sorted(hourly.items())],
        "total" : len(fall_history),
    })


@app.route("/settings/threshold", methods=["GET"])
def set_threshold():
    value = float(request.args.get("value", 70))
    config.CONFIDENCE_THRESHOLD = value / 100
    return jsonify({"threshold": config.CONFIDENCE_THRESHOLD})


@app.route("/settings/cooldown", methods=["GET"])
def set_cooldown():
    value = int(request.args.get("value", 30))
    config.ALERT_COOLDOWN_SEC = value
    return jsonify({"cooldown": config.ALERT_COOLDOWN_SEC})


@app.route("/settings/phone", methods=["GET"])
def set_phone():
    number = request.args.get("number", "")
    config.SMS_PHONE_NUMBER = number
    return jsonify({"phone": number})


@app.route("/buzzer/off", methods=["GET"])
def buzzer_off():
    from alert_dispatcher import AlertDispatcher
    dispatcher._mqtt_publish(config.MQTT_TOPIC_BUZZER, "OFF")
    ws.broadcast({"type": "buzzer", "state": "off",
                  "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")})
    return jsonify({"status": "buzzer off"})

@app.route("/system/reset", methods=["GET"])
def system_reset():
    global is_emergency_state, fall_history
    is_emergency_state = False
    
    # Resolve all active alerts
    for a in fall_history:
        if a.get("status") == "active":
            a["status"] = "resolved"
            a["responseSeconds"] = int((time.time() * 1000 - a["timestamp"]) / 1000)
    _save_history(fall_history)
    ws.broadcast({"type": "history", "history": fall_history})
    
    from alert_dispatcher import AlertDispatcher
    dispatcher._mqtt_publish(config.MQTT_TOPIC_BUZZER, "OFF")
    dispatcher.set_led("green")
    ws.broadcast({"type": "buzzer", "state": "off",
                  "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")})
    return jsonify({"status": "system reset"})


# ── CONTACTS API ─────────────────────────────────────────────
import json
import os
CONTACTS_FILE = "data/contacts.json"

def _load_contacts():
    if not os.path.exists(CONTACTS_FILE):
        return []
    try:
        with open(CONTACTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []

def _save_contacts(contacts):
    os.makedirs("data", exist_ok=True)
    with open(CONTACTS_FILE, "w", encoding="utf-8") as f:
        json.dump(contacts, f, ensure_ascii=False, indent=2)

@app.route("/api/contacts", methods=["GET"])
def get_contacts():
    return jsonify(_load_contacts())

@app.route("/api/contacts", methods=["POST"])
def add_contact():
    data = request.json
    contacts = _load_contacts()
    new_contact = {
        "id": f"c-{int(time.time()*1000)}",
        "name": data.get("name", ""),
        "relation": data.get("relation", ""),
        "phone": data.get("phone", ""),
        "priority": len(contacts) + 1,
        "active": data.get("active", True)
    }
    contacts.append(new_contact)
    _save_contacts(contacts)
    dispatcher.broadcast_contacts_to_mqtt()
    return jsonify(new_contact)

@app.route("/api/contacts/<contact_id>", methods=["PUT"])
def toggle_contact(contact_id):
    contacts = _load_contacts()
    for c in contacts:
        if c["id"] == contact_id:
            c["active"] = not c["active"]
            break
    _save_contacts(contacts)
    dispatcher.broadcast_contacts_to_mqtt()
    return jsonify({"status": "success"})

@app.route("/api/contacts/<contact_id>", methods=["DELETE"])
def delete_contact(contact_id):
    contacts = _load_contacts()
    contacts = [c for c in contacts if c["id"] != contact_id]
    _save_contacts(contacts)
    dispatcher.broadcast_contacts_to_mqtt()
    return jsonify({"status": "success"})


# ── MAIN ─────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys

    # Khởi động WebSocket server
    ws.start(host=config.WEBSOCKET_HOST, port=config.WEBSOCKET_PORT)

    print("=" * 55)
    print("  GuardFall — Fall Detection Server")
    print(f"  Flask    : http://{config.FLASK_HOST}:{config.FLASK_PORT}")
    print(f"  WebSocket: ws://{config.WEBSOCKET_HOST}:{config.WEBSOCKET_PORT}")
    print(f"  Model    : {config.MODEL_PATH}")
    print(f"  Video    : http://localhost:{config.FLASK_PORT}/video_feed")
    print("=" * 55)

    app.run(
        host     = config.FLASK_HOST,
        port     = config.FLASK_PORT,
        threaded = True,
        use_reloader = False,
    )
