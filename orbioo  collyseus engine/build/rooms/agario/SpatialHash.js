export class SpatialHash {
    constructor(cellSize = 200) {
        this.cellSize = cellSize;
        this.cells = new Map();
    }
    getCellKey(cx, cy) {
        return `${cx},${cy}`;
    }
    getCellCount(cx, cy) {
        return this.cells.get(this.getCellKey(cx, cy))?.length || 0;
    }
    clear() {
        this.cells.clear();
    }
    rebuild(entities) {
        this.cells.clear();
        for (const entity of entities) {
            this.insert(entity);
        }
    }
    insert(entity) {
        const xStart = Math.floor((entity.x - entity.radius) / this.cellSize);
        const xEnd = Math.floor((entity.x + entity.radius) / this.cellSize);
        const yStart = Math.floor((entity.y - entity.radius) / this.cellSize);
        const yEnd = Math.floor((entity.y + entity.radius) / this.cellSize);
        for (let x = xStart; x <= xEnd; x++) {
            for (let y = yStart; y <= yEnd; y++) {
                const key = `${x},${y}`;
                if (!this.cells.has(key)) {
                    this.cells.set(key, []);
                }
                this.cells.get(key).push(entity);
            }
        }
    }
    remove(entity) {
        const xStart = Math.floor((entity.x - entity.radius) / this.cellSize);
        const xEnd = Math.floor((entity.x + entity.radius) / this.cellSize);
        const yStart = Math.floor((entity.y - entity.radius) / this.cellSize);
        const yEnd = Math.floor((entity.y + entity.radius) / this.cellSize);
        for (let x = xStart; x <= xEnd; x++) {
            for (let y = yStart; y <= yEnd; y++) {
                const key = `${x},${y}`;
                const bucket = this.cells.get(key);
                if (bucket) {
                    const idx = bucket.indexOf(entity);
                    if (idx !== -1)
                        bucket.splice(idx, 1);
                    if (bucket.length === 0)
                        this.cells.delete(key);
                }
            }
        }
    }
    query(x, y, radius) {
        const startX = Math.floor((x - radius) / this.cellSize);
        const endX = Math.floor((x + radius) / this.cellSize);
        const startY = Math.floor((y - radius) / this.cellSize);
        const endY = Math.floor((y + radius) / this.cellSize);
        const results = new Set();
        for (let i = startX; i <= endX; i++) {
            for (let j = startY; j <= endY; j++) {
                const key = `${i},${j}`;
                const bucket = this.cells.get(key);
                if (bucket) {
                    for (const item of bucket) {
                        results.add(item);
                    }
                }
            }
        }
        return Array.from(results);
    }
}
