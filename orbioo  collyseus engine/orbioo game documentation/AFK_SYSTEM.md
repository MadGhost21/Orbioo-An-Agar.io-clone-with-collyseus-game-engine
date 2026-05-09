# Authoritative AFK Inactivity System (AAIS) – V1.5.8

This document details the server-side logic used to manage inactive players in Orbioo.

## 🕒 The 3-Phase Lifecycle
The system follows a strictly enforced "Natural Clock" that ignores background browser heartbeats.

1.  **Phase 1: Grace Period (0s - 60s)**
    *   **Trigger**: Player loses focus or stops moving.
    *   **Effect**: The AFK timer appears on screen. No gameplay penalties occur.
2.  **Phase 2: Active Decay (60s - 119s)**
    *   **Effect**: Proportional mass decay is increased by **5x**.
    *   **Threshold**: Only affects players above **400 mass**.
3.  **Phase 3: Automated Kick (120s)**
    *   **Effect**: Server sends a `"kick"` message to the client.
    *   **Notification**: Client displays: *"You were kicked for being AFK"*.
    *   **Cleanup**: The socket is closed and the player is removed from the room.

## 🛡️ Anti-Immunity Mechanics
- **Focus Detection**: The system tracks `isFocused` status.
- **Heartbeat Ignoring**: While a player is marked as AFK, their incoming mouse movement messages (heartbeats) are **ignored** by the inactivity timer.
- **Resuming**: The timer only resets to 0 when the player regains focus (clicks back into the window).

> [!NOTE]
> This system is currently active and verified across the 4-worker cluster. We will return to tweak the 120s duration in later development if needed.
