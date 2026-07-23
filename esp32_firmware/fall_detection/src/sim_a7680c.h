// ============================================================
//  SIM A7680C — AT Command Helper
//  Giao tiếp qua Serial2 (RX=16, TX=17)
// ============================================================
#pragma once
#include <Arduino.h>
#include "config.h"

#define MAX_PHONES 5
extern String phoneList[MAX_PHONES];
extern int phoneCount;

// ── Init ─────────────────────────────────────────────────────
void simInit() {
  // RX=17 (nhận từ SIM TX), TX=16 (gửi đến SIM RX)
  Serial2.begin(SIM_BAUD, SERIAL_8N1, PIN_SIM_RX, PIN_SIM_TX);
  // Xóa buffer cũ
  while (Serial2.available()) Serial2.read();

  // Reset module
  pinMode(PIN_SIM_RST, OUTPUT);
  digitalWrite(PIN_SIM_RST, LOW);
  delay(200);
  digitalWrite(PIN_SIM_RST, HIGH);
  delay(3000); // Chờ SIM khởi động

  Serial.println("[SIM] Đang khởi động...");
}

// ── Gửi AT command, đợi response ─────────────────────────────
String simSendAT(const String& cmd, uint32_t timeoutMs = SIM_CMD_TIMEOUT_MS) {
  // Xóa buffer cũ
  while (Serial2.available()) Serial2.read();

  Serial2.println(cmd);
  Serial.print("[SIM→] "); Serial.println(cmd);

  String response = "";
  uint32_t start  = millis();

  while (millis() - start < timeoutMs) {
    while (Serial2.available()) {
      char c = (char)Serial2.read();
      response += c;
    }
    if (response.indexOf("OK") >= 0 ||
        response.indexOf("ERROR") >= 0 ||
        response.indexOf(">") >= 0) {
      break;
    }
    delay(10);
  }

  Serial.print("[SIM←] "); Serial.println(response);
  return response;
}

// ── Kiểm tra SIM ready ───────────────────────────────────────
bool simIsReady() {
  String r = simSendAT("AT", 2000);
  return r.indexOf("OK") >= 0;
}

// ── Lấy cường độ sóng (0-31) ─────────────────────────────────
int simGetSignal() {
  String r = simSendAT("AT+CSQ", 2000);
  // Response: +CSQ: 18,0
  int idx = r.indexOf("+CSQ:");
  if (idx < 0) return -1;
  int val = r.substring(idx + 6).toInt();
  return val; // 99 = không có sóng
}

// ── Gửi SMS ──────────────────────────────────────────────────
bool simSendSMS(const String& phone, const String& message) {
  Serial.println("[SIM] Chuẩn bị gửi SMS tới: " + phone);

  // Chế độ text
  if (simSendAT("AT+CMGF=1").indexOf("OK") < 0) {
    Serial.println("[SIM] Lỗi set text mode");
    return false;
  }

  // Encoding UTF-8 (hỗ trợ tiếng Việt qua GSM7 hoặc UCS2)
  simSendAT("AT+CSCS=\"GSM\"");

  // Số điện thoại
  String cmd = "AT+CMGS=\"" + phone + "\"";
  String r   = simSendAT(cmd, 5000);
  if (r.indexOf(">") < 0) {
    Serial.println("[SIM] Không nhận được dấu '>'");
    return false;
  }

  // Nội dung tin nhắn + Ctrl+Z để kết thúc
  Serial2.print(message);
  Serial2.write(0x1A); // Ctrl+Z
  Serial.println("[SIM] Đã gửi nội dung SMS");

  // Đợi CMGS confirm
  String confirm = "";
  uint32_t start = millis();
  while (millis() - start < 15000) {
    while (Serial2.available()) confirm += (char)Serial2.read();
    if (confirm.indexOf("+CMGS:") >= 0 || confirm.indexOf("ERROR") >= 0) break;
    delay(100);
  }

  bool ok = confirm.indexOf("+CMGS:") >= 0;
  Serial.println(ok ? "[SIM] SMS gửi thành công!" : "[SIM] SMS thất bại!");
  return ok;
}

// ── Hàm tiện lợi: gửi SMS cảnh báo té ngã ───────────────────
void simSendFallAlert(float confidence) {
  String msg =
    "CANH BAO TE NGA!\n"
    "He thong GuardFall phat hien te nga.\n"
    "Do tin cay: " + String(confidence * 100, 1) + "%\n"
    "Vui long kiem tra ngay!";
  if (phoneCount == 0) {
    Serial.println("[SIM] KHÔNG THỂ GỬI: Danh bạ trống!");
    return;
  }
  for (int i = 0; i < phoneCount; i++) {
    simSendSMS(phoneList[i], msg);
  }
}

// ── Hàm tiện lợi: gửi SMS khẩn cấp (bấm nút) ────────────────
void simSendEmergency() {
  String msg =
    "KHAN CAP!\n"
    "Nguoi dung bam nut khan cap.\n"
    "He thong GuardFall.\n"
    "Vui long lien he ngay!";
  if (phoneCount == 0) {
    Serial.println("[SIM] KHÔNG THỂ GỬI: Danh bạ trống!");
    return;
  }
  for (int i = 0; i < phoneCount; i++) {
    simSendSMS(phoneList[i], msg);
  }
}
