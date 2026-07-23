// ============================================================
//  BUTTON ISR — Emergency Button Handler
//  GPIO 33, INPUT_PULLUP, ngắt FALLING
// ============================================================
#pragma once
#include <Arduino.h>
#include "config.h"

// Flag từ ISR → đọc trong loop()
static volatile bool _buttonPressed = false;
static volatile uint32_t _lastBtnTime = 0;

// ── ISR handler ───────────────────────────────────────────────
void IRAM_ATTR buttonISR() {
  uint32_t now = millis();
  // Debounce: bỏ qua nếu < BUTTON_DEBOUNCE_MS từ lần trước
  if (now - _lastBtnTime > BUTTON_DEBOUNCE_MS) {
    _buttonPressed = true;
    _lastBtnTime   = now;
  }
}

// ── Init ─────────────────────────────────────────────────────
void buttonInit() {
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_BUTTON),
                  buttonISR,
                  FALLING);
  Serial.println("[Button] Nút khẩn cấp GPIO " + String(PIN_BUTTON) + " sẵn sàng");
}

// ── Kiểm tra trong loop() ─────────────────────────────────────
// Trả về true nếu nút vừa được nhấn (chỉ báo 1 lần)
bool buttonWasPressed() {
  if (_buttonPressed) {
    _buttonPressed = false;
    return true;
  }
  return false;
}
