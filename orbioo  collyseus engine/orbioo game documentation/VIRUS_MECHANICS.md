# 🦠 Orbioo Engine: Virus Mechanics & Explosions

This document explains the physics and rules governing viruses in the Orbioo engine, specifically focusing on how cells explode upon contact and how viruses behave.

## 1. Virus Explosion Logic (The "Big Pop")

When a player's cell collides with a virus, the engine evaluates if an explosion should occur. This logic is handled in `AgarioPhysics.ts` under the `virusSplit` method.

### The Trigger Condition
*   **Mass Requirement**: A cell will only explode if its mass is greater than `AgarioConfig.virus.splitMass` (currently **130**).
*   **Overlap**: The cell must physically overlap with the virus radius.

### The Explosion Process
If the conditions are met, the specific cell that hit the virus is shattered. The process follows these strict rules:

1.  **The 16-Piece Limit**:
    *   If you already have **16 cells**, you will NOT explode. Instead, you absorb the virus and gain **+50 mass**.
    *   If you have fewer than 16, the engine calculates exactly how many "minions" to create to reach your 16-cell maximum.

2.  **Asymmetric Mass Distribution**:
    *   **Parent Cell**: Retains **45%** of its original mass.
    *   **Minions (Fragments)**: The remaining mass is divided into small fragments, with each piece having a fixed low mass of **15–20**.

3.  **Radial Blast Physics**:
    *   **Pattern**: Fragments are launched in a perfect **360-degree radial pattern** from the center of the collision.
    *   **Velocity**: Minions are "shot out" at **1.5x** the standard split speed to simulate a violent explosion. 
    *   **Blast Distance**: These pieces will travel approximately **150–200 pixels** outward before friction slows them down to normal speed.
    *   **Parent Reaction**: The parent cell is pushed backward (opposite the blast) at **0.5x** speed for balance.

4.  **Merge Penalty**:
    *   Every piece created by the explosion is given a `mergeAllowedAt` timer.
    *   **Duration**: You must wait **15 seconds** (`AgarioConfig.mergeTimer`) before these pieces can re-combine. During this time, you are extremely vulnerable as your mass is scattered.

---

## 2. Global Virus Stats & Distribution

The engine maintains a high-scale environment suitable for the 10,000 x 10,000 map.

*   **Total Viruses**: **200** (permanently set in `AgarioConfig.ts`).
*   **Spawn Logic**: Viruses are spawned at random coordinates within the map boundaries.
*   **Respawn**: If a virus is consumed (rarely, only by very specific mechanics if enabled) or if the count drops, the `EntityManager` will replenish them to maintain the 200 count.

---

## 3. Advanced Interactions

### Hiding Inside Viruses
Small cells can hide inside viruses to escape larger predators.
*   **Condition**: A cell's radius must be $\leq$ **85%** of the virus's radius (`hideRadiusFraction: 0.85`).
*   If you are small enough, you can sit directly behind/inside the virus without exploding.

### Feeding Viruses
Players can shoot mass (using the **W** key) into viruses.
*   **Feed Requirement**: Every time a virus "eats" a piece of ejected mass, it grows slightly.
*   **Splitting the Virus**: After consuming **4 pieces** of mass (`feedHitsToMove: 4`), the virus will "reproduce." It will shoot a new virus in the direction the mass was coming from. This is used by players to "aim" viruses at enemies to make them explode.

---

## 4. Key Configuration Values
These are defined in `src/rooms/agario/AgarioConfig.ts`:

| Property | Value | Description |
| :--- | :--- | :--- |
| `maxVirus` | 200 | Total viruses on the 10k map. |
| `splitMass` | 130 | Minimum mass a cell needs to be "popped" by a virus. |
| `limitSplit` | 16 | Maximum number of cells a player can have at once. |
| `mergeTimer` | 15s | Seconds to wait after an explosion before merging. |
| `hideRadiusFraction` | 0.85 | Size ratio allowed to hide safely inside. |
