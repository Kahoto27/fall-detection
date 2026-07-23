// ============================================================
//  FALL DETECTION — ESP32 Main Firmware
//  GuardFall System · Nguyễn Vũ Hải Dương · MSSV: 42200226
//
//  Libraries cần cài đặt (Arduino Library Manager):
//    - PubSubClient by Nick O'Leary (v2.8+)
//    - ArduinoJson by Benoît Blanchon (v6+)
//    - WiFi (built-in ESP32)
// ============================================================

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>

#include "config.h"
#include "led_rgb.h"
#include "sim_a7680c.h"
#include "button_isr.h"

// ── Objects ──────────────────────────────────────────────────
WiFiClient   wifiClient;
PubSubClient mqtt(wifiClient);

// ── State ────────────────────────────────────────────────────
bool     wifiConnected   = false;
bool     mqttConnected   = false;
bool     buzzerOn        = false;
uint32_t buzzerStartTime = 0;
uint32_t lastBuzzerBeep  = 0;
uint32_t lastHeartbeat   = 0;
uint32_t lastWifiCheck   = 0;

// ── Danh bạ ──────────────────────────────────────────────────
Preferences preferences;
String phoneList[MAX_PHONES];
int phoneCount = 0;

void loadContacts() {
  preferences.begin("guardfall", false);
  String jsonStr = preferences.getString("contacts", "[]");
  preferences.end();

  DynamicJsonDocument doc(1024);
  if (deserializeJson(doc, jsonStr) == DeserializationError::Ok) {
    JsonArray arr = doc.as<JsonArray>();
    phoneCount = 0;
    for (JsonVariant v : arr) {
      if (phoneCount < MAX_PHONES) {
        phoneList[phoneCount++] = v.as<String>();
      }
    }
    Serial.println("[NVS] Đã tải " + String(phoneCount) + " số điện thoại từ bộ nhớ");
  }
}

// ── Prototypes ────────────────────────────────────────────────
void connectWiFi();
void connectMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void handleFallAlert(float confidence, bool isTest = false);
void handleEmergencyButton();
void publishHeartbeat();
void setBuzzer(bool on);


// ╔══════════════════════════════════════════════════════════╗
//  SETUP
// ╚══════════════════════════════════════════════════════════╝
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println();
  Serial.println("========================================");
  Serial.println("  GuardFall ESP32 — Fall Detection");
  Serial.println("  MSSV: 42200226");
  Serial.println("========================================");

  // Khởi tạo ngoại vi
  ledInit();
  ledSet(LED_BLUE);       // Đang khởi động
  buttonInit();
  setBuzzer(false);
  pinMode(PIN_BUZZER, OUTPUT);

  // Tải danh bạ từ chip nhớ
  loadContacts();

  // Khởi tạo SIM 4G
#if ENABLE_SIM
  simInit();
  if (simIsReady()) {
    Serial.println("[SIM] Module A7680C sẵn sàng");
    int sig = simGetSignal();
    Serial.println("[SIM] Cường độ sóng: " + String(sig));
  } else {
    Serial.println("[SIM] Cảnh báo: Module không phản hồi");
  }
#else
  Serial.println("[SIM] Đã TẮT module SIM (Chế độ mô phỏng)");
#endif

  // Kết nối WiFi
  connectWiFi();

  // Cấu hình MQTT
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(512);

  if (wifiConnected) {
    connectMQTT();
  }

  ledSet(LED_GREEN);      // Sẵn sàng
  Serial.println("[System] Khởi động hoàn tất — Đang giám sát...");
}


