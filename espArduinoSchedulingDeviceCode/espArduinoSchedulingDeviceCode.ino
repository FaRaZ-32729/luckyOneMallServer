// // ================================================
// // ESP32 - ESD Scheduling Device (Fixed Version)
// // Device ID: farazTest8
// // ================================================

// #include <WiFi.h>
// #include <WebSocketsClient.h>
// #include <ArduinoJson.h>

// // ================== WiFi Credentials ==================
// // const char* ssid = "Office-Wifi";
// const char* ssid = "FaRaZ";
// // const char* password = "ICT@Lucky";
// const char* password = "faraz32729";

// // ================== Server Details ==================
// // const char* websocket_server = "192.168.137.165";
// const char* websocket_server = " 10.174.91.154";
// const int websocket_port = 5051;
// const char* websocket_path = "/ws/scheduling";

// // ================== Device Info ==================
// const String deviceId = "farazTest8";
// const String deviceType = "ESD";

// WebSocketsClient webSocket;

// bool deviceState = false;
// unsigned long lastSendTime = 0;
// const long sendInterval = 60000;

// unsigned long lastStatusTime = 0;
// const long statusInterval = 10000;  // every 10 seconds

// // ====================== SETUP ======================
// void setup() {
//   Serial.begin(115200);
//   delay(2000);

//   Serial.println("\n=== ESP32 ESD Starting ===");

//   WiFi.begin(ssid, password);
//   while (WiFi.status() != WL_CONNECTED) {
//     delay(500);
//     Serial.print(".");
//   }
//   Serial.println("\n✅ WiFi Connected!");
//   Serial.print("IP: ");
//   Serial.println(WiFi.localIP());

//   webSocket.begin(websocket_server, websocket_port, websocket_path);
//   webSocket.onEvent(webSocketEvent);
//   webSocket.setReconnectInterval(5000);
// }

// // ====================== LOOP ======================
// void loop() {
//   webSocket.loop();

//   if (deviceState && millis() - lastSendTime >= sendInterval) {
//     sendRandomSensorData();
//     lastSendTime = millis();
//   }

//   if (millis() - lastStatusTime >= statusInterval) {
//     sendDeviceStatus();
//     lastStatusTime = millis();
//   }
// }

// // ================== Send Sensor Data ==================
// void sendRandomSensorData() {
//   if (!webSocket.isConnected()) return;

//   float temp = random(25, 45) + random(0, 9) / 10.0;
//   float hum = random(40, 85) + random(0, 9) / 10.0;
//   float curr = random(2, 15) + random(0, 9) / 10.0;
//   float volt = random(210, 245) + random(0, 9) / 10.0;

//   StaticJsonDocument<512> doc;
//   doc["deviceId"] = deviceId;
//   doc["deviceType"] = deviceType;
//   doc["temperature"] = temp;
//   doc["humidity"] = hum;
//   doc["current"] = curr;
//   doc["voltage"] = volt;
//   doc["temperatureAlert"] = (temp > 40) ? "HIGH" : "NORMAL";
//   doc["humidityAlert"] = (hum > 70) ? "HIGH" : "NORMAL";
//   doc["currentAlert"] = (curr > 10) ? "HIGH" : "NORMAL";
//   doc["voltageAlert"] = (volt < 210 || volt > 240) ? "HIGH" : "NORMAL";

//   String jsonString;
//   serializeJson(doc, jsonString);
//   webSocket.sendTXT(jsonString);

//   Serial.println("📤 Data Sent");
// }

// // ================== WebSocket Events ==================
// void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
//   switch (type) {

//     case WStype_DISCONNECTED:
//       Serial.println("❌ WebSocket Disconnected");
//       break;

//     case WStype_CONNECTED:
//       Serial.println("✅ WebSocket Connected");

//       // Strong Handshake with proper scope
//       {
//         StaticJsonDocument<128> handshake;
//         handshake["deviceId"] = deviceId;
//         handshake["deviceType"] = deviceType;
//         handshake["action"] = "HANDSHAKE";

//         String hs;
//         serializeJson(handshake, hs);
//         webSocket.sendTXT(hs);
//         Serial.println("📤 Handshake Sent: " + hs);
//       }
//       break;

//     case WStype_TEXT:
//       {
//         String msg = String((char*)payload);
//         Serial.println("📥 Received: " + msg);

//         StaticJsonDocument<256> doc;
//         if (deserializeJson(doc, msg) != DeserializationError::Ok) {
//           Serial.println("JSON Parse Error");
//           break;
//         }

//         if (doc.containsKey("command")) {
//           String cmd = doc["command"].as<String>();

//           if (cmd == "ON") {
//             deviceState = true;
//             lastSendTime = millis();
//             Serial.println("🔴 DEVICE TURNED ON");
//           } else if (cmd == "OFF") {
//             deviceState = false;
//             Serial.println("⚫ DEVICE TURNED OFF");
//           }

//           sendAcknowledgment(cmd);
//         }
//       }
//       break;
//   }
// }

// // ================== Acknowledgment ==================
// void sendAcknowledgment(String command) {
//   StaticJsonDocument<200> doc;
//   doc["deviceId"] = deviceId;
//   doc["status"] = command;
//   doc["ack"] = true;

//   String json;
//   serializeJson(doc, json);
//   webSocket.sendTXT(json);
//   Serial.println("✅ Ack Sent: " + command);
// }

// void sendDeviceStatus() {
//   if (!webSocket.isConnected()) return;

