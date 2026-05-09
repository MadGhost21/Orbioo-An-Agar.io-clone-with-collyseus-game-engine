# 🧬 Orbioo Modular Skin System

The Orbioo skin system is a modern, modular, data-driven architecture that allows for rapid asset expansion and synchronized multi-category management.

## 🏗️ Architecture Overview

The system is built on a **Single Source of Truth** pattern.

1. **Registry (`skinsData.js`)**: A centralized array of objects containing metadata (IDs, Labels, Colors, and Image Paths).
2. **Dynamic UI Builder (`skin.html`)**: A client-side engine that iterates through the registry, creates categories on-the-fly, and renders a searchable grid.
3. **Authoritative Server Sync (`SkinsData.ts`)**: The Colyseus server validates skin selections against its own copy of the registry to prevent unauthorized assets.
4. **Clipping Renderer (`render.js`)**: Uses high-performance Canvas 2D clipping to mask square source images into circular game cells.

---

## 📊 Data Structure

A skin entry in the registry follows this schema:

```typescript
{
    id: string;          // Unique ID used for storage and network sync
    label: string;       // Human-readable name for the UI
    type: "color"|"image"; // Determines rendering logic
    category: string;    // Used for UI grouping (e.g., "Flags", "Animals")
    bodyColor?: string;  // Fallback color / background color
    imageUrl?: string;   // Path to asset (for "image" types)
    glowColor?: string;  // Optional hex for aura effects
}
```

---

## 🔍 Search & Discovery

The Skin Studio features an integrated real-time search engine:
- **Indexing**: It indexes both the `label` and `category` fields.
- **Performance**: Uses a lightweight filtering loop in `skin.html` that re-renders the DOM only for matching results.
- **Layout**: Grid items are scaled to **65px** (50% of original size) to allow for easier navigation of large libraries (300+ skins).

---

## 🎨 Rendering Engine

The renderer (`render.js`) implements a `resolveUserColor` function that prioritizes:
1. Custom hex colors.
2. Registry `bodyColor`.
3. Legacy `bodyHue` HSL mapping.

### Image Masking
To ensure icons look premium, the renderer applies a circular clip:
```javascript
graph.save();
graph.beginPath();
graph.arc(CX, CY, R, 0, TWO_PI);
graph.clip();
graph.drawImage(img, CX-R, CY-R, R*2, R*2);
graph.restore();
```

---

## 🔄 Synchronization Protocol

When a player selects a skin:
1. `localStorage` saves the selection.
2. The `app.js` login flow reads the saved ID.
3. The `ColyseusClient` sends the `skinId` to the server room.
4. The server validates the ID against `SkinsData.ts` and broadcasts it to other players.

---

## 🛠️ Maintenance

For detailed instructions on adding new skins, please refer to the [Skin Developer Guide](./SKIN_DEVELOPER_GUIDE.md).

## 📁 Key Files
| File | Responsibility |
|------|----------------|
| `src/client/js/skinsData.js` | Source of truth (Client) |
| `src/rooms/agario/SkinsData.ts` | Source of truth (Server) |
| `src/client/skin.html` | Studio Interface & Search |
| `src/client/js/render.js` | In-game rendering logic |
| `src/client/img/skins/` | Asset repository |

---
*Last Updated: May 2026*
