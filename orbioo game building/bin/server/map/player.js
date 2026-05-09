"use strict";

const util = require('../lib/util');
const sat = require('sat');
const gameLogic = require('../game-logic');

const MIN_SPEED = 6.25;
const SPLIT_CELL_SPEED = 20;
const SPEED_DECREMENT = 0.5;
const MIN_DISTANCE = 50;
const PUSHING_AWAY_SPEED = 1.1;
const MERGE_TIMER = 15;

class Cell {
    constructor(x, y, mass, speed) {
        this.x = x;
        this.y = y;
        this.mass = mass;
        this.radius = util.massToRadius(mass);
        this.speed = speed;
        this.blastAngle = null;
    }

    setMass(mass) {
        this.mass = mass;
        this.recalculateRadius();
    }

    addMass(mass) {
        this.setMass(this.mass + mass);
    }

    recalculateRadius() {
        this.radius = util.massToRadius(this.mass);
    }

    toCircle() {
        return new sat.Circle(new sat.Vector(this.x, this.y), this.radius);
    }

    move(playerX, playerY, playerTarget, slowBase, initMassLog) {
        var deg;
        var dist = null;

        if (this.speed > MIN_SPEED && this.blastAngle !== null) {
            deg = this.blastAngle;
        } else {
            var target = {
                x: playerX - this.x + playerTarget.x,
                y: playerY - this.y + playerTarget.y
            };
            dist = Math.hypot(target.y, target.x);
            deg = Math.atan2(target.y, target.x);
        }

        var slowDown = 1;
        if (this.speed <= MIN_SPEED) {
            slowDown = util.mathLog(this.mass, slowBase) - initMassLog + 1;
        }

        var deltaY = this.speed * Math.sin(deg) / slowDown;
        var deltaX = this.speed * Math.cos(deg) / slowDown;

        if (this.speed > MIN_SPEED) {
            this.speed -= SPEED_DECREMENT;
        }

        if (dist !== null && dist < (MIN_DISTANCE + this.radius)) {
            deltaY *= dist / (MIN_DISTANCE + this.radius);
            deltaX *= dist / (MIN_DISTANCE + this.radius);
        }

        if (!isNaN(deltaY)) {
            this.y += deltaY;
        }
        if (!isNaN(deltaX)) {
            this.x += deltaX;
        }
    }

