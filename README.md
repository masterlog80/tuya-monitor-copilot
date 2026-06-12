# Tuya Monitor

A web application to manage and monitor Tuya smart devices. Features JWT-based authentication, multi-user management, real-time device control, and a dark/light mode UI. Designed to run with Docker Compose or on K3S/Kubernetes.

---

## Features

- 🔐 **Authentication** – JWT-based login with secure password hashing (bcrypt); login/logout with configurable credentials
- 👥 **User management** – Admins can create, edit, and delete users; any user can change their own password
- 📱 **Device dashboard** – View all Tuya devices with online status and switch state
- 💡 **Device control** – Toggle devices on/off with a single click
- 🔄 **Auto-refresh** – Configurable auto-refresh interval (default 30 s) for live device status
- 🔍 **Search & filter** – Filter devices by name, online status, or switch state
- ⚙️ **Settings** – Store Tuya API credentials and refresh interval (persisted to JSON files in `/data`)
- 🌙 **Dark / Light theme** – Toggle with preference persisted in the browser

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- A Tuya IoT Platform account (see [Tuya API Setup](#tuya-api-setup))

### Clone & build

```bash
git clone https://github.com/masterlog80/tuya-monitor-copilot.git
cd tuya-monitor-copilot

yes | docker image prune --all
yes | docker builder prune --all

docker build -t tuya-monitor-copilot .
docker compose -f docker-compose.yml up -d --remove-orphans
```

### Access the UI

```
http://localhost:3000
```

Default credentials: `admin` / `admin` — **change immediately** after first login.

### Uninstall

```bash
# Stop the container (data is preserved in the volume)
docker compose down

# Stop AND remove the persistent volume
docker compose down -v
```

### Usage

1. Log in with `admin` / `admin` and change your password via **User Management → Change My Password**
2. Go to **Settings** and enter your Tuya API credentials (Access ID, Access Secret, User Code or User ID)
3. The **Dashboard** tab shows all linked devices with live status; click a switch to toggle it
4. Use the **Search** bar and status filters to find specific devices

---

## Screenshots

### Login
![Login](https://github.com/user-attachments/assets/b650f645-0541-415b-bd64-8cc84aa3b66c)

### Dashboard
![Dashboard](https://github.com/user-attachments/assets/9ec624a0-5046-4cf6-9e1c-48d6bae8a88f)

### Settings
![Settings](https://github.com/user-attachments/assets/83307a62-d19e-411b-aab0-ff01eb42c273)

### User Management
![Users](https://github.com/user-attachments/assets/0ad1bd40-2e66-4a9d-9947-7a2562496d48)

---

## Docker Compose

```yaml
version: '3.8'

services:
  tuya-monitor:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - tuya-data:/data
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATA_DIR=/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/healthz"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

volumes:
  tuya-data:
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP listen port |
| `DATA_DIR` | `/data` | Directory for JSON data files (`users.json`, `settings.json`) |
| `NODE_ENV` | *(unset)* | Set to `production` in containers |

---

## Tuya API Setup

1. Sign in to [iot.tuya.com](https://iot.tuya.com)
2. Create a project and note the **Access ID** and **Access Secret**
3. Under **Devices → Link App Account**, link your Tuya Smart / Smart Life mobile account
4. Enter the credentials in the **Settings** page of the app

### Finding your User Code (recommended)

Available in the Tuya Smart or Smart Life mobile app: **Profile → tap your avatar → User Code** (or Settings → Account & Security → User Code). When a User Code is configured it takes priority and uses `grant_type=2`.

### Finding your User ID (classic)

On [iot.tuya.com](https://iot.tuya.com) under **Devices → Link App Account**, find your account's **UID** and enter it in the **User ID** field in Settings.

---

## K3S / Kubernetes Deployment

```bash
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml   # edit host before applying

kubectl rollout status deployment/tuya-monitor
```

Edit `k8s/ingress.yaml` to set your hostname (default: `tuya-monitor.local`).

---

## Project Structure

```
tuya-monitor/
├── src/
│   ├── app.js
│   ├── db.js
│   ├── tuya.js               # Tuya Cloud API client (HMAC-SHA256 signed)
│   ├── middleware/auth.js
│   └── routes/
│       ├── auth.js
│       ├── devices.js
│       ├── users.js
│       └── settings.js
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── k8s/
│   ├── pvc.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   └── ingress.yaml
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## License

MIT
