# 🎨 Orbioo Skin Developer Guide

This guide explains how to add new skins, manage categories, and customize the appearance of cells in the Orbioo engine.

## 🛠️ The Architecture
Orbioo uses a **Data-Driven Registry**. Instead of hardcoding buttons in HTML, we define all skins in a central registry that both the **Client** and **Server** use.

- **Client Source:** `src/client/js/skinsData.js`
- **Server Source:** `src/rooms/agario/SkinsData.ts`
- **UI Logic:** `src/client/skin.html` (Dynamically builds the grid)

---

## 📁 Step 1: Prepare Your Asset
1. **Format:** PNG (with transparency) or WebP is recommended. Flat vectors look best.
2. **Size:** 256x256 or 512x512 pixels.
3. **Location:** Place your image in the appropriate sub-folder:
   - `src/client/img/skins/animals/`
   - `src/client/img/skins/flags/`
   - `src/client/img/skins/elements/`
   - `src/client/img/skins/origin/`

---

## 📝 Step 2: Register the Skin
You must add the skin to `src/client/js/skinsData.js`. 

### Image Skin Template:
```javascript
{ 
    id: "cool_lion",           // Unique ID (no spaces)
    label: "Cool Lion",        // Name shown in UI
    type: "image",             // Use "image" for logos
    category: "Animals",       // Category name (creates a new section if unique)
    bodyColor: "#DAA520",      // Default cell color under the logo
    imageUrl: "/img/skins/animals/cool_lion.png" 
}
```

### Basic Color Template:
```javascript
{ 
    id: "vibrant_red", 
    label: "Vibrant Red", 
    type: "color", 
    category: "Basic", 
    bodyColor: "#FF0000" 
}
```

---

## 🔄 Step 3: Synchronize with Server
To prevent "Ghost Skins" (where a player sees a skin but the server doesn't), you **MUST** copy the new entry into `src/rooms/agario/SkinsData.ts`.

> [!IMPORTANT]
> The server registry uses TypeScript, but the structure is identical. Ensure the `id` matches exactly.

---

## 📂 How Categories Work
The Skin Studio UI (`skin.html`) automatically groups skins by their `category` field.

1. **Auto-Grouping:** If you give 5 skins the category `"Space"`, the UI will automatically create a section called **"SPACE SKINS"**.
2. **Search Indexing:** The search bar at the top of the Skin Studio filters by both the **Label** and the **Category**.
3. **Sorting:** The UI renders categories in the order they first appear in the `SkinsRegistry` array.

---

## ✨ Advanced Features
### Glow Effects
To add a glowing aura around a skin, add the `glowColor` property:
```javascript
{ id: "sun", label: "Sun", type: "image", glowColor: "#FFFF00", ... }
```

### Custom Rendering (Renderer.js)
The `render.js` file uses the `skinId` to look up the registry during gameplay. It uses **Canvas Clipping** to ensure square images fit perfectly inside circular cells.

---

## 🚀 Deployment Checklist
- [ ] Image uploaded to `img/skins/`
- [ ] Added to `skinsData.js`
- [ ] Added to `SkinsData.ts` (Server)
- [ ] Run `npx gulp build` (to compile the client JS)
- [ ] Hard Refresh browser (`Ctrl + F5`)

---

## ❓ Troubleshooting
- **Image is white?** Check the console (F12). It's likely a 404 path error.
- **Skin doesn't show in Studio?** Ensure the `imageUrl` starts with `/img/skins/...`
- **Server kicks me?** This happens if the `id` is missing from the Server's `SkinsData.ts`.
