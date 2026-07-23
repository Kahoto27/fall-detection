// ============================================================
//  LED RGB CONTROLLER — GuardFall ESP32
//  Mạch thật: PIN_LED_RED=18, GREEN=19, BLUE=21
//  Common Cathode: HIGH = sáng, LOW = tắt
//  Dùng digitalWrite (không cần PWM — giống code test đã kiểm tra)
// ============================================================
#pragma once
#include <Arduino.h>
#include "config.h"

enum LedState { LED_OFF, LED_GREEN, LED_YELLOW, LED_RED, LED_BLUE, LED_BLINK_RED };

static LedState _currentLed  = LED_GREEN;
static bool     _blinkOn     = false;
static uint32_t _blinkTimer  = 0;
static uint16_t _blinkPeriod = 400;

// ── Hàm nội bộ ────────────────────────────────────────────────
static void _setRGB(bool r, bool g, bool b) {
  digitalWrite(PIN_LED_RED,   r ? HIGH : LOW);
  digitalWrite(PIN_LED_GREEN, g ? HIGH : LOW);
  digitalWrite(PIN_LED_BLUE,  b ? HIGH : LOW);
}

// ── API công khai ──────────────────────────────────────────────

void ledInit() {
  pinMode(PIN_LED_RED,   OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_BLUE,  OUTPUT);
  _setRGB(false, false, false);
  Serial.println("[LED] Init OK — R=" + String(PIN_LED_RED)
    + " G=" + String(PIN_LED_GREEN)
    + " B=" + String(PIN_LED_BLUE));
}

void ledSet(LedState state, uint16_t blinkMs = 400) {
  _currentLed  = state;
  _blinkPeriod = blinkMs;
  _blinkOn     = true;
  _blinkTimer  = millis();

  switch (state) {
    case LED_OFF:       _setRGB(false, false, false); break; // Tắt
    case LED_GREEN:     _setRGB(false, true,  false); break; // Xanh lá
    case LED_YELLOW:    _setRGB(true,  true,  false); break; // Vàng (R+G)
    case LED_RED:       _setRGB(true,  false, false); break; // Đỏ solid
    case LED_BLUE:      _setRGB(false, false, true ); break; // Xanh dương
    case LED_BLINK_RED: _setRGB(true,  false, false); break; // Đỏ (sẽ nháy trong loop)
  }
}

// Gọi trong loop() để xử lý nhấp nháy
void ledLoop() {
  if (_currentLed != LED_BLINK_RED) return;
  if (millis() - _blinkTimer >= _blinkPeriod) {
    _blinkTimer = millis();
    _blinkOn    = !_blinkOn;
    _setRGB(_blinkOn, false, false);
  }
}

// Parse string từ MQTT topic "fall/led"
void ledSetFromString(const String& color) {
  if      (color == "red")    ledSet(LED_BLINK_RED);
  else if (color == "yellow") ledSet(LED_YELLOW);
  else if (color == "green")  ledSet(LED_GREEN);
  else if (color == "blue")   ledSet(LED_BLUE);
  else if (color == "off")    ledSet(LED_OFF);
  Serial.println("[LED] Set: " + color);
}
