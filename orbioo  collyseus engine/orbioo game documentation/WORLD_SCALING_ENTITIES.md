# Orbioo Engine: World Scaling & Entity Management

This document details the transition to the **10,000 x 10,000** map scale and the sophisticated entity spawning systems (Food and Viruses) implemented to keep the world alive and performant.

## 🗺️ World Dimensions
- **Map Size**: 10,000 x 10,000 units.
- **Total Area**: 100,000,000 square units.
- **Coordinate System**: (0,0) is top-left, (10000, 10000) is bottom-right.

## 🍏 Cell-Based Food Balancing
To prevent "food deserts" in a map of this size, the engine uses a **Cell-Based Food Balancing** system instead of a global limit.

### 1. The Grid System
The 10k x 10k map is divided into **40 x 40** virtual grid cells (each 250px x 250px).
- **Total Grid Cells**: 1,600.
- **Density Limit**: Each cell aims to maintain **5 food items**.
- **Theoretical Max Food**: ~8,000 items globally.

### 2. Throttled Spawning Logic
To ensure server stability and prevent "mass explosions" (over-spawning), food regeneration is throttled:
- **Interval**: A check is performed randomly every **5 to 10 seconds**.
- **Batching**: In each interval, a depleted grid cell can spawn a maximum of **2 items**. This "drip-feed" approach prevents massive spikes in entity count and processing load.
- **Initial Fill**: When a room is first created, the engine performs an **Instant Population** pass, filling every cell to its limit of 5 items immediately so the map is ready for the first player.

## 🦠 Virus Mechanics
Viruses act as the primary environmental obstacle and strategic tool for smaller players.

### 1. Global Count & Spawning
- **Max Viruses**: 200 viruses globally.
- **Automatic Balancing**: The engine monitors the virus count every tick. If it drops below 200 (due to players feeding them or splitting), new viruses are randomly spawned in open areas.
- **Mass Range**: Newly spawned viruses have a mass between **100 and 150**.

### 2. Interaction Rules
- **Hiding**: Cells with a radius $\le$ 85% of a virus's radius can overlap and hide inside a virus safely.
- **Splitting**: Cells with mass > 130 that touch a virus will instantly explode into up to 16 pieces.
- **Pushing Mechanic**: Players can eject mass (W) at a virus. After **4 hits**, the virus will consume the mass and launch itself in the opposite direction (away from the player) to strike opponents.

## 🚀 Scalability Considerations
- **Network Culling (AOI)**: With ~8,000 food items, sending all data to every player would crash the client. The server only synchronizes entities within a **1800-unit radius** (Area of Interest) of each player's centroid.
- **Spatial Hash Integration**: Both Food and Viruses are tracked in the `SpatialHash` for O(1) lookup during physics ticks and AOI calculations.
