"use strict";

/**
 * SocketClient for Agar.io Clone
 * Handles Socket.io communication and binary protocol decoding.
 */

const io = require('socket.io-client');

class SocketClient {
    constructor() {
        this.socket = null;
        this.callbacks = {};
        this.stateBuffer = [];
        this.playerName = '';
    }

    on(event, callback) {
        this.callbacks[event] = callback;
    }

    emit(event, data) {
        if (this.socket) {
            this.socket.emit(event, data);
        }
    }

    async join(roomName, options) {
        this.playerName = options.name || '';
        // In this architecture, roomName isn't strictly used for Socket.io rooms yet, 
        // but we pass the options as query params to identify the user type.
        this.socket = io({
            query: {
                type: options.type || 'player'
            }
        });

        this._setupHandlers();
        
        // Handshake moved inside the connect handler below
        
        return new Promise((resolve) => {
            this.socket.on('connect', () => {
                console.log('[Socket] Connected');
                // Send the 'gotit' handshake AFTER we are actually connected
                this.socket.emit('gotit', options);
                resolve(this.socket);
            });
        });
    }

    _setupHandlers() {
        this.socket.on('welcome', (playerSettings, gameSizes) => {
            if (this.callbacks['welcome']) {
                this.callbacks['welcome'](playerSettings, gameSizes);
            }
        });

        this.socket.on('disconnect', () => {
            if (this.callbacks['disconnect']) this.callbacks['disconnect']();
        });

        this.socket.on('kick', (reason) => {
            if (this.callbacks['kick']) this.callbacks['kick'](reason);
        });

        this.socket.on('RIP', () => {
            if (this.callbacks['RIP']) this.callbacks['RIP']();
        });

        this.socket.on('pongcheck', () => {
            if (this.callbacks['pongcheck']) this.callbacks['pongcheck']();
        });

        this.socket.on('playerJoin', (d) => {
            if (this.callbacks['playerJoin']) this.callbacks['playerJoin'](d);
        });

        this.socket.on('playerDisconnect', (d) => {
            if (this.callbacks['playerDisconnect']) this.callbacks['playerDisconnect'](d);
        });

        this.socket.on('playerDied', (d) => {
            if (this.callbacks['playerDied']) this.callbacks['playerDied'](d);
        });

        this.socket.on('leaderboard', (d) => {
            if (this.callbacks['leaderboard']) this.callbacks['leaderboard'](d);
        });

        this.socket.on('serverSendPlayerChat', (d) => {
            if (this.callbacks['serverSendPlayerChat']) this.callbacks['serverSendPlayerChat'](d);
        });

        // ── BINARY PROTOCOL DECODER ──
        this.socket.on('serverTellPlayerMove', (data) => {
            const update = this._decodeUpdate(data);
            if (!update) return;

            // Store in state buffer for interpolation
            this.stateBuffer.push({
                time: Date.now(),
                ...update
            });

            // Keep buffer size manageable (1 second)
            const cutoff = Date.now() - 1000;
            while (this.stateBuffer.length > 0 && this.stateBuffer[0].time < cutoff) {
                this.stateBuffer.shift();
            }
        });
    }

    _decodeUpdate(data) {
        const view = new DataView(data);
        let offset = 0;
        
        const msgType = view.getUint8(offset++);
        if (msgType !== 1) return null; // Only handle update packets

        // 1. Self Player Data
        const playerData = {
            x: view.getFloat32(offset, true),
            y: view.getFloat32(offset + 4, true),
            massTotal: view.getUint32(offset + 8, true),
            cells: []
        };
        offset += 12;
        const numSelfCells = view.getUint8(offset++);
        for (let i = 0; i < numSelfCells; i++) {
            playerData.cells.push({
                x: view.getFloat32(offset, true),
                y: view.getFloat32(offset + 4, true),
                mass: view.getFloat32(offset + 8, true),
                radius: view.getFloat32(offset + 12, true)
            });
            offset += 16;
        }
        
        // 2. Visible Other Players
        const visiblePlayers = [];
        const numPlayers = view.getUint8(offset++);
        for (let i = 0; i < numPlayers; i++) {
            const id = view.getUint32(offset, true); offset += 4;
            
            const nameLen = view.getUint8(offset++);
            const name = new TextDecoder().decode(new Uint8Array(data, offset, nameLen));
            offset += nameLen;
            
            const hue = view.getUint16(offset, true); offset += 2;
            const skinId = view.getUint8(offset++);

            const nCells = view.getUint8(offset++);
            const cells = [];
            for (let j = 0; j < nCells; j++) {
                cells.push({
                    x: view.getFloat32(offset, true),
                    y: view.getFloat32(offset + 4, true),
                    mass: view.getFloat32(offset + 8, true),
                    radius: view.getFloat32(offset + 12, true)
                });
                offset += 16;
            }
            visiblePlayers.push({ id, name, hue, skinId, cells });
        }
        
        // 3. Visible Food
        const visibleFood = [];
        const numFood = view.getUint16(offset, true); offset += 2;
        for (let i = 0; i < numFood; i++) {
            const id = view.getUint32(offset, true); offset += 4;
            visibleFood.push({
                id,
                x: view.getUint16(offset, true),
                y: view.getUint16(offset + 2, true),
                hue: view.getUint16(offset + 4, true),
                radius: 5
            });
            offset += 6;
        }
        
        // 4. Visible Mass
        const visibleMass = [];
        const numMass = view.getUint16(offset, true); offset += 2;
        for (let i = 0; i < numMass; i++) {
            const id = view.getUint32(offset, true); offset += 4;
            visibleMass.push({
                id,
                x: view.getFloat32(offset, true),
                y: view.getFloat32(offset + 4, true),
                mass: view.getFloat32(offset + 8, true),
                radius: view.getFloat32(offset + 12, true),
                hue: view.getUint16(offset + 16, true)
            });
            offset += 18;
        }
        
        // 5. Visible Viruses
        const visibleViruses = [];
        const numViruses = view.getUint16(offset, true); offset += 2;
        for (let i = 0; i < numViruses; i++) {
            const id = view.getUint32(offset, true); offset += 4;
            const vData = {
                id,
                x: view.getFloat32(offset, true),
                y: view.getFloat32(offset + 4, true),
                mass: view.getFloat32(offset + 8, true),
                radius: view.getFloat32(offset + 12, true)
            };
            offset += 16;
            const flags = view.getUint8(offset++);
            vData.isMoving = (flags & 1) !== 0;
            visibleViruses.push(vData);
        }
        
        return { playerData, visiblePlayers, visibleFood, visibleMass, visibleViruses };
    }

