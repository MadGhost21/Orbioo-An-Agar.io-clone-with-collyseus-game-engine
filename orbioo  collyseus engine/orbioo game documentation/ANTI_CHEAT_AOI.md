# Orbioo Anti-Cheat & Visibility (AOI)

Documentation on the server-side authoritative Area of Interest (AOI) system.

## 👁️ 1,400px Hard Cap
To prevent players from using zoom hacks or ultra-wide monitors to gain an unfair advantage, the server enforces a hard limit on visibility.

- **Authoritative Limit**: **1,400 pixels**.
- **Implementation**: Even if a client requests a larger radius (e.g. 1,800px), the server clamps the value to 1,400px before sending entity data.
- **Physics Engine**: The `AgarioPhysics` and `SpatialHash` systems use this cap to determine which food and players are "relevant" to your current position.

## 🛡️ Fair Play Rules
- **Constant FOV**: The camera system in the frontend is designed to keep the playing field consistent regardless of browser zoom.
- **Grid Sync**: Binary food synchronization ensures that all players see the same grid data within their 1,400px window.

> [!NOTE]
> This limit is defined in `AgarioConfig.ts` under `MAX_AOI_RADIUS`.
