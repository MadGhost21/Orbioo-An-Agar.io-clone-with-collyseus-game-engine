# 🚀 Orbioo Engine: Cluster & Scaling (V1.5.8)

This document focuses on the multi-worker architecture and real-time monitoring.

## 🏗️ 4-Worker Cluster
We use PM2 to distribute the engine across 4 independent Node.js processes.

- **Port Mapping**:
    - **Worker 0**: Port 2567 (Leader)
    - **Worker 1**: Port 2568
    - **Worker 2**: Port 2569
    - **Worker 3**: Port 2570
- **Redis Sync**: All workers share state via Redis (`RedisPresence` and `RedisDriver`).

## 📊 Real-Time Metrics
The engine sends heartbeats to PM2 every 2 seconds.

- **How to view**: Run `npx pm2 monit` on the server.
- **Metrics Tracked**:
    - `CCU`: Total concurrent users connected to the specific worker.
    - `Rooms`: Number of active game rooms on that worker.

## 🛠️ Cluster Commands
| Task | Command |
| :--- | :--- |
| **Full Start** | `npm run build && npx pm2 start ecosystem.config.cjs` |
| **Check Health** | `npx pm2 list` |
| **Real-time Stats** | `npx pm2 monit` |
| **Kill Cluster** | `npx pm2 delete all` |

> [!TIP]
> Ensure Redis is running in the background (via Docker or local service) before starting the cluster, otherwise workers will hang on startup.