// ╔══════════════════════════════════════════════════════════╗
//  LOOP
// ╚══════════════════════════════════════════════════════════╝
void loop() {
  uint32_t now = millis();

  // ── Xử lý LED nhấp nháy ──────────────────────────────────
  ledLoop();

  // ── Kiểm tra WiFi ────────────────────────────────────────
  if (now - lastWifiCheck > WIFI_RECONNECT_MS) {
    lastWifiCheck  = now;
    wifiConnected  = (WiFi.status() == WL_CONNECTED);
    if (!wifiConnected) {
      Serial.println("[WiFi] Mất kết nối — thử kết nối lại...");
      connectWiFi();
    }
  }

  // ── Xử lý MQTT ───────────────────────────────────────────
  if (wifiConnected) {
    if (!mqtt.connected()) {
      mqttConnected = false;
      connectMQTT();
    }
    if (mqtt.connected()) {
      mqtt.loop();
      mqttConnected = true;
    }
  }

  // ── Nút khẩn cấp ─────────────────────────────────────────
  if (buttonWasPressed()) {
    Serial.println("[Button] Nút khẩn cấp được nhấn!");
    handleEmergencyButton();
  }

  // ── Nháy còi ─────────────────────────────────────────────
  if (buzzerOn) {
    if (now - lastBuzzerBeep >= 400) {
      lastBuzzerBeep = now;
      tone(PIN_BUZZER, 2000, 200); // Kêu 2000Hz trong 200ms rồi tự tắt (ngắt quãng)
    }
  }

  // ── Heartbeat ────────────────────────────────────────────
  if (now - lastHeartbeat > HEARTBEAT_INTERVAL_MS) {
    lastHeartbeat = now;
    publishHeartbeat();
  }
}


// ╔══════════════════════════════════════════════════════════╗
//  WIFI
// ╚══════════════════════════════════════════════════════════╝
void connectWiFi() {
  Serial.print("[WiFi] Kết nối tới: ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  ledSet(LED_BLUE);

  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println();
    Serial.print("[WiFi] Kết nối thành công! IP: ");
    Serial.println(WiFi.localIP());
    ledSet(LED_GREEN);
  } else {
    wifiConnected = false;
    Serial.println();
    Serial.println("[WiFi] Thất bại — Dùng SIM 4G làm fallback");
    ledSet(LED_YELLOW);
  }
}


// ╔══════════════════════════════════════════════════════════╗
//  MQTT
// ╚══════════════════════════════════════════════════════════╝
void connectMQTT() {
  Serial.print("[MQTT] Kết nối tới ");
  Serial.print(MQTT_BROKER);
  Serial.print(":");
  Serial.println(MQTT_PORT);

  uint8_t retries = 0;
  while (!mqtt.connected() && retries < 3) {
    if (mqtt.connect(MQTT_CLIENT_ID)) {
      Serial.println("[MQTT] Kết nối thành công!");

      // Subscribe các topic
      mqtt.subscribe(TOPIC_ALERT);
      mqtt.subscribe(TOPIC_BUZZER);
      mqtt.subscribe(TOPIC_LED);
      mqtt.subscribe(TOPIC_COMMAND);
      mqtt.subscribe(TOPIC_MONITORING);
      mqtt.subscribe(TOPIC_CONTACTS);

      Serial.println("[MQTT] Đã subscribe: " + String(TOPIC_ALERT)
        + ", " + TOPIC_BUZZER + ", " + TOPIC_LED + ", " + TOPIC_CONTACTS);

      // Thông báo online
      mqtt.publish(TOPIC_STATUS, "{\"status\":\"online\",\"device\":\"ESP32-GuardFall\"}");
    } else {
      Serial.print("[MQTT] Lỗi, rc=");
      Serial.println(mqtt.state());
      delay(2000);
    }
    retries++;
  }
}

// ── MQTT Callback ─────────────────────────────────────────────
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String topicStr  = String(topic);
  String payloadStr = "";
  for (unsigned int i = 0; i < length; i++) {
    payloadStr += (char)payload[i];
  }

  Serial.println("[MQTT] " + topicStr + " → " + payloadStr);

  // fall/led: green | yellow | red | off
  if (topicStr == TOPIC_LED) {
    ledSetFromString(payloadStr);
    return;
  }

  // fall/buzzer: ON | OFF
  if (topicStr == TOPIC_BUZZER) {
    setBuzzer(payloadStr == "ON");
    return;
  }

  // fall/alert: JSON với confidence
  if (topicStr == TOPIC_ALERT) {
    DynamicJsonDocument doc(512);
    if (deserializeJson(doc, payloadStr) == DeserializationError::Ok) {
      float conf = doc["confidence"] | 0.0f;
      bool is_test = doc["is_test"] | false;
      handleFallAlert(conf / 100.0f, is_test); // convert % → 0-1
    } else {
      handleFallAlert(0.7f, false);
    }
    return;
  }

  // fall/contacts: Cập nhật danh sách số điện thoại
  if (topicStr == TOPIC_CONTACTS) {
    DynamicJsonDocument doc(1024);
    if (deserializeJson(doc, payloadStr) == DeserializationError::Ok) {
      JsonArray arr = doc.as<JsonArray>();
      phoneCount = 0;
      for (JsonVariant v : arr) {
        if (phoneCount < MAX_PHONES) {
          phoneList[phoneCount++] = v.as<String>();
        }
      }
      // Lưu vào NVS
      preferences.begin("guardfall", false);
      preferences.putString("contacts", payloadStr);
      preferences.end();
      
      Serial.println("[MQTT] Đã cập nhật " + String(phoneCount) + " số điện thoại vào bộ nhớ");
    }
    return;
  }

  // esp32/command
  if (topicStr == TOPIC_COMMAND) {
    if (payloadStr == "buzzer_off") setBuzzer(false);
    else if (payloadStr == "reset") {
      setBuzzer(false);
      ledSet(LED_GREEN);
    }
    else if (payloadStr == "test") {
      Serial.println("[CMD] Test: LED đỏ nháy 3s");
      ledSet(LED_BLINK_RED);
      setBuzzer(true);
      delay(3000);
      setBuzzer(false);
      ledSet(LED_GREEN);
    }
    return;
  }
}


