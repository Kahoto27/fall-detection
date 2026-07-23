#include <Arduino.h>

// --- Pin mapping ---
#define PIN_LED_RED     18
#define PIN_LED_GREEN   19
#define PIN_LED_BLUE    21
#define PIN_BUZZER      25
#define PIN_BUTTON      32

void setup() {
  Serial.begin(115200);
  Serial.println("=== GUARD FALL HARDWARE TEST ===");

  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_BLUE, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_BUTTON, INPUT_PULLUP);

  // Test LED Đỏ & Còi
  Serial.println("1. Test LED Đỏ và Còi (2 giây)...");
  digitalWrite(PIN_LED_RED, HIGH);
  tone(PIN_BUZZER, 2000); // Phát âm thanh 2000Hz
  delay(2000);
  digitalWrite(PIN_LED_RED, LOW);
  noTone(PIN_BUZZER);
  delay(500);

  // Test LED Xanh lá
  Serial.println("2. Test LED Xanh lá (2 giây)...");
  digitalWrite(PIN_LED_GREEN, HIGH);
  delay(2000);
  digitalWrite(PIN_LED_GREEN, LOW);
  delay(500);

  // Test LED Xanh dương
  Serial.println("3. Test LED Xanh dương (2 giây)...");
  digitalWrite(PIN_LED_BLUE, HIGH);
  delay(2000);
  digitalWrite(PIN_LED_BLUE, LOW);

  Serial.println("=== BẤM NÚT ĐỂ TEST CÒI ===");
}

void loop() {
  // Đọc trạng thái nút nhấn (INPUT_PULLUP nên nhấn xuống là LOW)
  if (digitalRead(PIN_BUTTON) == LOW) {
    digitalWrite(PIN_LED_RED, HIGH);
    tone(PIN_BUZZER, 2500); // Kêu to hơn một chút khi bấm
    Serial.println("Nút đang bấm! Còi kêu...");
    
    // Đợi cho đến khi thả nút
    while(digitalRead(PIN_BUTTON) == LOW) {
      delay(10);
    }
    
    // Thả nút ra
    digitalWrite(PIN_LED_RED, LOW);
    noTone(PIN_BUZZER);
    Serial.println("Đã thả nút.");
  }
  
  delay(50);
}
