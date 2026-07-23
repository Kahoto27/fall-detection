// ============================================================
//  CONFIG — GuardFall ESP32 System
//  Sửa các giá trị này trước khi nạp firmware
// ============================================================
#pragma once

// --- WiFi ---
#define WIFI_SSID       "Duong"
#define WIFI_PASSWORD   "27102004"

// --- MQTT Broker (IP máy tính chạy Python server) ---
#define MQTT_BROKER     "10.153.191.122"   // ← IP LAN máy tính của bạn
#define MQTT_PORT       1883
#define MQTT_CLIENT_ID  "esp32-guardfall"

// --- MQTT Topics ---
#define TOPIC_ALERT     "fall/alert"
#define TOPIC_BUZZER    "fall/buzzer"
#define TOPIC_LED       "fall/led"
#define TOPIC_STATUS    "fall/status"
#define TOPIC_EMERGENCY "fall/emergency"
#define TOPIC_COMMAND   "fall/command"
#define TOPIC_MONITORING "fall/monitoring"
#define TOPIC_CONTACTS  "fall/contacts"

// --- Pin mapping (đã kiểm tra trên mạch thật) ---
//  LED RGB (common cathode): HIGH = sáng
#define PIN_LED_RED     18    // LED Red
#define PIN_LED_GREEN   19    // LED Green
#define PIN_LED_BLUE    21    // LED Blue
//  Còi passive buzzer
#define PIN_BUZZER      25    // Buzzer
//  Nút khẩn cấp
#define PIN_BUTTON      32    // INPUT_PULLUP, ngắt FALLING
//  SIM A7680C — Serial2
//  ESP RX=17 ← SIM TX | ESP TX=16 → SIM RX
#define PIN_SIM_RX      17    // ESP32 Serial2 RX (nối với SIM TX)
#define PIN_SIM_TX      16    // ESP32 Serial2 TX (nối với SIM RX)
#define PIN_SIM_RST     4     // Reset SIM module (Active LOW)

// --- SIM 4G ---
#define ENABLE_SIM      1      // 0: Tắt SIM (chế độ mô phỏng), 1: Bật SIM (chế độ thực tế)
#define SIM_BAUD        115200

// --- Timing ---
#define HEARTBEAT_INTERVAL_MS  10000   // 10 giây gửi heartbeat
#define BUTTON_DEBOUNCE_MS     300     // debounce nút nhấn
#define BUZZER_AUTO_OFF_MS     30000   // tự tắt còi sau 30 giây
#define WIFI_RECONNECT_MS      5000    // thử kết nối lại WiFi
#define SIM_CMD_TIMEOUT_MS     5000    // timeout AT command
