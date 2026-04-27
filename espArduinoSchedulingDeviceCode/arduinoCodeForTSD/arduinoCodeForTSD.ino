#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <time.h>

// ================== WiFi Credentials ==================
// const char* ssid = "Office-Wifi";
const char* ssid = "FaRaZ";
// const char* password = "ICT@Lucky";
const char* password = "faraz32729";

// ================== Server Details ==================
const char* websocket_server = "10.25.153.154";
const int websocket_port = 5051;
const char* websocket_path = "/ws/scheduling";

// ================== Device Info ==================
const String deviceId = "farazTest7";
const String deviceType = "TSD";

WebSocketsClient webSocket;

// ================== Scheduling & State Variables ==================
bool deviceState = false;
uint32_t scheduledEndTime = 0;

unsigned long lastSendTime = 0;
const long sendInterval = 60000;

unsigned long lastStatusTime = 0;
const long statusInterval = 60000;

// ====================== SETUP ======================
void setup() {
  Serial.begin(115200);
  delay(2000);

  Serial.println("\n=== ESP32 TSD Self-Scheduling Device Starting ===");
  Serial.println("Device ID: " + deviceId);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n✅ WiFi Connected!");
  Serial.println(WiFi.localIP());

  // ================== NTP ==================
  configTime(0, 0, "pool.ntp.org", "time.google.com", "time.windows.com");

  time_t now = time(nullptr);
  while (now < 1000000000) {
    delay(500);
    now = time(nullptr);
  }

  Serial.println("\n✅ NTP Synced!");

  // ================== WebSocket ==================
  webSocket.begin(websocket_server, websocket_port, websocket_path);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);

  Serial.println("🚀 TSD Device Ready!");
}

// ====================== LOOP ======================
void loop() {
  webSocket.loop();

  // ================== AUTO OFF ==================
  if (deviceState && scheduledEndTime > 0) {
    time_t currentTime = time(nullptr);
    if (currentTime >= scheduledEndTime) {
      deviceState = false;
      scheduledEndTime = 0;

      Serial.println("⏰ Auto-OFF Triggered (TSD)");

      if (webSocket.isConnected()) {
        sendDeviceStatus();
      }
    }
  }

  // ================== SENSOR DATA ==================
  if (deviceState && millis() - lastSendTime >= sendInterval) {
    sendSensorData();
    lastSendTime = millis();
  }

  // ================== STATUS ==================
  if (millis() - lastStatusTime >= statusInterval) {
    sendDeviceStatus();
    lastStatusTime = millis();
  }
}

// ================== SENSOR DATA (ONLY TEMP + HUMIDITY) ==================
void sendSensorData() {
  if (!webSocket.isConnected()) return;

  float temp = random(20, 40) + random(0, 9) / 10.0;
  float hum = random(40, 80) + random(0, 9) / 10.0;

  StaticJsonDocument<256> doc;
  doc["deviceId"] = deviceId;
  doc["deviceType"] = deviceType;
  doc["temperature"] = temp;
  doc["humidity"] = hum;
  doc["temperatureAlert"] = (temp > 35) ? "HIGH" : "NORMAL";
  doc["humidityAlert"] = (hum > 70) ? "HIGH" : "NORMAL";

  String json;
  serializeJson(doc, json);
  webSocket.sendTXT(json);

  Serial.println("📤 TSD Sensor Data Sent");
}

// ================== WEB SOCKET EVENTS ==================
void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {

    case WStype_CONNECTED:
      Serial.println("✅ WebSocket Connected");

      {
        StaticJsonDocument<128> hs;
        hs["deviceId"] = deviceId;
        hs["deviceType"] = deviceType;
        hs["action"] = "HANDSHAKE";

        String out;
        serializeJson(hs, out);
        webSocket.sendTXT(out);
      }
      break;

    case WStype_TEXT: {
      String msg = String((char*)payload);
      Serial.println("📥 Received: " + msg);

      StaticJsonDocument<256> doc;
      if (deserializeJson(doc, msg)) return;

      if (doc.containsKey("command")) {
        String cmd = doc["command"];

        if (cmd == "ON") {
          deviceState = true;
          lastSendTime = millis();

          if (doc.containsKey("endTimeUnix")) {
            scheduledEndTime = doc["endTimeUnix"];
          }

          Serial.println("🔴 TSD ON");
        }

        else if (cmd == "OFF") {
          deviceState = false;
          scheduledEndTime = 0;
          Serial.println("⚫ TSD OFF");
        }

        sendAck(cmd);
      }
    } break;
  }
}

// ================== ACK ==================
void sendAck(String cmd) {
  StaticJsonDocument<128> doc;
  doc["deviceId"] = deviceId;
  doc["status"] = cmd;
  doc["ack"] = true;

  String json;
  serializeJson(doc, json);
  webSocket.sendTXT(json);
}

// ================== STATUS ==================
void sendDeviceStatus() {
  if (!webSocket.isConnected()) return;

  StaticJsonDocument<128> doc;
  doc["deviceId"] = deviceId;
  doc["deviceType"] = deviceType;
  doc["state"] = deviceState ? "ON" : "OFF";

  String json;
  serializeJson(doc, json);
  webSocket.sendTXT(json);

  Serial.println("📡 Status Sent (TSD)");
}