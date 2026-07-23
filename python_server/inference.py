# ============================================================
#  YOLO INFERENCE ENGINE — 2-class: fall / person
#  fall(0) → đỏ/cam, person(1) → xanh lá
# ============================================================

import cv2
import numpy as np
from ultralytics import YOLO
from datetime import datetime
import config

# Màu BGR cho từng class
CLASS_COLORS = {
    "falling" : (0,   0,   255),   # Đỏ — té ngã
    "standing": (0,   220,  80),   # Xanh lá — bình thường
}

# Class kích hoạt cảnh báo
ALERT_CLASSES = {"falling"}


class FallDetector:
    def __init__(self):
        self.model             = YOLO(config.MODEL_PATH)
        self.consecutive_count = 0
        print(f"[Detector] Model: {config.MODEL_PATH}")
        print(f"[Detector] Classes ({self.model.model.nc}): {self.model.names}")

    def predict(self, frame_bytes: bytes) -> dict:
        """
        Nhận JPEG bytes, trả về dict:
          fall_detected, consecutive_count, confidence,
          annotated_frame, detected_classes, dominant_class
        """
        nparr = np.frombuffer(frame_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            return {"error": "Không thể decode ảnh"}

        # Áp dụng bộ lọc CLAHE để tăng cường chi tiết và làm nét ảnh
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        cl = clahe.apply(l)
        limg = cv2.merge((cl, a, b))
        enhanced_frame = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)

        h, w = enhanced_frame.shape[:2]

        results = self.model.predict(
            source  = enhanced_frame,
            conf    = config.CONFIDENCE_THRESHOLD,
            imgsz   = 832,
            verbose = False
        )

        fall_detected    = False
        best_confidence  = 0.0
        annotated_frame  = frame.copy()
        detected_classes = []

        for result in results:
            for box in result.boxes:
                cls_id = int(box.cls[0])
                conf   = float(box.conf[0])
                # Sử dụng nhãn gốc của model (0: fall, 1: person)
                # Đổi tên thành falling và standing cho phù hợp với UI
                raw_label = self.model.names.get(cls_id, "unknown")
                if raw_label == "fall":
                    label = "falling"
                elif raw_label == "person":
                    label = "standing"
                else:
                    label = raw_label

                # Scale tọa độ về ảnh gốc
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                x1 = int(x1 * w / 640); x2 = int(x2 * w / 640)
                y1 = int(y1 * h / 640); y2 = int(y2 * h / 640)

                # BỘ LỌC HÌNH HỌC (Geometric Filter):
                # Khắc phục triệt để lỗi AI nhận diện nhầm người đứng thành té ngã.
                box_w = max(1, x2 - x1)
                box_h = max(1, y2 - y1)
                
                if label == "falling":
                    # Nếu chiều cao lớn hơn bề ngang (tỉ lệ h/w > 0.95), người đó đang đứng thẳng
                    if box_h > box_w * 0.95:
                        label = "standing"  # Ép AI phải nhận là standing!
                        
                color = CLASS_COLORS.get(label, (200, 200, 200))

                # Vẽ bounding box
                thickness = 3 if label == "falling" else 2
                cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, thickness)

                # Label background
                label_text = f"{label} {conf:.0%}"
                (tw, th), _ = cv2.getTextSize(
                    label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.65, 2)
                cv2.rectangle(annotated_frame,
                              (x1, max(0, y1 - th - 10)),
                              (x1 + tw + 8, y1),
                              color, -1)
                cv2.putText(annotated_frame, label_text,
                            (x1 + 4, y1 - 5),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.65, (255, 255, 255), 2)

                detected_classes.append(label)

                if label in ALERT_CLASSES:
                    fall_detected   = True
                    best_confidence = max(best_confidence, conf)

        # Vẽ status bar
        self._draw_status_bar(annotated_frame, fall_detected,
                              best_confidence, detected_classes)

        # Cập nhật bộ đếm liên tiếp (Leaky Bucket)
        if fall_detected:
            self.consecutive_count += 1
        else:
            self.consecutive_count = max(0, self.consecutive_count - 1)

        # Xác định LED state
        if fall_detected:
            dominant_class = "danger"      # LED đỏ nháy
        elif "standing" in detected_classes:
            dominant_class = "normal"      # LED xanh
        else:
            dominant_class = None

        return {
            "fall_detected"     : fall_detected,
            "consecutive_count" : self.consecutive_count,
            "confidence"        : round(best_confidence, 3),
            "annotated_frame"   : annotated_frame,
            "detected_classes"  : detected_classes,
            "dominant_class"    : dominant_class,
        }

    def _draw_status_bar(self, frame, fall_detected, confidence, detected_classes):
        h, w = frame.shape[:2]

        # Nền mờ phía trên
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (w, 52), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)

        # Trạng thái
        if fall_detected:
            status_text = f"!! TE NGA! {confidence:.0%}"
            color = (0, 0, 255)
            # Viền đỏ toàn khung
            cv2.rectangle(frame, (0, 0), (w - 1, h - 1), (0, 0, 255), 4)
        elif detected_classes:
            names = ", ".join(sorted(set(detected_classes)))
            status_text = f"Phat hien: {names}"
            color = (0, 220, 80)
        else:
            status_text = "Dang giam sat..."
            color = (150, 150, 150)

        cv2.putText(frame, status_text,
                    (10, 34),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.8, color, 2)

        # Timestamp góc phải
        ts = datetime.now().strftime("%H:%M:%S")
        cv2.putText(frame, ts,
                    (w - 95, 34),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7, (220, 220, 220), 2)

        # Legend góc dưới phải
        legend = [
            ("falling",  CLASS_COLORS["falling"]),
            ("standing", CLASS_COLORS["standing"]),
        ]
        for i, (name, clr) in enumerate(legend):
            x = w - 110
            y = h - 16 - i * 22
            cv2.rectangle(frame, (x, y - 12), (x + 14, y + 2), clr, -1)
            cv2.putText(frame, name, (x + 18, y),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.48, clr, 1)
