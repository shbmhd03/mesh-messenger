<div align="center">

# 🌐 MeshQ — Mesh Messenger

**Decentralized, Offline-First, End-to-End Encrypted Mesh Communication Platform**

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.1-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5.0-000000?style=for-the-badge&logo=fastify&logoColor=white)](https://fastify.dev/)
[![Convex](https://img.shields.io/badge/Convex-Cloud_DB-FF5722?style=for-the-badge&logo=database&logoColor=white)](https://convex.dev/)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

<p align="center">
  <a href="#-key-features">Key Features</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-protocol-specifications">Protocol</a> •
  <a href="#-project-structure">Project Structure</a>
</p>

---

</div>

## 📖 About MeshQ

**MeshQ** is a next-generation peer-to-peer mesh messaging application engineered for privacy, resiliency, and offline communications. Designed with a sleek **WhatsApp / Telegram inspired aesthetic**, MeshQ enables secure real-time messaging, group chat channels, QR code peer invitations, and stealth privacy modes across dynamic mesh topology connections.

Whether online via high-speed WebSockets and WebRTC signaling or offline using store-and-forward message queues powered by **Convex.dev Cloud Database**, MeshQ guarantees unbroken end-to-end encrypted delivery.

---

## ✨ Key Features

### 🎨 Modern WhatsApp & Telegram Aesthetic UI
- **Dark Mode Glassmorphic Design**: Curated HSL color palette, smooth micro-animations, wallpaper patterns, and speech bubble tails.
- **Real-Time Delivery Indicators**: Single checkmark (`Sent / Server Queued`) and double checkmark (`Delivered / Read`) delivery status badges.
- **In-Chat Search & Filters**: Live message text searching, tab filtering (`All`, `Unread`, `Online`, `Bridge`), and voice/video calling overlays.

### 📷 QR Code Peer Invites & Camera Scanner
- **My QR Code**: Generate your personal Node ID QR Code (`mesh://invite/<NODE_ID>`) with instant copy link & image download options.
- **Scan Peer QR Code**: Integrated live camera stream viewfinder with laser scanner animation & image file dropzone for instant peer pairing.

### 👥 Group Chat & Admin Management
- **Multi-Peer Group Channels**: Create custom group chats, pick initial contacts, and set topic descriptions.
- **Admin Management Controls**: Appoint group admins, add new members, remove members, and manage member roles.
- **Group Info Drawer**: Slide-over panel displaying group details, member rosters, admin status badges, and leave group options.

### 👻 Stealth & Invisible Privacy Mode
- **Vanish from Peer Maps**: Toggle Stealth Mode to conceal your node identity from public discovery graphs.
- **Private Chat Requests**: Send and accept stealth connection authorization requests using custom node codes.

### 🔒 Signal Protocol E2EE Security
- **End-to-End Encryption**: Zero-knowledge packet routing ensures raw payload content is never exposed to relay infrastructure.
- **Safety Numbers & Key Verification**: Verify safety key fingerprints with peer contacts.

### ⚡ Persistent Identity & Storage
- **Reload Resilience**: Node identity (`ownNodeId`), display name, contacts, messages, and stealth preferences automatically persist in `localStorage` across page reloads.

---

## 🏗️ Architecture

MeshQ is structured as a TypeScript monorepo containing core protocol logic, signaling relay server, and modern React web frontend:

```
                          ┌───────────────────────────┐
                          │   MeshQ WebApp (React 19)  │
                          └─────────────┬─────────────┘
                                        │ (WebSocket / WebRTC)
                                        ▼
                          ┌───────────────────────────┐
                          │  @mesh/relay (Fastify WS) │
                          └─────────────┬─────────────┘
                                        │ (Store & Forward Queue)
                                        ▼
                          ┌───────────────────────────┐
                          │   Convex.dev Cloud DB     │
                          └───────────────────────────┘
```

### Monorepo Workspaces

- **`@mesh/core`**: Core cryptographic primitives, packet routing, prekey bundles, and protocol definitions.
- **`@mesh/relay`**: Fastify WebSocket relay router with rate-limiting, WebRTC signaling, and Convex serverless database queues.
- **`@mesh/webapp`**: React 19 web application built with Vite, Zustand state management, and PWA manifest assets.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v20.0.0` or higher
- **npm**: `v10.0.0` or higher

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/shbmhd03/mesh-messenger.git
   cd mesh-messenger
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build all workspaces**:
   ```bash
   npm run build
   ```

---

## 🏃 Running Locally

### Start Web Application (Vite Dev Server)
```bash
npm run dev:webapp
```
The app will open locally at `http://localhost:5173`.

### Start Relay Server (Fastify WebSocket Server)
```bash
npm run dev:relay
```
The relay server will run on port `4800` at `ws://localhost:4800/mesh`.

---

## 📜 Protocol Specifications

MeshQ uses structured JSON payloads encoded over WebSockets & WebRTC data channels:

### 1. Direct / Group Message Packet (`msg` / `group_msg`)
```json
{
  "type": "group_msg",
  "groupId": "group-1721710000-abcd",
  "groupName": "Mesh Developers",
  "id": "m-1721710005-xyz",
  "text": "Hello Mesh Network!",
  "senderName": "Alice",
  "senderId": "A1B2C3D4"
}
```

### 2. Delivery Receipt Packet (`ack`)
```json
{
  "type": "ack",
  "id": "m-1721710005-xyz",
  "status": "read"
}
```

### 3. Group Invite Packet (`group_invite`)
```json
{
  "type": "group_invite",
  "groupId": "group-1721710000-abcd",
  "groupName": "Mesh Developers",
  "groupAdminId": "A1B2C3D4",
  "members": [
    { "nodeId": "A1B2C3D4", "name": "Alice", "role": "admin" },
    { "nodeId": "E5F6G7H8", "name": "Bob", "role": "member" }
  ]
}
```

---

## 📁 Project Structure

```
Mesh Messenger/
├── packages/
│   ├── core/                  # Protocol & encryption types
│   │   ├── src/
│   │   │   ├── identity.ts    # Keypair & identity management
│   │   │   ├── protocol.ts    # Packet schemas & validation
│   │   │   └── routing.ts     # Hop routing logic
│   ├── relay/                 # Fastify WebSocket Relay Router
│   │   ├── src/
│   │   │   ├── server.ts      # Fastify server & socket handlers
│   │   │   └── signaling.ts   # WebRTC signaling router
│   └── webapp/                # React 19 Frontend Web Application
│       ├── src/
│       │   ├── components/    # ChatView, Sidebar, Group & QR Modals
│       │   ├── hooks/         # useRelay WebSocket connection hook
│       │   ├── store/         # Zustand meshStore state manager
│       │   └── styles/        # CSS variables & design tokens
├── convex/                    # Serverless Cloud DB schema & functions
└── package.json               # Monorepo configuration
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more details.
