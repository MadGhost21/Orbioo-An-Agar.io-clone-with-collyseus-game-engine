# 📉 Orbioo Engine: Mass Loss & Decay System

The Mass Loss system is a critical balancing mechanic in Orbioo that prevents high-mass players from remaining dominant indefinitely without active gameplay.

## 1. Proportional Decay System

Unlike simple games that subtract a fixed amount of mass, Orbioo uses a **Proportional Decay** system. This means the larger you are, the faster you lose mass.

### The Formula
Every decay interval, the engine calculates the amount of mass to subtract:
`Mass Loss = Math.max(1, Math.floor(Total Mass * Decay Rate))`

*   **Decay Rate**: Currently set to **0.2%** (`0.002`).
*   **Interval**: The check occurs every **2 seconds** (`2000ms`).

### Why Proportional?
*   **Small Players**: If you have 500 mass, you lose only ~1 mass per interval (hardly noticeable).
*   **Large Players**: If you have 10,000 mass, you lose 20 mass per interval (~600 mass per minute). This forces large players to keep hunting and eating to maintain their size.

---

## 2. Safety Thresholds

To protect new and small players, the engine enforces strict safety rules:

1.  **The Floor (`minMassLoss`)**: 
    *   Players only begin losing mass once their total mass exceeds **400**.
    *   If you are under 400 mass, you are safe from natural decay.
2.  **Cell Protection**:
    *   Mass is always subtracted from your **largest cell**.
    *   The engine will never reduce a cell's mass below the **10 mass** (`defaultPlayerMass`) threshold. If a subtraction would put you below 10, the subtraction is canceled.

---

## 3. Configuration & Logic

### Configuration (`AgarioConfig.ts`)
| Property | Value | Description |
| :--- | :--- | :--- |
| `massLossRate` | 0.002 | The percentage of mass lost every 2 seconds. |
| `minMassLoss` | 400 | The mass threshold to trigger decay. |
| `defaultPlayerMass` | 10 | The absolute minimum mass a cell can have. |

### Logic Workflow (`AgarioPhysics.ts`)
1.  **Timer Check**: Has it been 2 seconds since the last loss?
2.  **Size Check**: Is the player over 400 mass?
3.  **Targeting**: Identify the cell with the highest mass.
4.  **Subtraction**: Calculate 0.2% of total mass, subtract it from that cell, and update the player's total score.

---

## 4. Balancing Tips

*   **Higher Competition**: If the game feels too slow or players are getting "too big," increase `massLossRate` to `0.003` or `0.004`.
*   **Noob Protection**: If new players are struggling, increase `minMassLoss` to `600` or `800` to give them more "safe" growing room.
