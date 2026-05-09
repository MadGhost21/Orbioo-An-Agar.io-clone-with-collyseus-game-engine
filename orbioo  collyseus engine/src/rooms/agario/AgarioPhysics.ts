// AgarioPhysics.ts – FIXED
// Changes:
//  • PlayerLogic gets customBodyColor / customShotColor fields for free RGB
//  • Added virusSplit() – when a cell hits a virus it explodes into pieces
//    (agar.io rule: splits into min(pieces, limitSplit) equal fragments)
//  • merge logic retained from previous fix

import { AgarioUtils } from "./AgarioUtils.js";
import { AgarioConfig } from "./AgarioConfig.js";
import * as SATPrimitive from 'sat';
const SAT: any = (SATPrimitive as any).default || SATPrimitive;

const MIN_SPEED        = 12.5;
const SPLIT_CELL_SPEED = 40;
const SPEED_DECREMENT  = 2.0;
const MIN_DISTANCE     = 50;
const MERGE_TIMER_MS   = AgarioConfig.mergeTimer * 1000;

export class Cell {
    x: number;
    y: number;
    mass: number;
    radius: number;
    speed: number;
    mergeAllowedAt: number = 0;
    blastAngle: number | null = null;

    constructor(x: number, y: number, mass: number, speed: number) {
        this.x      = x;
        this.y      = y;
        this.mass   = mass;
        this.radius = AgarioUtils.massToRadius(mass);
        this.speed  = speed;
    }

    setMass(mass: number) { this.mass = mass; this.recalculateRadius(); }
    addMass(mass: number) { this.setMass(this.mass + mass); }
    recalculateRadius()   { this.radius = AgarioUtils.massToRadius(this.mass); }

    toCircle() {
        return new SAT.Circle(new SAT.Vector(this.x, this.y), this.radius);
    }

    move(
        playerX: number, playerY: number,
        playerTarget: { x: number; y: number },
        slowBase: number, initMassLog: number
    ) {
        let deg: number;
        let dist: number | null = null;

        if (this.speed > MIN_SPEED && this.blastAngle !== null) {
            deg = this.blastAngle;
        } else {
            const target = { x: playerX - this.x + playerTarget.x, y: playerY - this.y + playerTarget.y };
            dist = Math.hypot(target.y, target.x);
            deg = Math.atan2(target.y, target.x);
        }

        let slowDown = 1;

        if (this.speed <= MIN_SPEED) {
            slowDown = AgarioUtils.mathLog(this.mass, slowBase) - initMassLog + 1;
        }

        let deltaY = (this.speed * Math.sin(deg)) / slowDown;
        let deltaX = (this.speed * Math.cos(deg)) / slowDown;

        if (this.speed > MIN_SPEED) this.speed -= SPEED_DECREMENT;

        if (dist !== null && dist < MIN_DISTANCE + this.radius) {
            const scale = dist / (MIN_DISTANCE + this.radius);
            deltaY *= scale;
            deltaX *= scale;
        }

        if (!isNaN(deltaY)) this.y += deltaY;
        if (!isNaN(deltaX)) this.x += deltaX;
    }

    static checkWhoAteWho(cellA: Cell, cellB: Cell): number {
        if (!cellA || !cellB) return 0;
        
        const dist = Math.hypot(cellA.x - cellB.x, cellA.y - cellB.y);
        
        // Agar.io rule: Center of smaller cell must be inside the larger cell
        // Also require at least a 10% mass difference to eat
        if (dist < cellA.radius && cellA.mass > cellB.mass * 1.1) {
            return 1; // A eats B
        }
        
        if (dist < cellB.radius && cellB.mass > cellA.mass * 1.1) {
            return 2; // B eats A
        }
        
        return 0;
    }
}

