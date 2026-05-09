# Agario Game: Network Smoothing & Interpolation Documentation

This document explains the "Lag Compensation" and "Smoothing" techniques used to transform a choppy network experience into a fluid 60+ FPS visual experience.

## 1. Visual Fluidity: Snapshot Interpolation
Server network updates are naturally jittery. Packets might arrive every 30ms, then 70ms, then 20ms. If the game rendered these immediately, objects would appear to "stutter" or jump across the screen.

### Mechanism: The Buffer Strategy
- **Snapshot Storage**: The client maintains a `stateBuffer` (a history) of the last 1000ms of server data.
- **Interpolation Delay**: The game renders other players and entities **100ms in the past**.
- **Linear Interpolation (LERP)**: By looking at a snapshot from 120ms ago and 80ms ago, the client can calculate exactly where an object should be at the current "past" time of 100ms.
- **Formula**: `position = start + (end - start) * factor`
- **Result**: Even if the server only sends 20 updates per second, your screen draws the movement 60+ times per second, resulting in **continuous, gliding motion**.

## 2. Responsiveness: Exponential Smoothing (Local Player)
We cannot render the **local player** in the past, or you would feel "heavy" input lag. To solve this, we use a different technique for the player you control.

### Logic: Target Tracking
- Every frame, your client receives the latest "true" position from the server.
- Instead of snapping to it, your cell uses **Exponential Smoothing** (a form of client-side prediction).
- Your local cell glides toward the server's target by a fixed factor (30% per frame).
- **Benefit**: This hides the "step" between network packets while ensuring your mouse movements feel instant and responsive.

## 3. High-Speed Rendering Optimizations
To ensure the game remains "Fast" on all hardware, the following choices were made:
- **Selective Interpolation**: Only moving entities (Players, Viruses, Mass) are interpolated. Static objects like Food (1000+ items) are rendered directly from the latest state to save CPU cycles.
- **Memory Management**: The `stateBuffer` is automatically pruned every frame. It never grows larger than 1 second of data, preventing memory leaks and keeping lookup times fast.
- **Binary Protocols**: By using Colyseus' binary serialization, the time spent parsing data is reduced by over 80% compared to standard JSON.

---
**Technology Stack:**
- **Frontend**: Vanilla JavaScript (ES6)
- **Networking**: @colyseus/sdk
- **Graphics**: HTML5 Canvas (2D Context)
- **Loop**: requestAnimationFrame (optimized for screen refresh rate)
