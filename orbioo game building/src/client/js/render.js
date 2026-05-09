// render.js – v9 (Project V1.4.1.4)
// Changes:
//  1. Removed all hardcoded Base64 skin images
//  2. Images now loaded dynamically from /img/skins/ using SkinsRegistry
//  3. Glow colors read from skin.glowColor in SkinsRegistry
//  4. CRYPTO_GLOW and COIN_B64 constants removed
//  5. Skin lookups use window.getSkinById() from skinsData.js

const FULL_ANGLE = 2 * Math.PI;
var skinsData = require('./skinsData');

// ── Dynamic skin image loader ───────────────────────────────
// Images are loaded from /img/skins/ based on SkinsRegistry.imageUrl
const _skinImages = {};

function _loadSkinImages() {
    (skinsData.SkinsRegistry || []).forEach(skin => {
        if (skin.type === 'image' && skin.imageUrl) {
            const img = new Image();
            img.src = skin.imageUrl;
            _skinImages[skin.id] = img;
        }
    });
}

// Call immediately to start loading
_loadSkinImages();

// Stub so existing references in COIN_B64 block don't error – will be removed below
const _PLACEHOLDER_REMOVAL_MARKER = null;




// ── Basic drawing helpers ─────────────────────────────────

const drawRoundObject = (position, radius, graph) => {
    graph.beginPath();
    graph.arc(position.x, position.y, radius, 0, FULL_ANGLE);
    graph.closePath();
    graph.fill();
    graph.stroke();
};

const drawFood = (position, food, graph) => {
    graph.fillStyle   = 'hsl(' + food.hue + ', 100%, 50%)';
    graph.strokeStyle = 'hsl(' + food.hue + ', 100%, 45%)';
    graph.lineWidth   = 0;
    drawRoundObject(position, food.radius, graph);
};

const drawVirus = (position, virus, graph) => {
    const moving = virus.isMoving;

    if (moving) {
        graph.save();
        graph.shadowColor = '#00ff44';
        graph.shadowBlur  = 24;
    }

    graph.strokeStyle = virus.stroke      || '#19D119';
    graph.fillStyle   = virus.fill        || '#33ff33';
    graph.lineWidth   = virus.strokeWidth || 20;

    // Draw spiky virus shape – alternating outer/inner points
    const points = 20;
    const outerR  = moving ? virus.radius * 1.15 : virus.radius;
    const innerR  = virus.radius * 0.78;
    graph.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const theta = (Math.PI / points) * i;
        const r = (i % 2 === 0) ? outerR : innerR;
        const x = position.x + r * Math.cos(theta);
        const y = position.y + r * Math.sin(theta);
        if (i === 0) graph.moveTo(x, y);
        else graph.lineTo(x, y);
    }
    graph.closePath();
    graph.stroke();
    graph.fill();

    if (moving) graph.restore();
};

const drawFireFood = (position, mass, playerConfig, graph) => {
    const color = mass.color || ('hsl(' + (mass.hue ?? 60) + ', 100%, 50%)');
    graph.strokeStyle = color;
    graph.fillStyle   = color;
    graph.globalAlpha = 0.85;
    graph.lineWidth   = playerConfig.border + 2;
    drawRoundObject(position, mass.radius - 1, graph);
    graph.globalAlpha = 1;
};

const valueInRange = (min, max, value) => Math.min(max, Math.max(min, value));
const circlePoint  = (origo, radius, theta) => ({
    x: origo.x + radius * Math.cos(theta),
    y: origo.y + radius * Math.sin(theta),
});

const cellTouchingBorders = (cell, borders) =>
    cell.x - cell.radius <= borders.left  ||
    cell.x + cell.radius >= borders.right ||
    cell.y - cell.radius <= borders.top   ||
    cell.y + cell.radius >= borders.bottom;

const regulatePoint = (point, borders) => ({
    x: valueInRange(borders.left, borders.right, point.x),
    y: valueInRange(borders.top,  borders.bottom, point.y),
});

const drawCellWithLines = (cell, borders, graph) => {
    const pointCount = 30 + ~~(cell.mass / 5);
    const points = [];
    for (let theta = 0; theta < FULL_ANGLE; theta += FULL_ANGLE / pointCount) {
        points.push(regulatePoint(circlePoint(cell, cell.radius, theta), borders));
    }
    graph.beginPath();
    graph.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) graph.lineTo(points[i].x, points[i].y);
    graph.closePath();
    graph.fill();
    graph.stroke();
};

// Solana and Ethereum path logic removed

// CRYPTO_GLOW removed – glow colors now come from SkinsRegistry[skin].glowColor