export class PlayerLogic {
    id: string;
    hue: number;
    skinId: string          = "default";
    customBodyColor: string | null = null;   // free RGB e.g. "#ff4400"
    customShotColor: string | null = null;
    name: string | null     = null;
    cells: Cell[]           = [];
    massTotal: number       = 0;
    x: number               = 0;
    y: number               = 0;
    target                  = { x: 0, y: 0 };
    lastHeartbeat: number   = Date.now();
    lastMassLossTime: number = Date.now();
    lastActionTime: number  = Date.now();
    
    // Spawn Protection (V1.4.2)
    spawnShield: boolean = false;
    shieldExpireTime: number = 0;

    constructor(id: string) {
        this.id  = id;
        this.hue = Math.round(Math.random() * 360);
    }

    init(position: { x: number; y: number }, defaultPlayerMass: number) {
        this.cells     = [new Cell(position.x, position.y, defaultPlayerMass, MIN_SPEED)];
        this.massTotal = defaultPlayerMass;
        this.x         = position.x;
        this.y         = position.y;
        this.lastMassLossTime = Date.now();
    }

    loseMassIfNeeded(massLossRate: number, defaultPlayerMass: number, minMassLoss: number) {
        if (this.massTotal > minMassLoss && Date.now() - this.lastMassLossTime > 2000) {
            // Find the largest cell to subtract from
            let maxIndex = 0;
            for (let i = 1; i < this.cells.length; i++) {
                if (this.cells[i].mass > this.cells[maxIndex].mass) maxIndex = i;
            }
            // Proportional decay: 0.2% of total mass, minimum of 1
            const massToSubtract = Math.max(1, Math.floor(this.massTotal * massLossRate));
            // Only subtract if the target cell remains above defaultPlayerMass after the loss
            if (this.cells[maxIndex].mass - massToSubtract > defaultPlayerMass) {
                this.changeCellMass(maxIndex, -massToSubtract);
                this.lastMassLossTime = Date.now();
            }
        }
    }

    changeCellMass(cellIndex: number, diff: number) {
        this.cells[cellIndex].addMass(diff);
        this.massTotal += diff;
        // Clamp to avoid negative mass — only fix the cell's mass,
        // do NOT touch massTotal again (addMass already updated it above)
        if (this.cells[cellIndex].mass < AgarioConfig.defaultPlayerMass) {
            this.massTotal += (AgarioConfig.defaultPlayerMass - this.cells[cellIndex].mass);
            this.cells[cellIndex].setMass(AgarioConfig.defaultPlayerMass);
        }
    }

    removeCell(cellIndex: number): boolean {
        this.massTotal -= this.cells[cellIndex].mass;
        this.cells.splice(cellIndex, 1);
        return this.cells.length === 0;
    }

    splitCell(cellIndex: number, maxRequestedPieces: number, defaultPlayerMass: number, baseAngle: number | null = null) {
        const cellToSplit     = this.cells[cellIndex];
        const maxAllowedPieces = Math.floor(cellToSplit.mass / defaultPlayerMass);
        const piecesToCreate   = Math.min(maxAllowedPieces, maxRequestedPieces);
        console.log(`[AgarioPhysics] splitCell idx:${cellIndex} mass:${cellToSplit.mass} req:${maxRequestedPieces} allowed:${maxAllowedPieces} result:${piecesToCreate}`);

        if (piecesToCreate < 2) return;

        const newMass  = cellToSplit.mass / piecesToCreate;
        
        // Dynamic Merge Formula: 30s base + (mass / 150), capped at 90s
        const dynamicMergeSeconds = Math.min(90, 30 + (cellToSplit.mass / 150));
        const mergeAt = Date.now() + (dynamicMergeSeconds * 1000);

        for (let i = 0; i < piecesToCreate - 1; i++) {
            const nc = new Cell(cellToSplit.x, cellToSplit.y, newMass, SPLIT_CELL_SPEED);
            nc.mergeAllowedAt = mergeAt;
            // If it's a virus explosion, distribute in a circle
            if (baseAngle !== null) {
                nc.blastAngle = baseAngle + (i * (Math.PI * 2 / (piecesToCreate)));
            }
            this.cells.push(nc);
        }
        cellToSplit.setMass(newMass);
        cellToSplit.mergeAllowedAt = mergeAt;
        if (baseAngle !== null) {
            cellToSplit.blastAngle = baseAngle + ((piecesToCreate - 1) * (Math.PI * 2 / (piecesToCreate)));
            cellToSplit.speed = SPLIT_CELL_SPEED;
        }
    }

