# Camera System Guide

## Overview

The camera in Orbioo determines what portion of the game world is visible to the player. It is a "follow-camera" that centers on the player's cells while allowing for dynamic zooming and manual mouse-wheel adjustments.

## Architecture

The camera logic is split between two main files:

1.  **Coordinate Calculation** (`src/server/map/player.js` / `AgarioPhysics.ts`): Authoritatively determines the camera position based on the **Largest Cell Priority**.
2.  **FOV Normalization** (`src/client/js/app.js`): Calculates the compensation factor based on `window.devicePixelRatio`.
3.  **Visual Transformation** (`src/client/js/app.js` in `gameLoop`): Applies the transformation to the canvas.

## How it Works

### 1. Positioning (Follow Logic)

The camera anchors on the **Largest Cell** (the fragment with the highest mass) to ensure stabilization during splits and explosions.

**Location:** `AgarioPhysics.ts` (Engine) / `player.js` (Server)

```typescript
// Largest Cell Centering
let maxIndex = 0;
for (let i = 1; i < this.cells.length; i++) {
    if (this.cells[i].mass > this.cells[maxIndex].mass) maxIndex = i;
}
const largestCell = this.cells[maxIndex];

// Camera Tracking
this.x = largestCell.x;
this.y = largestCell.y;
```

This position is then used as the "anchor" for drawing everything else relative to the screen center.

### 2. Dynamic Zoom (Auto-Scaling)

As your mass increases, the camera automatically zooms out to give you a better field of view.

**Location:** `src/client/js/app.js` in `gameLoop()`

```javascript
// Dynamic zoom formula
let baseZoom = 1.0;
let zoomFactor = 0.08; 
let targetZoom = baseZoom * Math.pow(baseMass / currentMass, zoomFactor);

// Smoothing
global.zoom += (targetZoom - global.zoom) * 0.02; 
```

- **Higher Mass** = Lower `targetZoom` (zooms out).
- **Lower Mass** = Higher `targetZoom` (zooms in).

### 3. FOV Normalization (Anti-Zoom Cheat)

To prevent players from using browser zoom (Ctrl +/-) to increase their FOV, Orbioo applies an inverse scale factor.

**Location:** `src/client/js/app.js`

```javascript
// Calculate compensation
let normalizedScale = (window.devicePixelRatio || 1);
let finalZoom = (global.zoom / normalizedScale);

// Apply to canvas
graph.scale(finalZoom, finalZoom);
```

### 4. Manual Zoom (Mouse Wheel)

Players can adjust their zoom level between specific V1.3 safety bounds.

**Location:** `src/client/js/app.js`

```javascript
window.addEventListener('wheel', function(e) {
    if (e.deltaY > 0) {
        global.zoom = Math.max(0.7, global.zoom - 0.05); // Max Zoom Out
    } else {
        global.zoom = Math.min(2.0, global.zoom + 0.05); // Max Zoom In
    }
});
```

## Transformation Pipeline

To render the world correctly, the canvas goes through these steps in order:

1.  **Save State**: `graph.save()`
2.  **Center Pivot**: Move the origin to the middle of the screen: `graph.translate(width/2, height/2)`
3.  **Scale**: Apply the zoom: `graph.scale(global.zoom, global.zoom)`
4.  **Reverse Pivot**: Move the origin back: `graph.translate(-width/2, -height/2)`
5.  **Draw World**: Draw objects at `object.x - player.x + width/2`.
6.  **Restore**: `graph.restore()`

## Key Variables

| Variable | Description |
| :--- | :--- |
| `global.zoom` | The current scaling factor (1.0 = 100%). |
| `global.player.x/y` | The world coordinates the camera is currently centered on. |
| `global.screen.width/height` | The current browser window dimensions. |

## Modifying Camera Behavior

### To Change Zoom Speed
Modify the multiplier `0.05` in the `wheel` event listener in `app.js`.

### To Change Max/Min Zoom
Adjust the `Math.max(0.2, ...)` and `Math.min(2.0, ...)` bounds in the `wheel` listener.

### To Disable Auto-Zoom
Comment out the "Dynamic zoom" block inside the `gameLoop()` function in `app.js`.