// ── Main cell drawing ─────────────────────────────────────
const drawCells = (cells, playerConfig, toggleMassState, borders, graph, showScoreInCell) => {
    for (const cell of cells) {
        const skinId  = cell.skinId || null;
        const skinDef = (skinId && skinsData && typeof skinsData.getSkinById === 'function') ? skinsData.getSkinById(skinId) : null;
        const isImageSkin = !!(skinDef && skinDef.type === 'image');
        const glowColor   = skinDef && skinDef.glowColor ? skinDef.glowColor : null;

        // Dim AFK players
        graph.globalAlpha = cell.isAFK ? 0.5 : 1.0;

        // Spawn Shield Pulse (V1.4.2)
        if (cell.spawnShield) {
            const pulse = 0.5 + Math.sin(Date.now() / 150) * 0.5;
            graph.save();
            graph.lineWidth = 4 + pulse * 6;
            graph.strokeStyle = '#00ffff'; 
            graph.shadowBlur = 15 + pulse * 10;
            graph.shadowColor = '#00ffff';
            graph.beginPath();
            graph.arc(cell.x, cell.y, cell.radius + 6, 0, FULL_ANGLE);
            graph.stroke();
            graph.restore();
        }

        // Glow ring for image skins that have a glowColor
        if (glowColor) {
            graph.save();
            graph.shadowColor = glowColor;
            graph.shadowBlur  = 22;
            graph.globalAlpha = 0.5;
            graph.beginPath();
            graph.arc(cell.x, cell.y, cell.radius + 3, 0, FULL_ANGLE);
            graph.fillStyle = glowColor + '44';
            graph.fill();
            graph.restore();
        }

        // Cell body
        graph.fillStyle   = cell.color;
        graph.strokeStyle = cell.borderColor;
        graph.lineWidth   = 6;
        if (cellTouchingBorders(cell, borders)) {
            drawCellWithLines(cell, borders, graph);
        } else {
            drawRoundObject(cell, cell.radius, graph);
        }

        // Image skin logo inside cell (loaded dynamically)
        if (isImageSkin && cell.radius > 12) {
            const img = _skinImages[skinId];
            if (img && img.complete && img.naturalWidth > 0) {
                const s = cell.radius * 2;
                graph.save();
                graph.beginPath();
                graph.arc(cell.x, cell.y, cell.radius, 0, FULL_ANGLE);
                graph.closePath();
                graph.clip();
                graph.drawImage(img, cell.x - s/2, cell.y - s/2, s, s);
                graph.restore();
            }
        }

        // ── Text: NAME IN CENTER (original agar.io style) ────
        const fontSize = Math.max(cell.radius / 3, 12);
        graph.miterLimit   = 1;
        graph.lineJoin     = 'round';
        graph.textAlign    = 'center';
        graph.textBaseline = 'middle';
        graph.lineWidth    = playerConfig.textBorderSize;
        graph.strokeStyle  = playerConfig.textBorder;
        graph.fillStyle    = playerConfig.textColor;

        if (showScoreInCell && cell.radius > 18) {
            // Name on upper half, score on lower half — both inside the cell
            const half = Math.max(fontSize * 0.72, 9);
            if (cell.name) {
                graph.font = 'bold ' + fontSize + 'px sans-serif';
                graph.strokeText(cell.name, cell.x, cell.y - half * 0.55);
                graph.fillText(cell.name,   cell.x, cell.y - half * 0.55);
            }
            graph.font = 'bold ' + half + 'px sans-serif';
            graph.strokeText(Math.round(cell.mass), cell.x, cell.y + half * 0.9);
            graph.fillText(Math.round(cell.mass),   cell.x, cell.y + half * 0.9);
        } else {
            // Name centered (default)
            if (cell.name) {
                graph.font = 'bold ' + fontSize + 'px sans-serif';
                graph.strokeText(cell.name, cell.x, cell.y);
                graph.fillText(cell.name,   cell.x, cell.y);
            }

            // Legacy mass display below name
            if (toggleMassState === 1) {
                const massFont = Math.max(fontSize * 0.65, 10);
                graph.font = 'bold ' + massFont + 'px sans-serif';
                const yOff = cell.name && cell.name.length > 0 ? fontSize * 0.7 : 0;
                graph.strokeText(Math.round(cell.mass), cell.x, cell.y + yOff);
                graph.fillText(Math.round(cell.mass),   cell.x, cell.y + yOff);
            }
        }
        
        graph.globalAlpha = 1.0; // Restore alpha
    }
    graph.globalAlpha = 1.0; // Reset
};

const drawGrid = (global, player, screen, graph) => {
    graph.lineWidth   = 1;
    graph.strokeStyle = global.lineColor;
    graph.globalAlpha = 0.15;
    graph.beginPath();
    const finalZoom = global.finalZoom || 1.0;
    const step = screen.height / 18;
    
    // Calculate visible boundaries in the transformed coordinate space
    const left   = (screen.width / 2)  - (screen.width / 2)  / finalZoom;
    const right  = (screen.width / 2)  + (screen.width / 2)  / finalZoom;
    const top    = (screen.height / 2) - (screen.height / 2) / finalZoom;
    const bottom = (screen.height / 2) + (screen.height / 2) / finalZoom;

    // Grid offset based on player position
    const offsetX = -player.x % step;
    const offsetY = -player.y % step;

    for (let x = left + offsetX - step; x < right + step; x += step) {
        graph.moveTo(x, top); 
        graph.lineTo(x, bottom);
    }
    for (let y = top + offsetY - step; y < bottom + step; y += step) {
        graph.moveTo(left, y); 
        graph.lineTo(right, y);
    }
    graph.stroke();
    graph.globalAlpha = 1;
};

const drawBorder = (borders, graph) => {
    graph.lineWidth   = 1;
    graph.strokeStyle = '#000000';
    graph.beginPath();
    graph.moveTo(borders.left,  borders.top);
    graph.lineTo(borders.right, borders.top);
    graph.lineTo(borders.right, borders.bottom);
    graph.lineTo(borders.left,  borders.bottom);
    graph.closePath();
    graph.stroke();
};

const drawErrorMessage = (message, graph, screen) => {
    graph.fillStyle = '#333333';
    graph.fillRect(0, 0, screen.width, screen.height);
    graph.textAlign = 'center';
    graph.fillStyle = '#FFFFFF';
    graph.font      = 'bold 30px sans-serif';
    graph.fillText(message, screen.width / 2, screen.height / 2);
};

module.exports = { drawFood, drawVirus, drawFireFood, drawCells, drawErrorMessage, drawGrid, drawBorder };
