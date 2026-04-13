// ================================================
// ESP32 - ESD Scheduling Device (Fixed Version)
// Device ID: farazTest8
// ================================================

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// ================== WiFi Credentials ==================
const char* ssid = "Office-Wifi";
const char* password = "ICT@Lucky";

// ================== Server Details ==================
const char* websocket_server = "192.168.137.165";
const int websocket_port = 5051;
const char* websocket_path = "/ws/scheduling";

// ================== Device Info ==================
const String deviceId = "farazTest8";
const String deviceType = "ESD";

WebSocketsClient webSocket;

bool deviceState = false;
unsigned long lastSendTime = 0;
const long sendInterval = 60000;

unsigned long lastStatusTime = 0;
const long statusInterval = 10000;  // every 10 seconds

// ====================== SETUP ======================
void setup() {
  Serial.begin(115200);
  delay(2000);

  Serial.println("\n=== ESP32 ESD Starting ===");

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi Connected!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  webSocket.begin(websocket_server, websocket_port, websocket_path);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

// ====================== LOOP ======================
void loop() {
  webSocket.loop();

  if (deviceState && millis() - lastSendTime >= sendInterval) {
    sendRandomSensorData();
    lastSendTime = millis();
  }

  if (millis() - lastStatusTime >= statusInterval) {
    sendDeviceStatus();
    lastStatusTime = millis();
  }
}

// ================== Send Sensor Data ==================
void sendRandomSensorData() {
  if (!webSocket.isConnected()) return;

  float temp = random(25, 45) + random(0, 9) / 10.0;
  float hum = random(40, 85) + random(0, 9) / 10.0;
  float curr = random(2, 15) + random(0, 9) / 10.0;
  float volt = random(210, 245) + random(0, 9) / 10.0;

  StaticJsonDocument<512> doc;
  doc["deviceId"] = deviceId;
  doc["deviceType"] = deviceType;
  doc["temperature"] = temp;
  doc["humidity"] = hum;
  doc["current"] = curr;
  doc["voltage"] = volt;
  doc["temperatureAlert"] = (temp > 40) ? "HIGH" : "NORMAL";
  doc["humidityAlert"] = (hum > 70) ? "HIGH" : "NORMAL";
  doc["currentAlert"] = (curr > 10) ? "HIGH" : "NORMAL";
  doc["voltageAlert"] = (volt < 210 || volt > 240) ? "HIGH" : "NORMAL";

  String jsonString;
  serializeJson(doc, jsonString);
  webSocket.sendTXT(jsonString);

  Serial.println("📤 Data Sent");
}

// ================== WebSocket Events ==================
void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {

    case WStype_DISCONNECTED:
      Serial.println("❌ WebSocket Disconnected");
      break;

    case WStype_CONNECTED:
      Serial.println("✅ WebSocket Connected");

      // Strong Handshake with proper scope
      {
        StaticJsonDocument<128> handshake;
        handshake["deviceId"] = deviceId;
        handshake["deviceType"] = deviceType;
        handshake["action"] = "HANDSHAKE";

        String hs;
        serializeJson(handshake, hs);
        webSocket.sendTXT(hs);
        Serial.println("📤 Handshake Sent: " + hs);
      }
      break;

    case WStype_TEXT:
      {
        String msg = String((char*)payload);
        Serial.println("📥 Received: " + msg);

        StaticJsonDocument<256> doc;
        if (deserializeJson(doc, msg) != DeserializationError::Ok) {
          Serial.println("JSON Parse Error");
          break;
        }

        if (doc.containsKey("command")) {
          String cmd = doc["command"].as<String>();

          if (cmd == "ON") {
            deviceState = true;
            lastSendTime = millis();
            Serial.println("🔴 DEVICE TURNED ON");
          } else if (cmd == "OFF") {
            deviceState = false;
            Serial.println("⚫ DEVICE TURNED OFF");
          }

          sendAcknowledgment(cmd);
        }
      }
      break;
  }
}

// ================== Acknowledgment ==================
void sendAcknowledgment(String command) {
  StaticJsonDocument<200> doc;
  doc["deviceId"] = deviceId;
  doc["status"] = command;
  doc["ack"] = true;

  String json;
  serializeJson(doc, json);
  webSocket.sendTXT(json);
  Serial.println("✅ Ack Sent: " + command);
}

void sendDeviceStatus() {
  if (!webSocket.isConnected()) return;

  StaticJsonDocument<200> doc;
  doc["deviceId"] = deviceId;
  doc["deviceType"] = deviceType;
  doc["state"] = deviceState ? "ON" : "OFF";

  String json;
  serializeJson(doc, json);
  webSocket.sendTXT(json);

  Serial.println("📡 Status Sent: " + json);
}