// ╔══════════════════════════════════════════════════════════╗
//  ALERT HANDLERS
// ╚══════════════════════════════════════════════════════════╝
void handleFallAlert(float confidence, bool isTest) {
  Serial.println("[FALL] Phát hiện té ngã! Độ tin cậy: " + String(confidence * 100, 1) + "%" + (isTest ? " (TEST)" : ""));

  // 1. LED đỏ nháy + còi
  ledSet(LED_BLINK_RED);
  setBuzzer(true);

  if (isTest) {
    Serial.println("[SIM] Đây là lệnh TEST từ Web, bỏ qua việc gửi SMS.");
    return;
  }

  // 2. Gửi SMS qua SIM 4G (Chỉ gửi khi có sự cố thật)
#if ENABLE_SIM
  Serial.println("[SIM] Gửi SMS 4G cảnh báo té ngã");
  simSendFallAlert(confidence);
#else
  Serial.println("[SIM] (SIM đang TẮT ở chế độ mô phỏng)");
#endif
}

void handleEmergencyButton() {
  // 1. LED đỏ nháy + còi ngay lập tức
  ledSet(LED_BLINK_RED);
  setBuzzer(true);

  // 2. Publish MQTT (nếu có WiFi)
  if (mqttConnected) {
    String payload = "{\"event\":\"EMERGENCY_BUTTON\",\"source\":\"button\"}";
    mqtt.publish(TOPIC_EMERGENCY, payload.c_str());
    Serial.println("[MQTT] Đã publish emergency");
  }

  // 3. Gửi SMS khẩn cấp qua SIM 4G (Luôn gửi đồng thời)
#if ENABLE_SIM
  Serial.println("[SIM] Gửi SMS khẩn cấp (Nút nhấn)");
  simSendEmergency();
#else
  Serial.println("[SIM] (SIM đang TẮT ở chế độ mô phỏng)");
#endif
}


// ╔══════════════════════════════════════════════════════════╗
//  UTILITIES
// ╚══════════════════════════════════════════════════════════╝
void setBuzzer(bool on) {
  buzzerOn = on;
  if (on) {
    buzzerStartTime = millis();
    lastBuzzerBeep = 0; // Để loop() kích hoạt còi ngay
  } else {
    noTone(PIN_BUZZER);
    digitalWrite(PIN_BUZZER, LOW);
  }
  Serial.println("[Buzzer] " + String(on ? "BẬT" : "TẮT"));
}

void publishHeartbeat() {
  if (!mqttConnected) return;

  DynamicJsonDocument doc(512);
  doc["status"]      = "online";
  doc["wifi"]        = wifiConnected;
  doc["ip"]          = WiFi.localIP().toString();
  doc["rssi"]        = WiFi.RSSI();
  doc["buzzer"]      = buzzerOn;
  doc["uptime_s"]    = millis() / 1000;
  doc["free_heap"]   = ESP.getFreeHeap();

  String payload;
  serializeJson(doc, payload);
  mqtt.publish(TOPIC_STATUS, payload.c_str());
  Serial.println("[Heartbeat] " + payload);
}
