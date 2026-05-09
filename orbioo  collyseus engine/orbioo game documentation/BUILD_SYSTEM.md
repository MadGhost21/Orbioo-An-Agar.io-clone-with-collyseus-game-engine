# Orbioo Build System & Watchers (V1.5.8)

Technical guide on the development build system and Nodemon optimizations.

## 👁️ Watcher Optimization (No-Flicker Mode)
We use a Gulp + Nodemon watcher to handle auto-reloading during development.

- **The Problem**: Every time a player joined or chatted, the server wrote to the SQLite database in `./bin/server/db/`. This triggered a full server restart, causing the CMD window to flicker.
- **The Solution**: The `gulpfile.js` has been updated to explicitly **ignore** the database directory.

```javascript
// gulpfile.js logic
nodemon({
    script: 'bin/server/server.js',
    ignore: ['./bin/server/db/'], // <--- This prevents the flicker
    ...
})
```

## 🛠️ Dev Workflow
1. **Frontend**: `npm run dev` (Starts Gulp, Babel, and the Watcher).
2. **Build**: `npm run build` (Minifies assets for production).

> [!NOTE]
> If you make changes to the database schema or core server logic and the server doesn't restart, you may need to manually restart the Gulp task.