    userSplit(maxCells: number, defaultPlayerMass: number) {
        let cellsToCreate = this.cells.length > maxCells / 2
            ? maxCells - this.cells.length + 1
            : this.cells.length;
        if (this.cells.length > maxCells / 2) this.cells.sort((a, b) => b.mass - a.mass);
        for (let i = 0; i < cellsToCreate; i++) this.splitCell(i, 2, defaultPlayerMass);
    }

    // ── Virus split (Agar.io accurate mechanics) ──────────
    // Rules:
    //   1. If player is already at limitSplit cells → absorb the virus for mass only.
    //   2. Otherwise split the colliding cell into enough pieces to reach limitSplit.
    //   3. Parent cell retains 40–50% of its original mass.
    //   4. Remaining mass is split into fixed-mass minions (15–20 mass each).
    //   5. All minions are blasted outward in a radial 360° pattern.
    virusSplit(cellIndex: number, limitSplit: number, defaultPlayerMass: number) {
        const cell = this.cells[cellIndex];
        if (!cell) return;

        // Rule 1: Already at cell cap → absorb virus mass, no explosion.
        if (this.cells.length >= limitSplit) {
            console.log(`[AgarioPhysics] virusSplit ABSORBED (at cap) idx:${cellIndex} mass:${cell.mass}`);
            this.changeCellMass(cellIndex, 50); // absorb virus mass bonus
            return;
        }

        const originalMass = cell.mass;

        // Rule 3: Parent retains 45% of original mass (midpoint of 40-50%).
        const parentMass = Math.max(defaultPlayerMass, Math.floor(originalMass * 0.45));

        // Rule 4: Each minion gets a fixed small mass of 15-20.
        const minionMass = Math.max(defaultPlayerMass, Math.min(20, Math.floor((originalMass - parentMass) / Math.max(1, limitSplit - this.cells.length))));

        // How many minions can we create from the remaining mass?
        const remainingMass = originalMass - parentMass;
        const maxMinionsByMass = Math.floor(remainingMass / minionMass);
        const slotsAvailable = limitSplit - this.cells.length; // how many new cells we can add
        const minionCount = Math.min(maxMinionsByMass, slotsAvailable);

        console.log(`[AgarioPhysics] virusSplit EXPLODE idx:${cellIndex} originalMass:${originalMass} parentMass:${parentMass} minionMass:${minionMass} minionCount:${minionCount}`);

        if (minionCount < 1) {
            // Not enough mass for even one minion — just absorb
            this.changeCellMass(cellIndex, 50);
            return;
        }

        // Dynamic Merge Formula: 30s base + (mass / 150), capped at 90s
        const dynamicMergeSeconds = Math.min(90, 30 + (originalMass / 150));
        const mergeAt = Date.now() + (dynamicMergeSeconds * 1000);
        
        // Blast Radius Adjustment: 1.1x to 1.3x speed for 100-150px range
        const blastSpeed = SPLIT_CELL_SPEED * 1.2; 

        // Rule 5: Radial blast pattern — distribute minions evenly in 360°.
        const angleStep = (Math.PI * 2) / minionCount;
        const baseAngle = Math.random() * Math.PI * 2; // random starting angle

        for (let i = 0; i < minionCount; i++) {
            const nc = new Cell(cell.x, cell.y, minionMass, blastSpeed);
            nc.mergeAllowedAt = mergeAt;
            nc.blastAngle = baseAngle + (i * angleStep);
            this.cells.push(nc);
        }

        // Rule 3: Set parent cell to its retained mass.
        cell.setMass(parentMass);
        cell.mergeAllowedAt = mergeAt;
        // Parent cell blasts in the opposite direction of the first minion.
        cell.blastAngle = baseAngle + Math.PI;
        cell.speed = blastSpeed * 0.5; // parent moves slower

        // Recalculate total mass from scratch to keep it accurate.
        this.massTotal = this.cells.reduce((sum, c) => sum + c.mass, 0);
    }