    // 0: nothing happened
    // 1: A ate B
    // 2: B ate A
    static checkWhoAteWho(cellA, cellB) {
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

exports.Player = class {
    constructor(id) {
        this.id = id;
        this.hue = Math.round(Math.random() * 360);
        this.name = null;
        this.admin = false;
        this.screenWidth = null;
        this.screenHeight = null;
        this.timeToMerge = null;
        this.lastMassLossTime = Date.now();
        this.setLastHeartbeat();
    }

    /* Initalizes things that change with every respawn */
    init(position, defaultPlayerMass) {
        this.cells = [new Cell(position.x, position.y, defaultPlayerMass, MIN_SPEED)];
        this.massTotal = defaultPlayerMass;
        this.x = position.x;
        this.y = position.y;
        this.target = {
            x: 0,
            y: 0
        };
        this.lastMassLossTime = Date.now();
    }

    clientProvidedData(playerData) {
        this.name = playerData.name;
        this.hue = playerData.hue || this.hue;
        // Map skinId string to a numeric index for the binary protocol
        const skinMap = { 'default': 0, 'bitcoin': 1, 'pi': 2 };
        this.skinId = skinMap[playerData.skinId] || 0;
        this.screenWidth = playerData.screenWidth;
        this.screenHeight = playerData.screenHeight;
        this.setLastHeartbeat();
    }

    setLastHeartbeat() {
        this.lastHeartbeat = Date.now();
    }

    setLastSplit() {
        this.timeToMerge = Date.now() + 1000 * MERGE_TIMER;
    }

    loseMassIfNeeded(massLossRate, defaultPlayerMass, minMassLoss) {
        if (this.massTotal > minMassLoss && Date.now() - this.lastMassLossTime > 2000) {
            let maxIndex = 0;
            for (let i = 1; i < this.cells.length; i++) {
                if (this.cells[i].mass > this.cells[maxIndex].mass) maxIndex = i;
            }
            const massToSubtract = Math.max(1, Math.floor(this.massTotal * massLossRate));
            if (this.cells[maxIndex].mass - massToSubtract > defaultPlayerMass) {
                this.changeCellMass(maxIndex, -massToSubtract);
                this.lastMassLossTime = Date.now();
            }
        }
    }

    changeCellMass(cellIndex, massDifference) {
        this.cells[cellIndex].addMass(massDifference)
        this.massTotal += massDifference;
    }

    removeCell(cellIndex) {
        this.massTotal -= this.cells[cellIndex].mass;
        this.cells.splice(cellIndex, 1);
        return this.cells.length === 0;
    }


    // Splits a cell into multiple cells with identical mass
    // Creates n-1 new cells, and lowers the mass of the original cell
    // If the resulting cells would be smaller than defaultPlayerMass, creates fewer and bigger cells.
    splitCell(cellIndex, maxRequestedPieces, defaultPlayerMass, baseAngle = null) {
        let cellToSplit = this.cells[cellIndex];
        let maxAllowedPieces = Math.floor(cellToSplit.mass / defaultPlayerMass); // If we split the cell ino more pieces, they will be too small.
        let piecesToCreate = Math.min(maxAllowedPieces, maxRequestedPieces);
        console.log(`[SplitCell] cellIndex: ${cellIndex}, mass: ${cellToSplit.mass}, requested: ${maxRequestedPieces}, allowed: ${maxAllowedPieces}, creating: ${piecesToCreate}`);
        if (piecesToCreate < 2) {
            return;
        }
        let newCellsMass = cellToSplit.mass / piecesToCreate;
        
        // Dynamic Merge Formula: 30s base + (mass / 150), capped at 90s
        const dynamicMergeSeconds = Math.min(90, 30 + (cellToSplit.mass / 150));
        const mergeAt = Date.now() + (dynamicMergeSeconds * 1000);

        for (let i = 0; i < piecesToCreate - 1; i++) {
            const nc = new Cell(cellToSplit.x, cellToSplit.y, newCellsMass, SPLIT_CELL_SPEED);
            nc.mergeAllowedAt = mergeAt;
            if (baseAngle !== null) {
                 nc.blastAngle = baseAngle + (i * (Math.PI * 2 / piecesToCreate));
            }
            this.cells.push(nc);
        }
        cellToSplit.setMass(newCellsMass)
        cellToSplit.mergeAllowedAt = mergeAt;
        if (baseAngle !== null) {
            cellToSplit.blastAngle = baseAngle + ((piecesToCreate - 1) * (Math.PI * 2 / piecesToCreate));
            cellToSplit.speed = SPLIT_CELL_SPEED;
        }
        this.setLastSplit();
    }

    // Performs a split resulting from colliding with a virus.
    // Agar.io accurate mechanics:
    //   1. If already at maxCells → absorb virus for +50 mass, no explosion.
    //   2. Parent cell retains 45% of its original mass.
    //   3. Minions have a fixed small mass (15–20 each).
    //   4. All minions are blasted outward in a radial 360° pattern.
    virusSplit(cellIndexes, maxCells, defaultPlayerMass) {
        for (let cellIndex of cellIndexes) {
            const cell = this.cells[cellIndex];
            if (!cell) continue;

            // Rule 1: Already at cell cap → absorb virus for mass bonus only.
            if (this.cells.length >= maxCells) {
                console.log(`[VirusSplit] ABSORBED (at cap) idx: ${cellIndex}, mass: ${cell.mass}`);
                this.changeCellMass(cellIndex, 50);
                continue;
            }

            const originalMass = cell.mass;

            // Rule 2: Parent retains 45% of original mass.
            const parentMass = Math.max(defaultPlayerMass, Math.floor(originalMass * 0.45));

            // Rule 3: Minions get fixed small mass of 15-20.
            const slotsAvailable = maxCells - this.cells.length;
            const minionMass = Math.max(defaultPlayerMass, Math.min(20, Math.floor((originalMass - parentMass) / Math.max(1, slotsAvailable))));

            const remainingMass = originalMass - parentMass;
            const maxMinionsByMass = Math.floor(remainingMass / minionMass);
            const minionCount = Math.min(maxMinionsByMass, slotsAvailable);

            console.log(`[VirusSplit] EXPLODE idx: ${cellIndex}, originalMass: ${originalMass}, parentMass: ${parentMass}, minionMass: ${minionMass}, minionCount: ${minionCount}`);

            if (minionCount < 1) {
                // Not enough mass — just absorb
                this.changeCellMass(cellIndex, 50);
                continue;
            }

            // Dynamic Merge Formula: 30s base + (mass / 150), capped at 90s
            const dynamicMergeSeconds = Math.min(90, 30 + (originalMass / 150));
            const mergeAt = Date.now() + (dynamicMergeSeconds * 1000);
            
            // Blast Radius Adjustment: 1.1x to 1.3x speed for 100-150px range
            const blastSpeed = SPLIT_CELL_SPEED * 1.2;

            // Rule 4: Radial blast — distribute minions evenly in 360°.
            const angleStep = (Math.PI * 2) / minionCount;
            const baseAngle = Math.random() * Math.PI * 2;

            for (let i = 0; i < minionCount; i++) {
                const nc = new Cell(cell.x, cell.y, minionMass, blastSpeed);
                nc.mergeAllowedAt = mergeAt;
                nc.blastAngle = baseAngle + (i * angleStep);
                this.cells.push(nc);
            }

            // Rule 2: Set parent to retained mass, blast it in the opposite direction.
            cell.setMass(parentMass);
            cell.mergeAllowedAt = mergeAt;
            cell.blastAngle = baseAngle + Math.PI;
            cell.speed = blastSpeed * 0.5;

            this.setLastSplit();

            // Recalculate massTotal accurately.
            this.massTotal = this.cells.reduce((sum, c) => sum + c.mass, 0);
        }
    }

    // Performs a split initiated by the player.
    // Tries to split every cell in half.
    userSplit(maxCells, defaultPlayerMass) {
        let cellsToCreate;
        if (this.cells.length > maxCells / 2) { // Not every cell can be split
            cellsToCreate = maxCells - this.cells.length + 1;

            this.cells.sort(function (a, b) { // Sort the cells so the biggest ones will be split
                return b.mass - a.mass;
            });
        } else { // Every cell can be split
            cellsToCreate = this.cells.length;
        }

        for (let i = 0; i < cellsToCreate; i++) {
            this.splitCell(i, 2, defaultPlayerMass);
        }
    }

    // Loops trough cells, and calls callback with colliding ones
    // Passes the colliding cells and their indexes to the callback
    // null values are skipped during the iteration and removed at the end
    enumerateCollidingCells(callback) {
        for (let cellAIndex = 0; cellAIndex < this.cells.length; cellAIndex++) {
            let cellA = this.cells[cellAIndex];
            if (!cellA) continue; // cell has already been merged

            for (let cellBIndex = cellAIndex + 1; cellBIndex < this.cells.length; cellBIndex++) {
                let cellB = this.cells[cellBIndex];
                if (!cellB) continue;
                let colliding = sat.testCircleCircle(cellA.toCircle(), cellB.toCircle());
                if (colliding) {
                    callback(this.cells, cellAIndex, cellBIndex);
                }
            }
        }

        this.cells = util.removeNulls(this.cells);
    }

    mergeCollidingCells() {
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
            if (now >= (primary.mergeAllowedAt || 0) && now >= (other.mergeAllowedAt || 0)) {
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

    pushAwayCollidingCells() {
        this.enumerateCollidingCells(function (cells, cellAIndex, cellBIndex) {
            let cellA = cells[cellAIndex],
                cellB = cells[cellBIndex],
                vector = new sat.Vector(cellB.x - cellA.x, cellB.y - cellA.y); // vector pointing from A to B
            vector = vector.normalize().scale(PUSHING_AWAY_SPEED, PUSHING_AWAY_SPEED);
            if (vector.len() == 0) { // The two cells are perfectly on the top of each other
                vector = new sat.Vector(0, 1);
            }

            cellA.x -= vector.x;
            cellA.y -= vector.y;

            cellB.x += vector.x;
            cellB.y += vector.y;
        });
    }

    move(slowBase, gameWidth, gameHeight, initMassLog) {
        this.mergeCollidingCells();
        const now = Date.now();

        // ── Largest Cell Centering ──
        // Find the largest cell to be the anchor for the camera and movement
        let maxIndex = 0;
        for (let i = 1; i < this.cells.length; i++) {
            if (this.cells[i].mass > this.cells[maxIndex].mass) maxIndex = i;
        }
        const largestCell = this.cells[maxIndex];

        for (let i = 0; i < this.cells.length; i++) {
            let cell = this.cells[i];
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
                        const overlap = minDistance - distance;
                        const force = (overlap / minDistance) * 2.0; 
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

            // Allow cells to partially cross the border (40% of radius crossing, 60% remaining inside)
            gameLogic.adjustForBoundaries(cell, cell.radius * 0.6, 0, gameWidth, gameHeight);
        }

        // Camera Tracking: Largest Cell Priority
        this.x = largestCell.x;
        this.y = largestCell.y;
    }

    // Calls `callback` if any of the two cells ate the other.
    static checkForCollisions(playerA, playerB, playerAIndex, playerBIndex, callback) {
        for (let cellAIndex in playerA.cells) {
            for (let cellBIndex in playerB.cells) {
                let cellA = playerA.cells[cellAIndex];
                let cellB = playerB.cells[cellBIndex];

                let cellAData = { playerIndex: playerAIndex, cellIndex: cellAIndex };
                let cellBData = { playerIndex: playerBIndex, cellIndex: cellBIndex };

                let whoAteWho = Cell.checkWhoAteWho(cellA, cellB);

                if (whoAteWho == 1) {
                    callback(cellBData, cellAData);
                } else if (whoAteWho == 2) {
                    callback(cellAData, cellBData);
                }
            }
        }
    }
}
exports.PlayerManager = class {
    constructor() {
        this.data = [];
    }

    pushNew(player) {
        this.data.push(player);
    }

    findIndexByID(id) {
        return util.findIndex(this.data, id);
    }

    removePlayerByID(id) {
        let index = this.findIndexByID(id);
        if (index > -1) {
            this.removePlayerByIndex(index);
        }
    }

    removePlayerByIndex(index) {
        this.data.splice(index, 1);
    }

    shrinkCells(massLossRate, defaultPlayerMass, minMassLoss) {
        for (let player of this.data) {
            player.loseMassIfNeeded(massLossRate, defaultPlayerMass, minMassLoss);
        }
    }

    removeCell(playerIndex, cellIndex) {
        return this.data[playerIndex].removeCell(cellIndex);
    }

    getCell(playerIndex, cellIndex) {
        return this.data[playerIndex].cells[cellIndex]
    }

    handleCollisions(callback) {
        for (let playerAIndex = 0; playerAIndex < this.data.length; playerAIndex++) {
            for (let playerBIndex = playerAIndex + 1; playerBIndex < this.data.length; playerBIndex++) {
                exports.Player.checkForCollisions(
                    this.data[playerAIndex],
                    this.data[playerBIndex],
                    playerAIndex,
                    playerBIndex,
                    callback
                );
            }
        }
    }

    getTopPlayers() {
        this.data.sort(function (a, b) { return b.massTotal - a.massTotal; });
        var topPlayers = [];
        for (var i = 0; i < Math.min(10, this.data.length); i++) {
            topPlayers.push({
                id: this.data[i].id,
                name: this.data[i].name
            });
        }
        return topPlayers;
    }

    getTotalMass() {
        let result = 0;
        for (let player of this.data) {
            result += player.massTotal;
        }
        return result;
    }
}
