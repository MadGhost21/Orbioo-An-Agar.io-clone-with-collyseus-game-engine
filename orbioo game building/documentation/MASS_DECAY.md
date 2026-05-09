# 📉 Orbioo Engine: Mass Loss & Decay System

This document explains the proportional mass decay system implemented in this version of the Orbioo engine.

## 1. Proportional Decay System
To keep the game balanced, Orbioo uses a **Proportional Decay** formula. Unlike fixed decay, this system scales with the player's size.

### The Calculation
Every **2 seconds**, the server runs this calculation for every player:
`Mass Loss = Math.max(1, Math.floor(Total Player Mass * Decay Rate))`

*   **Current Decay Rate**: `0.002` (0.2%).
*   **Targeting**: Mass is always removed from the player's **largest cell** to maintain visual consistency.

### Examples of Scaling
| Total Mass | Loss per 2s | Total loss per min |
| :--- | :--- | :--- |
| 500 | 1 mass | 30 mass |
| 1,000 | 2 mass | 60 mass |
| 5,000 | 10 mass | 300 mass |
| 10,000 | 20 mass | 600 mass |

---

## 2. Safety Guards
Two main safety features ensure that decay doesn't ruin the experience for new players or cause cells to vanish:

1.  **Threshold (`minMassLoss`)**: Decay only activates if a player's total mass is greater than **400**. If you are below this, you lose 0 mass.
2.  **Minimum Cell Mass**: The engine will never subtract mass if it would leave the targeted cell with less than **10 mass**.

---

## 3. Configuration
These values can be tuned in the root file:
`C:\Users\MadGhost21\Desktop\agariotesting ground\orbioo with dectection not forced\config.js`
