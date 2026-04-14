# Tuya Monitor

A modern web application to manage and monitor Tuya smart devices. Built to run on K3S (Kubernetes).

## Features

- 🔐 **Authentication** – JWT-based login with secure password hashing (bcrypt)
- 👥 **User Management** – Admin can create, edit, and delete users; any user can change their own password
- 📱 **Device Dashboard** – View all Tuya devices with their online status and switch state
- 💡 **Device Control** – Toggle devices on/off with a single click
- 🔄 **Auto-Refresh** – Configurable auto-refresh interval (default: 30s) for live device status
- 🔍 **Search & Filter** – Filter devices by name, online status, or switch state
- ⚙️ **Settings** – Store Tuya API credentials and refresh interval locally (JSON files)
- 🌙 **Dark/Light Theme** – Toggle between dark and light mode
- 🐳 **Containerised** – Docker + K3S/Kubernetes manifests included

## Quick Start

### Local (Node.js)

```bash
npm install
npm start
# Open http://localhost:3000
# Default credentials: admin / admin
```

### Docker Compose

```bash
git clone https://github.com/masterlog80/tuya-monitor-copilot
cd tuya-monitor-copilot

yes | docker image prune --all
docker build -t tuya-monitor-copilot .

# Open http://localhost:3000
```

### K3S / Kubernetes

```bash
# Build the image on your K3S node (or push to a registry)
docker build -t tuya-monitor:latest .

# Apply manifests
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml   # optional, adjust host

# Check deployment
kubectl rollout status deployment/tuya-monitor
```

Edit `k8s/ingress.yaml` to set your hostname. The default is `tuya-monitor.local`.

## Configuration

All configuration is stored in JSON files inside the `DATA_DIR` directory (default: `./data/`).

| File | Contents |
|------|----------|
| `data/users.json` | User accounts (bcrypt-hashed passwords) |
| `data/settings.json` | Tuya API credentials + app settings |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `DATA_DIR` | `./data` | Directory for JSON data files |
| `NODE_ENV` | _(unset)_ | Set to `production` in containers |

## Tuya API Setup

1. Sign in to [iot.tuya.com](https://iot.tuya.com)
2. Create a project and note the **Access ID** and **Access Secret**
3. Under **Devices → Link App Account**, link your Tuya app account
4. Enter the credentials in the **Settings** page of the app

### Identifying your account (choose one option)

#### Option A – User Code (recommended, same approach as Home Assistant)

The **User Code** is a short identifier available directly inside the Tuya Smart or Smart Life mobile app. No manual lookup in the developer portal is needed.

1. Open the **Tuya Smart** or **Smart Life** app on your phone
2. Go to **Profile** (bottom-right) → tap your **avatar / username**
3. Tap **User Code** (sometimes under *Settings → Account & Security → User Code*)
4. Copy the code (e.g. `a1b2c3d4e5f6`) and paste it into the **User Code** field in Settings

When a User Code is configured it takes priority. The app uses `grant_type=2` (same as the Tuya integration for Home Assistant) to authenticate and automatically resolves the User ID — no need to enter the User ID separately.

#### Option B – User ID (classic, from the developer portal)

1. Under **Devices → Link App Account** on [iot.tuya.com](https://iot.tuya.com), find your account's **UID**
2. Enter it in the **User ID** field in Settings

## Default Credentials

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin` | Admin |

> **Change the default password immediately via User Management → Change My Password.**

## Development

```bash
npm install
npm run dev       # nodemon auto-reload
npm test          # Jest test suite
```

## Project Structure

```
tuya-monitor/
├── src/
│   ├── app.js              # Express application entry point
│   ├── db.js               # lowdb JSON database setup
│   ├── tuya.js             # Tuya Cloud API client (HMAC-SHA256 signed)
│   ├── middleware/
│   │   └── auth.js         # JWT authentication middleware
│   ├── routes/
│   │   ├── auth.js         # Login / logout
│   │   ├── devices.js      # Device list, status, toggle
│   │   ├── users.js        # User CRUD + password change
│   │   └── settings.js     # Tuya + app settings
│   └── __tests__/
│       └── api.test.js     # Jest + Supertest API tests
├── public/
│   ├── index.html          # Single-page application
│   ├── css/style.css       # Modern responsive CSS
│   └── js/app.js           # Frontend SPA logic
├── k8s/
│   ├── pvc.yaml            # PersistentVolumeClaim for data
│   ├── deployment.yaml     # K3S Deployment
│   ├── service.yaml        # ClusterIP Service
│   └── ingress.yaml        # Traefik Ingress (K3S default)
├── Dockerfile
├── docker-compose.yml
└── package.json
```
## Screenshots

### Login
![Login](https://github.com/user-attachments/assets/b650f645-0541-415b-bd64-8cc84aa3b66c)

### Dashboard
![Dashboard](https://github.com/user-attachments/assets/9ec624a0-5046-4cf6-9e1c-48d6bae8a88f)

### Settings
![Settings](https://github.com/user-attachments/assets/83307a62-d19e-411b-aab0-ff01eb42c273)

### User Management
![Users](https://github.com/user-attachments/assets/0ad1bd40-2e66-4a9d-9947-7a2562496d48)
