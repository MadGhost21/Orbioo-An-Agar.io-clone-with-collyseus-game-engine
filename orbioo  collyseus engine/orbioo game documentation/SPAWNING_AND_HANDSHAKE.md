# Orbioo Engine: Spawning Lifecycle & Handshake Logic
**Version Coverage:** V1.3.6 — V1.4.5.1

This document explains the complex sequence that occurs when a player connects to the Orbioo engine, specifically focusing on the stability measures added in V1.4.3.

## 1. The Join Sequence (Handshake)
When a player clicks "Play", the engine enters a multi-phase initialization to ensure the world is fully rendered before the player appears.

### Phase 1: Authentication & Anchor
- **Event**: `onJoin`
- **Action**: The server creates a `PlayerSchema` but does **not** create any cells yet. 
- **Anchor**: The server assigns random spawn coordinates and saves them to `player.x` and `player.y`. This "Anchor" tells the AOI (Area of Interest) system to start sending data for that specific area immediately.

### Phase 2: Warm Start Baking (V1.4.3)
- **Problem**: In V1.3.6, players often spawned in "voids" because the food grid took time to sync.
- **Solution**: The server now executes a "Force Bake" on join. It identifies the 64 sectors (8x8 grid) surrounding the spawn anchor and rebuilds their binary buffers instantly, ensuring they are ready for the very first network patch.

### Phase 3: Client Warmup
- **State**: `global.waitingForWarmup = true`
- **Action**: The client displays the "CONNECTING TO ROOM..." overlay.
- **Threshold**: The client monitors the `global.foods` array. It will only send the `respawn` signal once it has received at least **50 food items**.
- **Safety**: A 2.0s timeout ensures that if the room is naturally low on food, the player can still enter the game.

## 2. Spawning & Protection
Once the warmup is complete, the client sends the `respawn` message.

### Initial Cell Creation
- The server generates the player's first cell at the anchor coordinates.
- **Mass**: Defaults to the value set in `AgarioConfig.ts` (usually 15-20).

### The Spawn Shield (V1.4.2)
To prevent "spawn camping", every new player receives a **Spawn Shield**:
- **Duration**: 3 seconds.
- **Invulnerability**: The player cannot be eaten by anyone, even if the opponent is much larger.
- **Pacifism**: The player cannot eat anyone else (to prevent shield abuse).
- **Visuals**: A "Neon Cyan Pulse" effect animates around the cell.

### Shield Auto-Cancel
The shield is fragile and will break immediately if the player takes action:
1. **Movement**: Moving the mouse more than 1 pixel drops the shield.
2. **Action**: Using the "Split" or "Feed" buttons drops the shield.

## 3. Death & Reconnection
- When a player is eaten, the server sends a `"death"` message and a `"RIP"` signal.
- **Cleanup**: The server calls `victim.leave()` to save resources.
- **Retry**: The client displays the death overlay, allowing for an immediate location reload to rejoin the same room or a new one.

---
*Last Updated: 2026-05-04*
