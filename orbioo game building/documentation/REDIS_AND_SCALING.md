# 🚀 Orbioo Engine: Redis & Multi-Process Scaling (V1.4.9)

This document explains the architectural shift from a single-process server to a **Multi-Process Redis Cluster**. This setup allows the Orbioo engine to handle thousands of players by distributing the load across all available CPU cores.

---

## 🧠 1. How Redis Works (The "Shared Brain")

In a standard setup, each CPU worker is isolated. If "Player A" is on Core 1, they can't see a room on Core 2. **Redis** solves this by acting as a central hub.

### The Two Components:
1.  **`RedisPresence`**: Acts as a global "Message Bus." When one server instance needs to broadcast a message to everyone (like a global chat or a cross-server event), it sends it through Redis.
2.  **`RedisDriver`**: Acts as the "Global Room Registry." The matchmaker stores all active room IDs and player counts in Redis. This allows a player connecting to *any* CPU core to see *all* active rooms across the entire cluster.

---

## 🛠 2. What We Implemented

*   **Dynamic Fallback**: The engine checks for `REDIS_URL` in your `.env`. If it's missing, it automatically switches to `LocalPresence` so you can still code offline without Redis.
*   **Production Compilation**: We now compile TypeScript to clean JavaScript (`npm run build`) before running, which removes the massive overhead of `ts-node`.
*   **PM2 Clustering**: We use PM2 to spawn a "Worker" for every CPU core on your machine. PM2 handles the load balancing at port `2567`.
*   **Bot Immortality**: For stress-testing, bots with names starting with `Bot_` are now invincible, ensuring stable connection counts during testing.

---

## 📈 3. Real-Time Performance Monitoring

To see how your server is breathing under load, use these tools:

### A. PM2 Dashboard (The "Matrix" View)
This is the best way to see CPU/RAM per core.
```powershell
npx pm2 monit
```
*   **What to look for**: Watch the CPU % and Heap Size. If one core is at 100% while others are at 10%, PM2 is successfully load-balancing new connections to the idle cores.

### B. PM2 List (The Quick Table)
```powershell
npx pm2 list
```

### C. Colyseus Monitor (Visual View)
Open your browser to:
👉 **`http://localhost:2567/monitor`**
*   This shows you exactly which rooms are alive, how many players are in each, and the internal state of the game.

---

## 🧪 4. Running the 500-Player Stress Test

To verify the scaling, run this command in a separate terminal. It joins bots slowly (staggered) to avoid crashing the network stack.

```powershell
npx tsx src/loadtest/example.ts --endpoint ws://localhost:2567 --room orbioo --numClients 500 --delay 100
```

---

## ⚙️ 5. Maintenance Commands

| Task | Command |
| :--- | :--- |
| **Start/Update Cluster** | `npm run build && npx pm2 restart ecosystem.config.cjs` |
| **Stop Server** | `npx pm2 stop all` |
| **View Logs** | `npx pm2 logs` |
| **Clean Logs** | `npx pm2 flush` |
| **Check Redis (Docker)** | `docker ps` |

---

**Current Status**: Clustered, Compiled, and Redis-Powered.
**Version**: 1.4.9
