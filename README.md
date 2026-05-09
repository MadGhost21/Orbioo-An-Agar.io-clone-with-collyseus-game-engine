# 🌌 Orbioo Open Source – Multiplayer Agario-style Game
by MadGhost21, a work done on this previous project: https://github.com/owenashurst/agar.io-clone

Welcome to **Orbioo Open Source**, a high-performance, authoritative multiplayer Agario-style game built with **Node.js**, **Colyseus**, and **HTML5 Canvas**. 

This project provides a complete end-to-end solution for a modern multiplayer IO game, including a scalable server-side engine and a responsive, feature-rich frontend.

---

## 🏗️ Architecture & Technology Stack

Orbioo is divided into two main components that work in tandem:

### 1. ⚙️ [Orbioo Colyseus Engine](./orbioo%20%20collyseus%20engine/)
The "brain" of the game. It is a dedicated, authoritative server built on the **Colyseus** framework.
- **Authoritative Logic**: All physics, cell collisions, and game rules are calculated on the server to prevent cheating.
- **Colyseus Framework**: Manages the game state, room synchronization, and real-time messaging between players.
- **High Performance**: Optimized spatial partitioning and binary synchronization for smooth gameplay with many players.
- **Scalability**: Supports cluster scaling using PM2 and Redis.

### 2. 🎨 [Orbioo Game Building](./orbioo%20game%20building/)
The frontend client where players interact with the game.
- **HTML5 Canvas**: Optimized rendering engine for high-FPS gameplay.
- **Real-time Client**: Connects to the Colyseus engine via WebSockets.
- **Skin Studio**: A built-in system for selecting and previewing skins.
- **Gulp Build System**: Modern development workflow with fast rebuilds and optimization.

---

## 🧬 How it Works

### 🔗 Connection Flow
1. **Handshake**: The client (`app.js`) initiates a WebSocket connection to the Colyseus engine using the `Colyseus.Client` SDK.
2. **Room Join**: Players are assigned to a game room (e.g., `agario`).
3. **State Sync**: The server sends the initial game state. From then on, only "diffs" (changes) are sent to save bandwidth.
4. **Input Handling**: The client sends player movement and actions (split, eject) to the server.
5. **Reconciliation**: The server validates the inputs and updates the master state, which is then synced back to all clients.

### 🎮 Gameplay Features
- **Dynamic Camera**: Smooth follow-camera with auto-zoom based on cell size.
- **Modular Skin System**: Easily add new skins via a data-driven registry.
- **Debug & Stats Logs**: Integrated toggles in the settings menu to monitor performance and network traffic.
- **Anti-Cheat AOI**: Area of Interest logic that only sends data for cells currently visible to the player.

---

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (LTS recommended)
- [npm](https://www.npmjs.com/)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/orbioo-open-source.git
   cd orbioo-open-source
   ```

2. **Install Dependencies**:
   You need to install dependencies in both the engine and client folders:
   ```bash
   cd "orbioo collyseus engine"
   npm install
   cd "../orbioo game building"
   npm install
   ```

3. **Run for Development**:
   - Start the Engine:
     ```bash
     cd "orbioo collyseus engine"
     npm run dev
     ```
   - Start the Client:
     ```bash
     cd "orbioo game building"
     npm run dev
     ```

---

## 📜 Documentation
- 🛡️ **[AFK System](./orbioo%20%20collyseus%20engine/docs/AFK_SYSTEM.md)**
- 🚀 **[Scaling & Redis](./orbioo%20%20collyseus%20engine/docs/REDIS_AND_SCALING.md)**
- 🎨 **[Skin System](./orbioo%20game%20building/SKINS_SYSTEM.md)**
- 📷 **[Camera Logic](./orbioo%20game%20building/CAMERA_SYSTEM.md)**

---

## 📄 License
This project is licensed under the **MIT License**.