    syncState(global) {
        if (this.stateBuffer.length === 0) return;

        const INTERPOLATION_DELAY = 100; // ms
        const renderTime = Date.now() - INTERPOLATION_DELAY;

        // Find the two snapshots to interpolate between
        let prev = null;
        let next = null;
        for (let i = 0; i < this.stateBuffer.length - 1; i++) {
            if (this.stateBuffer[i].time <= renderTime && this.stateBuffer[i + 1].time > renderTime) {
                prev = this.stateBuffer[i];
                next = this.stateBuffer[i + 1];
                break;
            }
        }

        if (!prev || !next) {
            prev = this.stateBuffer[this.stateBuffer.length - 1];
            next = prev;
        }

        const factor = (next.time === prev.time) ? 0 : (renderTime - prev.time) / (next.time - prev.time);
        const lerp = (start, end, t) => start + (end - start) * t;

        // ── 1. LOCAL PLAYER (Exponential Smoothing) ──
        // We always use the LATEST data for the local player to minimize perceived lag
        const latest = this.stateBuffer[this.stateBuffer.length - 1];
        if (latest && latest.playerData && global.player) {
            global.player.id = this.socket.id;
            global.player.massTotal = latest.playerData.massTotal;
            
            const targetCells = latest.playerData.cells;
            const LERP_FACTOR = 0.3;

            if (!global.player.cells || global.player.cells.length !== targetCells.length) {
                global.player.cells = targetCells;
            } else {
                for (let i = 0; i < targetCells.length; i++) {
                    global.player.cells[i].x += (targetCells[i].x - global.player.cells[i].x) * LERP_FACTOR;
                    global.player.cells[i].y += (targetCells[i].y - global.player.cells[i].y) * LERP_FACTOR;
                    global.player.cells[i].radius += (targetCells[i].radius - global.player.cells[i].radius) * LERP_FACTOR;
                    global.player.cells[i].mass = targetCells[i].mass;
                }
            }

            if (global.player.cells.length > 0) {
                let tx = 0, ty = 0;
                global.player.cells.forEach(c => { tx += c.x; ty += c.y; });
                global.player.x = tx / global.player.cells.length;
                global.player.y = ty / global.player.cells.length;
            }
        }

        // ── 2. FOOD (Static) ──
        global.foods = latest.visibleFood;

        // ── 3. INTERPOLATED ENTITIES (Others, Viruses, Mass) ──
        global.users = [];
        prev.visiblePlayers.forEach((pPrev, idx) => {
            const pNext = next.visiblePlayers.find(np => np.id === pPrev.id);
            if (!pNext) return;

            const cells = [];
            pPrev.cells.forEach((cPrev, cIdx) => {
                const cNext = pNext.cells[cIdx] || cPrev;
                cells.push({
                    x: lerp(cPrev.x, cNext.x, factor),
                    y: lerp(cPrev.y, cNext.y, factor),
                    radius: lerp(cPrev.radius, cNext.radius, factor),
                    mass: cPrev.mass
                });
            });

            global.users.push({
                id: pPrev.id,
                name: pPrev.name,
                hue: pPrev.hue,
                skinId: pPrev.skinId,
                bodyColor: `hsl(${pPrev.hue}, 100%, 50%)`,
                cells
            });
        });

        global.fireFood = prev.visibleMass.map(mPrev => {
            const mNext = next.visibleMass.find(nm => nm.id === mPrev.id) || mPrev;
            return {
                id: mPrev.id,
                x: lerp(mPrev.x, mNext.x, factor),
                y: lerp(mPrev.y, mNext.y, factor),
                radius: lerp(mPrev.radius, mNext.radius, factor),
                mass: mPrev.mass,
                hue: mPrev.hue
            };
        });

        global.viruses = prev.visibleViruses.map(vPrev => {
            const vNext = next.visibleViruses.find(nv => nv.id === vPrev.id) || vPrev;
            return {
                id: vPrev.id,
                x: lerp(vPrev.x, vNext.x, factor),
                y: lerp(vPrev.y, vNext.y, factor),
                radius: lerp(vPrev.radius, vNext.radius, factor),
                mass: vPrev.mass,
                isMoving: vPrev.isMoving
            };
        });
    }

    close() {
        if (this.socket) this.socket.disconnect();
    }
}

module.exports = SocketClient;
