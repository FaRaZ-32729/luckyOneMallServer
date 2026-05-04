# 🚀 IoT Device Scheduling & Monitoring Backend (Node.js + Express + BullMQ)

---

## 📌 Overview

This backend system is designed for **IoT device management**, supporting:

* 🔌 Real-time device communication (WebSockets)
* ⏱️ Scheduled ON/OFF automation (BullMQ + Redis)
* 📊 Sensor monitoring (temperature, humidity, AQI, gas, etc.)
* ⚠️ Alert aggregation per venue & organization
* 👥 Role-based user & organization management
* 🔐 Authentication & authorization (JWT)

---

## 🧱 Tech Stack

* **Node.js + Express.js**
* **MongoDB + Mongoose**
* **Redis + BullMQ (Job Queue)**
* **WebSockets (ws)**
* **JWT Authentication**
* **Nodemailer (Email Service)**

---

## 📁 Project Structure

```
src/
 ├── controllers/
 ├── models/
 ├── routes/
 ├── middlewere/
 ├── utils/
 ├── queues/
 ├── config/
server.js
```

---

## ⚙️ Environment Variables (.env)

Create a `.env` file:

```
PORT=5051
MONGODB_URL=your_mongodb_url
REDIS_URL=your_redis_url
JWT_SECRET=your_secret

BASE_URL=http://localhost:5051

SMTP_HOST=your_smtp_host
SMTP_PORT=465
SMTP_USER=your_email
SMTP_PASS=your_password

FRONTEND_URL=http://localhost:5173
```

---

## ▶️ Installation & Setup

### 1. Install dependencies

```
npm install
```

### 2. Start Redis

Make sure Redis is running locally or via cloud.

### 3. Start server

```
node server.js
```

### 4. Start Worker (IMPORTANT)

```
node src/workers/scheduleWorker.js
```

---

## 🔌 WebSocket Endpoints

| Endpoint         | Purpose                      |
| ---------------- | ---------------------------- |
| `/ws/alerts`     | Sensor data from ESP devices |
| `/ws/scheduling` | Device control & scheduling  |

---

## 🔐 Authentication Guide

### 🔑 Login Required APIs

These APIs require JWT token (via cookie or Bearer token):

---

### 👤 Auth Routes

| API                    | Method | Auth |
| ---------------------- | ------ | ---- |
| `/auth/login`          | POST   | ❌    |
| `/auth/register`       | POST   | ✅    |
| `/auth/logout`         | DELETE | ✅    |
| `/auth/verify/me`      | GET    | ✅    |

---

### 👥 User Routes

| API           | Auth |
| ------------- | ---- |
| Get all users | ✅    |
| Update user   | ✅    |
| Delete user   | ✅    |
| Add venue     | ✅    |

---

### 🏢 Organization Routes

| API                 | Auth      |
| ------------------- | --------- |
| Create organization | ✅ (Admin) |
| Get organizations   | ✅         |
| Update              | ✅         |
| Delete              | ✅         |

---

### 🏬 Venue Routes

| API          | Auth |
| ------------ | ---- |
| Create venue | ✅    |
| Get venues   | ✅    |
| Update venue | ✅    |
| Delete venue | ✅    |

---

### 📟 Device Routes

| API           | Auth |
| ------------- | ---- |
| Add device    | ✅    |
| Update device | ✅    |
| Delete device | ✅    |
| Toggle device | ✅    |

---

### 📅 Schedule (Event) Routes

| API              | Auth |
| ---------------- | ---- |
| Create schedule  | ✅    |
| Skip event       | ✅    |
| Enable/Disable   | ✅    |
| Get schedules    | ✅    |
| Delete schedule  | ✅    |
| Get current/next | ✅    |

---

### ⚠️ Special Case (NO AUTH)

| API              | Reason                    |
| ---------------- | ------------------------- |
| `/event/trigger` | Used internally by worker |

---

### 🚨 Alert Routes

| API        | Auth |
| ---------- | ---- |
| Get alerts | ✅    |

---

## ⏱️ Scheduling System Flow

1. User creates schedule
2. Cron generated
3. Job added to BullMQ
4. Worker executes job
5. Calls `/event/trigger`
6. Command sent to ESP via WebSocket

---

## 🔄 Skip Event Logic

* Skips current running schedule
* Saves skip in DB
* Prevents worker from executing that schedule
* Immediately turns OFF device

---

## 📡 Device Communication Flow

### ESP → Server

* Sends sensor data
* Updates MongoDB
* Generates alerts

### Server → ESP

* Sends ON/OFF commands
* Includes schedule  + end time (for auto OFF handled by NTP SERVER ESP)

---

## 📊 Alert System

Alerts generated based on:

* Temperature
* Humidity
* Odour
* AQI
* Gas leakage

Grouped by:

* Venue
* Organization

---

## 🧠 Smart Features

* ✅ Missed schedule recovery (reconnect logic)
* ✅ Real-time device sync
* ✅ ACK handling (device confirms state)
* ✅ Midnight crossover scheduling
* ✅ Skip per day logic

---

## 🚀 Future Improvements

* Device offline detection
* Retry mechanism for failed jobs
* Dashboard with real-time updates
* Role-based access refinement
* WebSocket authentication

---

## 🧪 Testing Tips

* Use Postman for APIs
* Use WebSocket clients for ESP simulation
* Test schedules with short intervals

---

## 👨‍💻 Author

**FaRaZ Sial**
Backend Developer (Node.js, IoT Systems)

---

## 📄 License

This project is for internal/production use.