    mergeCells() {
        if (this.cells.length <= 1) return;
        const now = Date.now();
        
        // Find the largest cell to act as the primary merge target
        let maxIndex = 0;
        for (let i = 1; i < this.cells.length; i++) {
            if (this.cells[i].mass > this.cells[maxIndex].mass) maxIndex = i;
        }
        const primary = this.cells[maxIndex];

        for (let i = this.cells.length - 1; i >= 0; i--) {
            if (i === maxIndex) continue;
            const other = this.cells[i];
            
            // If both cells are ready to merge
            if (now >= primary.mergeAllowedAt && now >= other.mergeAllowedAt) {
                const dist = Math.hypot(primary.x - other.x, primary.y - other.y);
                // Standard merge distance: overlapping centers or significantly touching
                if (dist < primary.radius * 0.8) {
                    primary.addMass(other.mass);
                    this.cells.splice(i, 1);
                    // Update maxIndex if elements shift
                    if (i < maxIndex) maxIndex--; 
                }
            }
        }
        this.massTotal = this.cells.reduce((sum, c) => sum + c.mass, 0);
    }

    move(slowBase: number, gameWidth: number, gameHeight: number, initMassLog: number) {
        if (this.cells.length === 0) return;
        this.mergeCells();
        const now = Date.now();

        // ── Largest Cell Centering ──
        // Find the largest cell to be the anchor for the camera and movement
        let maxIndex = 0;
        for (let i = 1; i < this.cells.length; i++) {
            if (this.cells[i].mass > this.cells[maxIndex].mass) maxIndex = i;
        }
        const largestCell = this.cells[maxIndex];

        for (let i = 0; i < this.cells.length; i++) {
            const cell = this.cells[i];
            cell.move(this.x, this.y, this.target, slowBase, initMassLog);
            
            // ── Self-Collision Repulsion (Anti-Overlap) ──
            // If cells are not ready to merge, they should push away from each other
            for (let j = i + 1; j < this.cells.length; j++) {
                const other = this.cells[j];
                // Check if either cell is still on merge cooldown
                if (now < cell.mergeAllowedAt || now < other.mergeAllowedAt) {
                    const dx = other.x - cell.x;
                    const dy = other.y - cell.y;
                    const distance = Math.hypot(dx, dy);
                    const minDistance = cell.radius + other.radius;

                    if (distance < minDistance) {
                        // Stronger repulsion to ensure they don't hide inside each other
                        const overlap = minDistance - distance;
                        const force = (overlap / minDistance) * 4.0; 
                        const angle = Math.atan2(dy, dx);
                        const moveX = Math.cos(angle) * force;
                        const moveY = Math.sin(angle) * force;

                        cell.x -= moveX;
                        cell.y -= moveY;
                        other.x += moveX;
                        other.y += moveY;
                    }
                }
            }

            const r = cell.radius;
            // Clamping center to 60% of radius means 40% of the radius can cross the border line
            const clampOffset = r * 0.6; 
            if (cell.x < clampOffset)              cell.x = clampOffset;
            if (cell.x > gameWidth - clampOffset)  cell.x = gameWidth - clampOffset;
            if (cell.y < clampOffset)              cell.y = clampOffset;
            if (cell.y > gameHeight - clampOffset) cell.y = gameHeight - clampOffset;
        }

        // Camera Tracking: Largest Cell Priority
        this.x = largestCell.x;
        this.y = largestCell.y;
    }
}