//   StaticJsonDocument<200> doc;
//   doc["deviceId"] = deviceId;
//   doc["deviceType"] = deviceType;
//   doc["state"] = deviceState ? "ON" : "OFF";

//   String json;
//   serializeJson(doc, json);
//   webSocket.sendTXT(json);

//   Serial.println("📡 Status Sent: " + json);
// }



// ================================================
// ESP32 - ESD Scheduling Device (Full Self-Scheduling Version with NTP)
// Device ID: farazTest8
// Features:
//   • Receives ON command + endTimeUnix from backend
//   • Auto-OFF via NTP even when completely disconnected from server
//   • Works with your existing backend reconciliation
// ================================================

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <time.h>          // ← NTP support

// ================== WiFi Credentials ==================
const char* ssid = "FaRaZ";
const char* password = "faraz32729";

// ================== Server Details ==================
const char* websocket_server = "10.174.91.154";
const int websocket_port = 5051;
const char* websocket_path = "/ws/scheduling";

// ================== Device Info ==================
const String deviceId = "farazTest8";
const String deviceType = "ESD";

WebSocketsClient webSocket;

// ================== Scheduling & State Variables ==================
bool deviceState = false;
uint32_t scheduledEndTime = 0;        // Unix timestamp (seconds) for auto-OFF

unsigned long lastSendTime = 0;
const long sendInterval = 60000;      // 60 seconds

unsigned long lastStatusTime = 0;
const long statusInterval = 10000;    // 10 seconds

// ====================== SETUP ======================
void setup() {
  Serial.begin(115200);
  delay(2000);

  Serial.println("\n=== ESP32 ESD Self-Scheduling Device Starting ===");
  Serial.println("Device ID: " + deviceId);

  // ================== WiFi Connection ==================
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi Connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  // ================== NTP Time Sync (Asia/Karachi) ==================
  Serial.println("⏳ Setting up NTP (Asia/Karachi UTC+5)...");
  configTime(5 * 3600, 0, "pool.ntp.org", "time.google.com", "time.windows.com");

  time_t now = time(nullptr);
  while (now < 1000000000) {   // Wait for valid time (> year 2001)
    delay(500);
    now = time(nullptr);
    Serial.print(".");
  }
  Serial.println("\n✅ NTP Synced! Current Unix time: " + String(now));

  // ================== WebSocket Connection ==================
  webSocket.begin(websocket_server, websocket_port, websocket_path);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);

  Serial.println("🚀 ESP32 ready for scheduling!");
}

// ====================== MAIN LOOP ======================
void loop() {
  webSocket.loop();

  // ================== AUTO-OFF via NTP (works offline!) ==================
  if (deviceState && scheduledEndTime > 0) {
    time_t currentTime = time(nullptr);
    if (currentTime > 1000000000 && currentTime >= scheduledEndTime) {
      deviceState = false;
      scheduledEndTime = 0;
      Serial.println("⏰ NTP Auto-OFF Triggered! End time reached locally.");
      
      // Send updated status to server if connected
      if (webSocket.isConnected()) {
        sendDeviceStatus();
      }
    }
  }

  // ================== Periodic Sensor Data (only when ON) ==================
  if (deviceState && millis() - lastSendTime >= sendInterval) {
    sendRandomSensorData();
    lastSendTime = millis();
  }

  // ================== Periodic Status Report ==================
  if (millis() - lastStatusTime >= statusInterval) {
    sendDeviceStatus();
    lastStatusTime = millis();
  }
}

// ================== Send Random Sensor Data ==================
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

  Serial.println("📤 Sensor Data Sent");
}

// ================== WebSocket Event Handler ==================
void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {

    case WStype_DISCONNECTED:
      Serial.println("❌ WebSocket Disconnected");
      break;

    case WStype_CONNECTED:
      Serial.println("✅ WebSocket Connected");

      // Strong Handshake
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

        StaticJsonDocument<512> doc;
        if (deserializeJson(doc, msg) != DeserializationError::Ok) {
          Serial.println("❌ JSON Parse Error");
          break;
        }

        // ================== COMMAND FROM BACKEND ==================
        if (doc.containsKey("command")) {
          String cmd = doc["command"].as<String>();

          if (cmd == "ON") {
            deviceState = true;
            lastSendTime = millis();

            // ←←← NEW: Store end time for local NTP auto-OFF
            if (doc.containsKey("endTimeUnix")) {
              scheduledEndTime = doc["endTimeUnix"].as<uint32_t>();
              Serial.printf("📅 Scheduled Auto-OFF at Unix timestamp: %lu\n", scheduledEndTime);
            } else {
              Serial.println("⚠️ ON command received without endTimeUnix");
            }

            Serial.println("🔴 DEVICE TURNED ON");
          } 
          else if (cmd == "OFF") {
            deviceState = false;
            scheduledEndTime = 0;        // Clear any pending schedule
            Serial.println("⚫ DEVICE TURNED OFF");
          }

          sendAcknowledgment(cmd);
        }
      }
      break;
  }
}

// ================== Send Acknowledgment ==================
void sendAcknowledgment(String command) {
  StaticJsonDocument<200> doc;
  doc["deviceId"] = deviceId;
  doc["status"] = command;
  doc["ack"] = true;

  String json;
  serializeJson(doc, json);
  webSocket.sendTXT(json);
  Serial.println("✅ Ack Sent for: " + command);
}

// ================== Send Device Status ==================
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