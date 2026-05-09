"use strict";

/**
 * Balanced Binary Protocol for Agar.io Clone
 * Packs game state into a Buffer for high-efficiency networking.
 */

// Helper to handle string IDs (like UUIDs or socket IDs) in a binary protocol
function getNumericId(id) {
    if (typeof id === 'number') return id;
    if (!id) return 0;
    // Simple fast hash for strings
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = ((hash << 5) - hash) + id.charCodeAt(i);
        hash |= 0; 
    }
    return hash >>> 0; 
}

exports.encodeUpdate = function(playerData, visiblePlayers, visibleFood, visibleMass, visibleViruses) {
    // We estimate size to avoid multiple reallocations, then slice at the end.
    // Max size: ~100 bytes header/self + (50 * numPlayers) + (4 * numFood) + (20 * numViruses)
    const buffer = Buffer.allocUnsafe(16384); 
    let offset = 0;

    // 1. Packet ID
    buffer.writeUInt8(1, offset++);

    // 2. Self Player Data
    buffer.writeFloatLE(playerData.x, offset); offset += 4;
    buffer.writeFloatLE(playerData.y, offset); offset += 4;
    buffer.writeUInt32LE(playerData.massTotal || 0, offset); offset += 4;
    
    const numSelfCells = playerData.cells ? playerData.cells.length : 0;
    buffer.writeUInt8(numSelfCells, offset++);
    for (let i = 0; i < numSelfCells; i++) {
        const cell = playerData.cells[i];
        buffer.writeFloatLE(cell.x, offset); offset += 4;
        buffer.writeFloatLE(cell.y, offset); offset += 4;
        buffer.writeFloatLE(cell.mass, offset); offset += 4;
        buffer.writeFloatLE(cell.radius, offset); offset += 4;
    }

    // 3. Visible Other Players
    buffer.writeUInt8(visiblePlayers.length, offset++);
    for (let p of visiblePlayers) {
        // ID (as Uint32 hashed)
        buffer.writeUInt32LE(getNumericId(p.id), offset); offset += 4;

        // Name (UTF-8, max 16 chars)
        const nameStr = String(p.name || '').substring(0, 16);
        const nameLen = buffer.write(nameStr, offset + 1, 'utf8');
        buffer.writeUInt8(nameLen, offset);
        offset += 1 + nameLen;

        buffer.writeUInt16LE(p.hue || 0, offset); offset += 2;
        buffer.writeUInt8(p.skinId || 0, offset++);
        
        const nCells = p.cells ? p.cells.length : 0;
        buffer.writeUInt8(nCells, offset++);
        for (let i = 0; i < nCells; i++) {
            const c = p.cells[i];
            buffer.writeFloatLE(c.x, offset); offset += 4;
            buffer.writeFloatLE(c.y, offset); offset += 4;
            buffer.writeFloatLE(c.mass, offset); offset += 4;
            buffer.writeFloatLE(c.radius, offset); offset += 4;
        }
    }

    // 4. Visible Food (X and Y only, hue is random on client or derived)
    buffer.writeUInt16LE(visibleFood.length, offset); offset += 2;
    for (let f of visibleFood) {
        buffer.writeUInt32LE(getNumericId(f.id), offset); offset += 4;
        buffer.writeUInt16LE(Math.round(f.x), offset); offset += 2;
        buffer.writeUInt16LE(Math.round(f.y), offset); offset += 2;
        buffer.writeUInt16LE(f.hue || 0, offset); offset += 2; // Keep hue for visual consistency
    }

    // 5. Visible Mass (FireFood)
    buffer.writeUInt16LE(visibleMass.length, offset); offset += 2;
    for (let m of visibleMass) {
        buffer.writeUInt32LE(getNumericId(m.id), offset); offset += 4;
        buffer.writeFloatLE(m.x, offset); offset += 4;
        buffer.writeFloatLE(m.y, offset); offset += 4;
        buffer.writeFloatLE(m.mass, offset); offset += 4;
        buffer.writeFloatLE(m.radius, offset); offset += 4;
        buffer.writeUInt16LE(m.hue || 0, offset); offset += 2;
    }

    // 6. Visible Viruses
    buffer.writeUInt16LE(visibleViruses.length, offset); offset += 2;
    for (let v of visibleViruses) {
        buffer.writeUInt32LE(getNumericId(v.id), offset); offset += 4;
        buffer.writeFloatLE(v.x, offset); offset += 4;
        buffer.writeFloatLE(v.y, offset); offset += 4;
        buffer.writeFloatLE(v.mass, offset); offset += 4;
        buffer.writeFloatLE(v.radius, offset); offset += 4;
        
        let flags = 0;
        if (v.isMoving) flags |= 1;
        buffer.writeUInt8(flags, offset++);
    }

    return buffer.subarray(0, offset);
};
