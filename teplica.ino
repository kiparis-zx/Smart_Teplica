#include <Servo.h>
const int soilPin = A0;
const int lightPin = A1;
const int ledPin = 4;
const int lampPin2 = 7;
const int lampPin1 = 6;
const int analogPin = A2;
const float seriesResistor = 10000.0;
const float nominalResistance = 10000.0;
const float nominalTemperature = 25.0;
const float bCoefficient = 3950.0;
const int adcMax = 1023;
const int pumpPin = 3;

unsigned long pumpLastTime = 0;
unsigned long lampLastTime = 0;
const unsigned long pumpCooldown = 10000;
const unsigned long lampCooldown = 5000;

bool autoMode = true;

Servo myServo;
String input = "";
int currentPosition = 0;

void setup() {
  Serial.begin(9600);
  pinMode(ledPin, OUTPUT);
  myServo.attach(9);
  myServo.write(currentPosition);
  pinMode(pumpPin, OUTPUT);
  
  Serial.println("=== Система управления теплицей ===");
  Serial.println("Режим: " + String(autoMode ? "Автоматический" : "Ручной"));
  Serial.println("Команды:");
  Serial.println("  open/close/open90 - управление окном");
  Serial.println("  on/off - управление насосом");
  Serial.println("  led on/off - управление светодиодом");
  Serial.println("  auto/manual - переключение режима");
  Serial.println("=====================================");
}

void loop() {
  int soilValue = analogRead(soilPin);
  int lightValue = analogRead(lightPin);
  int analogValue = analogRead(analogPin);

  float resistance = seriesResistor * ((adcMax / (float)analogValue) - 1.0);
  float steinhart;
  steinhart = resistance / nominalResistance;     // (R/Ro)
  steinhart = log(steinhart);                     // ln(R/Ro)
  steinhart /= bCoefficient;                      // 1/B * ln(R/Ro)
  steinhart += 1.0 / (nominalTemperature + 273.15); // + (1/To)
  steinhart = 1.0 / steinhart;                    // Инвертируем
  steinhart -= 273.15;                            // Конвертируем в °C                                                     

  Serial.print("Влажность почвы: ");
  Serial.print((1000 - soilValue) / 10);
  Serial.print("%  | Освещенность: ");
  Serial.println(1000 - lightValue);
  Serial.print("Температура: ");
  Serial.print(steinhart);
  Serial.println(" °C");

  if (autoMode) {
    unsigned long currentMillis = millis();
    if (lightValue > 200 && (currentMillis - lampLastTime >= lampCooldown)) {
      digitalWrite(lampPin1, HIGH);
      digitalWrite(lampPin2, HIGH);
      lampLastTime = currentMillis;
      Serial.println("Лампы ВКЛЮЧЕНЫ (авто)");
    } else if (lightValue <= 200 && (currentMillis - lampLastTime >= lampCooldown)) {
      digitalWrite(lampPin1, LOW);
      digitalWrite(lampPin2, LOW);
      lampLastTime = currentMillis;
      Serial.println("Лампы ВЫКЛЮЧЕНЫ (авто)");
    }
    
    if (soilValue > 700 && (currentMillis - pumpLastTime >= pumpCooldown)) {
      digitalWrite(pumpPin, HIGH);
      Serial.println("Насос ВКЛЮЧЕН (авто)");
      delay(5000);
      digitalWrite(pumpPin, LOW);
      pumpLastTime = currentMillis;
      Serial.println("Насос ВЫКЛЮЧЕН (авто)");
    }
  }

  if (Serial.available() > 0) {
    input = Serial.readStringUntil('\n');
    input.trim();

    if (input == "close") {
      myServo.write(0);
      Serial.println("Сервопривод закрыт");
    } else if (input == "open") {
      myServo.write(110);
      Serial.println("Сервопривод открыт");
    } else if (input == "open90") {
      myServo.write(90);
      Serial.println("Сервопривод открыт полностью");
    } else if (input == "on") {
      digitalWrite(pumpPin, HIGH);
      Serial.println("Насос ВКЛЮЧЕН (ручной)");
      delay(100);
    } else if (input == "off") {
      digitalWrite(pumpPin, LOW);
      Serial.println("Насос ВЫКЛЮЧЕН (ручной)");
    } else if (input == "led on") {
      digitalWrite(ledPin, HIGH);
      Serial.println("Светодиод ВКЛЮЧЕН");
    } else if (input == "led off") {
      digitalWrite(ledPin, LOW);
      Serial.println("Светодиод ВЫКЛЮЧЕН");
    } else if (input == "auto") {
      autoMode = true;
      Serial.println("Режим: Автоматический");
    } else if (input == "manual") {
      autoMode = false;
      Serial.println("Режим: Ручной");
    } else {
      Serial.println("Неизвестная команда. Доступные команды:");
      Serial.println("  open/close/open90 - управление окном");
      Serial.println("  on/off - управление насосом");
      Serial.println("  led on/off - управление светодиодом");
      Serial.println("  auto/manual - переключение режима");
    }
  }

  delay(1000);
}