# Orbioo Engine - Technical Changelog & Architecture
**Current Version:** V1.5.8
**Framework:** Colyseus + Node.js (TypeScript) + Redis + PM2

---

## 🚀 1. Smart Handshake & "Warm Start" (V1.4.3)
To eliminate the "Ghost Spawn" bug (where players spawn in empty areas before the grid syncs), we implemented a multi-stage handshake:

1. **State Handshake**: Client joins and enters `loadingOverlay` mode.
2. **Pre-Spawn Anchor**: The server assigns a spawn coordinate *before* the player appears, forcing the AOI system to track that location.
3. **Warm Start Baking**: The server manually refreshes and broadcasts the binary food data for the 64 sectors surrounding the spawn point.
4. **Client Ready**: The client waits for at least 50 food items to arrive. 
5. **Safety Timeout**: If sync takes > 2.0s, the client forces a spawn to prevent infinite loading.

## 🛡️ 2. Spawn Protection & Invulnerability
Designed to prevent "spawn camping" while maintaining fair gameplay.

- **Duration**: 3 seconds.
- **Immunity**: The player cannot eat others and cannot be eaten.
- **Visuals**: A Neon Cyan pulse/glow effect (handled in `render.js`).
- **Auto-Cancel**: The shield expires immediately if:
    - The player moves the mouse significantly (>1 unit).
    - The player presses Space (Split) or W (Eject).

## 📦 3. Binary Grid Synchronization (V1.4.5)
We optimized how food is sent to the client to handle high player counts (500+).

- **Old Method**: Individual `FoodSchema` objects (Very slow at 10,000+ items).
- **New Method (V1.4.5)**: 
    - **Encoding**: 3-byte packets `[X_Rel, Y_Rel, Hue/2]` packed into a binary buffer.
    - **Transport**: Buffer converted to `Base64` string for 100% browser/load-test compatibility.
    - **Decoding**: Client uses `atob()` and reads raw indexes.
- **Performance**: Reduces grid synchronization bandwidth by ~70%.

## 📱 4. Mobile Landscape UI Optimizations
Specific CSS overrides for mobile users in landscape mode:

- **Chat Toggle**: Positioned at `top: 20%; left: 15px;` to stay clear of the bottom-left joystick.
- **Chat Window**: Uses `flex-direction: column` to grow **downward**, keeping the top-left debug logs visible.
- **Safe Zones**: Adjusted `cellSize` and list heights to prevent UI overlap on small vertical screens.

## 🧪 5. Stress Testing & Scalability
Verified via `@colyseus/loadtest` with 500 active bots.

- **Room Limit**: `maxClients = 50`.
- **Overflow Logic**: Colyseus automatically spawns **10 rooms** to handle 500 players.
- **Bot Behavior**: Bots move in smooth jittery patterns and **auto-respawn** immediately upon being eaten to maintain server pressure.
- **Command**:
  ```powershell
  npx tsx src/loadtest/example.ts --endpoint ws://localhost:2567 --room orbioo --numClients 500
  ```

---
## 🏢 6. Cluster Architecture & Scaling (V1.5.0)
Scaled the engine to handle thousands of concurrent players using a distributed worker pattern.

- **Workers**: 4 independent processes managed by PM2.
- **State Sync**: Redis used for cross-room messaging and room list synchronization.
- **Port Mapping**: Sequential mapping from 2567 to 2570 for clean load-balancing.
- **Monitoring**: Heartbeat ping every 2 seconds sends CCU/RoomCount to PM2 process metrics.

## 🛑 7. Authoritative AFK Inactivity System (V1.5.8)
Implemented to protect server resources and map clarity while being fair to users.

- **Focus-Aware**: Timer tracks window focus. Inbound mouse movements are ignored while out-of-focus.
- **Phase 1 (0-60s)**: Grace period. Timer visible, but gameplay remains normal.
- **Phase 2 (60-120s)**: Proportional decay (5x multiplier) triggered if mass > 400.
- **Phase 3 (120s)**: Auto-kick with server-side broadcast message.

---
*Last Updated: 2026-05-04 (V1.5.8 Stable)*
