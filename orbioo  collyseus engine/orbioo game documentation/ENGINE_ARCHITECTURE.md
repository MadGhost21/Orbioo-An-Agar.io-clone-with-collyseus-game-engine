# Orbioo Engine: Architecture & File Breakdown

This document provides a detailed map of the engine's source code, explaining how each file contributes to the game's logic and performance.

## 📁 Source Code Map (src/rooms)

The core of the game lives in `src/rooms`. Below is the breakdown of the essential files:

### 1. `AgarioSocketRoom.ts` (The Brain)
- **Role**: The entry point for the game logic.
- **Job**: 
    - Handles when players **join** or **leave**.
    - Receives **commands** from the client (mouse movement, split, feed).
    - Contains the **Game Loop** (running at 60Hz).
    - Defines the **Schema** (V1.4.5: Using Base64-Binary for food grid).
    - Orchestrates all other modules (Physics, Entities, Spatial Hash).

### 2. `agario/AgarioPhysics.ts` (The Engine)
- **Role**: Handles the "Laws of Physics" for the game.
- **Job**:
    - Calculates **Velocity & Friction**: How cells slow down over time.
    - **Movement**: Updates X/Y coordinates based on mouse input.
    - **Mass Decay**: Calculates how much speed is lost as a cell gets bigger.
    - **Circle Math**: Provides the geometry logic for circles touching each other.

### 3. `agario/AgarioEntities.ts` (The Factory)
- **Role**: Manages the "Objects" in the world.
- **Job**:
    - **Player Management**: Tracks which cells belong to which player.
    - **Spawning**: Handles the random creation of Food and Viruses.
    - **Cleanup**: Efficiently removes eaten food or dead players from the simulation.

### 4. `agario/AgarioConfig.ts` (The Settings)
- **Role**: The "Configuration Center".
- **Job**:
    - Holds **Map Dimensions** (10,000 x 10,000).
    - Balances **Gameplay Values**: Starting mass, split speed, ejection size, etc.
    - Defines **Skins**: Lists all valid skin IDs (Normal & Crypto).

### 5. `agario/SpatialHash.ts` (The Accelerator)
- **Role**: Performance Optimization.
- **Job**:
    - Implements a **Grid-based search**.
    - Instead of checking every object against every other object, it tells the engine: "Only check objects in these nearby squares."
    - This is what allows the game to run at **60fps** with **1000+ items**.

### 6. `agario/AgarioUtils.ts` (The Toolbelt)
- **Role**: General Math Helpers.
- **Job**:
    - Calculating distances between points.
    - Normalizing vectors.
    - Generating random colors and HSL values for food.

---

## 🔗 How They Connect

1. **Client** moves mouse → Sends message to `AgarioSocketRoom`.
2. `AgarioSocketRoom` calls `AgarioPhysics` to update the player's new position.
3. `AgarioSocketRoom` then asks `SpatialHash`: "What is near this player?"
4. `SpatialHash` returns a list of nearby Food/Players.
5. `AgarioSocketRoom` checks for collisions only against those nearby items.
6. If a collision happens, `AgarioEntities` updates the score and removes the eaten item.
7. The new positions are automatically synced to all clients via the **Schema**.
8. **Grid Sync (V1.4.5)**: Food is sent as a compact Base64-Binary mask rather than individual objects, saving 70% bandwidth.
