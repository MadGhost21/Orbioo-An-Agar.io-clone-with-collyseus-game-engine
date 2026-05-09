# Orbioo Engine: Performance & Scalability Documentation

This document outlines the architectural optimizations implemented to ensure the engine can handle high player counts (100+) and massive entity counts (8,000+ food items) with minimal CPU and RAM overhead.

## 1. Core Optimization: Spatial Hashing
The most significant performance bottleneck in any Agario game is **Collision Detection**. 

### The Problem: O(N²) Complexity
By default, checking if any object (player, food, virus) is touching another object requires comparing every object against every other object. With 8,000 food items and 100 players, the server would perform over **800,000 checks every tick**. This causes massive CPU spikes and lag.

### The Solution: Spatial Grid Partitioning
We implemented a `SpatialHash` utility. 
- **Mechanism**: The map is divided into a grid of 250px x 250px cells.
- **Logic**: Every frame, the server quickly buckets all entities into these cells based on their coordinates.
- **Result**: To check collisions for a player, the server only looks at entities in the **immediate 9 surrounding grid cells** rather than the entire map.
- **Performance Impact**: Complexity dropped from **$O(N^2)$** to effectively **$O(N)$**. This allows the server to maintain a stable **60Hz tick rate** even with 8,000 entities.

## 2. Network Efficiency: Delta State Sync
The engine uses **Colyseus** with the `@colyseus/schema` system.
- **Binary Serialization**: State is sent as a compact binary format rather than heavy JSON strings.
- **Delta Patching**: The server only sends **what changed** since the last update. If a food item hasn't moved or been eaten, it consumes zero bandwidth.
- **Area of Interest (AOI) (Implemented V1.4.1)**: The server uses the `SpatialHash` to only sync entities within a player's screen view + buffer zone. This scales dynamically with player mass/zoom.
- **Binary Grid Mask (Implemented V1.4.5)**: Food is transmitted as a compact Base64-Binary mask rather than individual objects, reducing initial sync bandwidth by **70%**.

## 3. High-Frequency Simulation
The server-side physics loop is synchronized to **60 ticks per second** (`16.6ms` intervals). This ensures that collision resolution (like eating or splitting) is precise and responsive, preventing "ghost" collisions where players pass through each other.

---
**Technology Stack:**
- **Runtime**: Node.js / TypeScript
- **Networking**: Colyseus (WebSockets)
- **State Management**: @colyseus/schema
- **Physics**: Authoritative Server-Side Math
