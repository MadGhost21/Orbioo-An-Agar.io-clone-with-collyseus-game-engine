// colyseus-client.js – v6 (Project V1.4.5)
// Changes: reads skinId from schema and passes to global.users / global.player

const { Client } = require('@colyseus/sdk');

class ColyseusClient {
    constructor(endpoint = 'ws://localhost:2567') {
        this.client       = new Client(endpoint);
        this.room         = null;
        this.callbacks    = {};
        this.playerName   = '';
        this._pendingMsgs = [];
        this._welcomed    = false;
        this.stateBuffer  = [];
        
        // Bandwidth tracking
        this.bytesIn      = 0;
        this.bytesOut     = 0;
        this.kbpsIn       = 0;
        this.kbpsOut      = 0;
        this._lastTrackTime = Date.now();
    }

    on(event, callback) { this.callbacks[event] = callback; }

    emit(event, data) {
        if (!this.room) {
            if (this._pendingMsgs.length < 50) this._pendingMsgs.push({ event, data });
            return;
        }
        // Estimate outgoing bytes (rough approximation)
        const payload = JSON.stringify(data);
        this.bytesOut += event.length + (payload ? payload.length : 0);
        this.room.send(event, data);
    }

    setSkin(payload) { this.emit('setSkin', payload); }

    async join(roomName, options) {
        try {
            this.playerName = options?.name ?? '';
            this.room = await this.client.joinOrCreate(roomName, options);
            console.log('[Colyseus] Joined:', this.room.roomId || this.room.id);
            while (this._pendingMsgs.length > 0) {
                const msg = this._pendingMsgs.shift();
                this.room.send(msg.event, msg.data);
            }
            this._setupRoomHandlers();
            return this.room;
        } catch (e) {
            console.error('[Colyseus] Join error:', e);
            throw e;
        }
    }

    _setupRoomHandlers() {
        this.room.onStateChange((state) => {
            if (!this._welcomed) {
                if ((state.gameWidth || 0) > 0 && (state.gameHeight || 0) > 0) {
                    this._fireWelcome(state);
                    this._snapshotState(state);
                }
            } else {
                this._snapshotState(state);
            }
        });
        setTimeout(() => {
            if (!this._welcomed && this.room?.state) {
                this._fireWelcome(this.room.state);
                this._snapshotState(this.room.state);
            }
        }, 3000);

        this.room.onLeave((code) => {
            if (window.addDebugLine) window.addDebugLine('Left (code ' + code + ').');
            if (this.callbacks['disconnect']) this.callbacks['disconnect']();
        });

        this.room.onMessage('kick',   (r)  => { if (this.callbacks['kick'])   this.callbacks['kick'](r); });
        this.room.onMessage('death',  (m)  => { if (window.onPlayerDeath) window.onPlayerDeath(m); });
        this.room.onMessage('RIP',    ()   => { if (this.callbacks['RIP'])    this.callbacks['RIP'](); });
        this.room.onMessage('pongcheck', () => { if (this.callbacks['pongcheck']) this.callbacks['pongcheck'](); });
        this.room.onMessage('serverSendPlayerChat', (d) => { if (this.callbacks['serverSendPlayerChat']) this.callbacks['serverSendPlayerChat'](d); });
        this.room.onMessage('playerJoin',       (d) => { if (this.callbacks['playerJoin'])       this.callbacks['playerJoin'](d); });
        this.room.onMessage('playerDisconnect', (d) => { if (this.callbacks['playerDisconnect']) this.callbacks['playerDisconnect'](d); });
        this.room.onMessage('playerDied',       (d) => { if (this.callbacks['playerDied'])       this.callbacks['playerDied'](d); });
        this.room.onMessage('leaderboard',      (d) => { if (this.callbacks['leaderboard'])      this.callbacks['leaderboard'](d); });

        // Hook into the underlying transport to track incoming bytes
        if (this.room.connection && this.room.connection.transport) {
            const transport = this.room.connection.transport;
            const originalOnMessage = transport.onmessage;
            transport.onmessage = (event) => {
                if (event.data) {
                    this.bytesIn += (event.data.byteLength || event.data.length || 0);
                }
                if (originalOnMessage) originalOnMessage.call(transport, event);
            };
        }
    }

    _fireWelcome(state) {
        this._welcomed = true;
        if (this.callbacks['welcome']) {
            this.callbacks['welcome'](
                { id: this.room.sessionId, name: this.playerName, massTotal: 10, cells: [] },
                { width: state.gameWidth || 5000, height: state.gameHeight || 5000 }
            );
        }
    }

    _snapshotState(state) {
        const snapshot = {
            time: Date.now(),
            users: {},
            massFood: {},
            viruses: {}
        };
        
        if (state.players) {
            state.players.forEach((p, id) => {
                if (id === this.room.sessionId) return;
                if (!p.cells) return;
                snapshot.users[id] = { cells: p.cells.map(c => ({ x: c.x || 0, y: c.y || 0, radius: c.radius || 0 })) };
            });
        }
        
        if (state.massFood) {
            state.massFood.forEach((m, id) => {
                if (m) snapshot.massFood[id] = { x: m.x || 0, y: m.y || 0, radius: m.radius || 0 };
            });
        }
        
        if (state.viruses) {
            state.viruses.forEach((v, id) => {
                if (v) snapshot.viruses[id] = { x: v.x || 0, y: v.y || 0, radius: v.radius || 0 };
            });
        }
        
        this.stateBuffer.push(snapshot);
        const cutoff = Date.now() - 1000;
        while (this.stateBuffer.length > 0 && this.stateBuffer[0].time < cutoff) {
            this.stateBuffer.shift();
        }
    }

    syncState(global) {
        // Update bandwidth stats once per second
        const now = Date.now();
        const dt = (now - this._lastTrackTime) / 1000;
        if (dt >= 1.0) {
            this.kbpsIn = (this.bytesIn / 1024) / dt;
            this.kbpsOut = (this.bytesOut / 1024) / dt;
            this.bytesIn = 0;
            this.bytesOut = 0;
            this._lastTrackTime = now;
        }

        if (!this.room?.state) return;
        const state = this.room.state;
        if (!state.players) return;

        // ── 1. LOCAL PLAYER (Exponential Smoothing) ──
        const myPlayer = state.players.get(this.room.sessionId);
        if (myPlayer && global.player) {
            global.player.id        = this.room.sessionId;
            global.player.massTotal = myPlayer.score     || 0;
            // Server uses 'hue' + 'customColor' + 'skinId' — map to client bodyColor/shotColor
            const hue = myPlayer.hue || 200;
            global.player.bodyColor = myPlayer.customColor || `hsl(${hue},100%,50%)`;
            global.player.shotColor = `hsl(${(hue + 60) % 360},100%,50%)`;
            global.player.skinId    = myPlayer.skinId    || 'default';
            global.player.name      = myPlayer.name      || this.playerName;
            global.player.isAFK     = myPlayer.isAFK     || false;
            global.player.afkTime   = myPlayer.afkTime   || 0;

            const targetCells = [];
            if (myPlayer.cells) {
                myPlayer.cells.forEach(c => {
                    if (c) targetCells.push({ x: c.x || 0, y: c.y || 0, mass: c.mass || 0, radius: c.radius || 0 });
                });
            }
            
            const LERP_FACTOR = 0.3; 
            
            if (!global.player.cells || global.player.cells.length !== targetCells.length) {
                global.player.cells = targetCells;
            } else {
                for (let i = 0; i < targetCells.length; i++) {
                    if (!global.player.cells[i]) continue;
                    global.player.cells[i].x += (targetCells[i].x - global.player.cells[i].x) * LERP_FACTOR;
                    global.player.cells[i].y += (targetCells[i].y - global.player.cells[i].y) * LERP_FACTOR;
                    global.player.cells[i].radius += (targetCells[i].radius - global.player.cells[i].radius) * LERP_FACTOR;
                    global.player.cells[i].mass = targetCells[i].mass;
                }
            }

            if (global.player.cells.length > 0) {
                // Largest Cell Priority Camera: Center on the cell with highest mass
                let largestCell = global.player.cells[0];
                for (let i = 1; i < global.player.cells.length; i++) {
                    if (global.player.cells[i].mass > largestCell.mass) {
                        largestCell = global.player.cells[i];
                    }
                }
                global.player.x = largestCell.x;
                global.player.y = largestCell.y;
            }
        }

        // ── 2. FOOD (Grid-based, AOI filtered by server) ──
        // Guard: state.grid may be a Colyseus StateView proxy in cluster mode — use safe iteration
        const gridMap = (state.grid && typeof state.grid.forEach === 'function') ? state.grid : null;
        if (gridMap) {
            let foodsCount = 0;
            const foods = [];
            try { gridMap.forEach((sector, key) => {
                if (sector && sector.d) {
                    const parts = key.split(',');
                    const sx = parseInt(parts[0]);
                    const sy = parseInt(parts[1]);
                    // Convert Base64 string to Uint8Array (V1.4.5)
                    const binaryString = atob(sector.d);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let j = 0; j < binaryString.length; j++) {
                        bytes[j] = binaryString.charCodeAt(j);
                    }

                    const cellSize = 250;
                    for (let i = 0; i < bytes.length; i += 3) {
                        const rx = bytes[i];
                        const ry = bytes[i+1];
                        const h  = bytes[i+2] * 2;
                        
                        foods.push({
                            id: `f_${sx}_${sy}_${i}`,
                            x: sx * cellSize + rx,
                            y: sy * cellSize + ry,
                            radius: 12, 
                            hue: h
                        });
                        foodsCount++;
                    }
                }
            }); } catch(e) { console.warn('[Grid] forEach error:', e.message); }
            global.foods = foods;

            // AOI Debug: show how many food items & sectors we're receiving
            const debugEl = document.getElementById('debug-log');
            if (debugEl) {
                const sectorCount = gridMap.size || 0;
                const aoiLine = `[AOI] Food: ${foodsCount} | Sectors: ${sectorCount} | BW In: ${this.kbpsIn.toFixed(1)} KB/s`;
                const lines = debugEl.innerHTML.split('<br>');
                const aoiIdx = lines.findIndex(l => l.startsWith('[AOI]'));
                if (aoiIdx !== -1) lines[aoiIdx] = aoiLine;
                else lines.push(aoiLine);
                debugEl.innerHTML = lines.join('<br>');
            }
        } else if (state.foods) {
            // Legacy fallback
            const foods = [];
            state.foods.forEach(f => foods.push({ id: f.id, x: f.x, y: f.y, radius: f.radius, hue: f.hue }));
            global.foods = foods;
        }

        // ── 3. SNAPSHOT INTERPOLATION (Other Players, Viruses, MassFood) ──
        const INTERPOLATION_DELAY = 100; // ms
        const renderTime = Date.now() - INTERPOLATION_DELAY;

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
            // Fallback to latest if buffer is empty or lag spike
            prev = this.stateBuffer[this.stateBuffer.length - 1];
            next = prev;
        }

        if (!prev) return;

        const factor = (next.time === prev.time) ? 0 : (renderTime - prev.time) / (next.time - prev.time);
        const lerp = (start, end, t) => start + (end - start) * t;

        global.users = [];
        state.players.forEach((p, id) => {
            if (id === this.room.sessionId) return;
            
            const prevUser = prev.users[id];
            const nextUser = next.users[id];
            
            const cells = [];
            if (p.cells) {
                p.cells.forEach((targetCell, idx) => {
                    if (!targetCell) return;
                    let x = targetCell.x || 0;
                    let y = targetCell.y || 0;
                    let radius = targetCell.radius || 0;
                    
                    if (prevUser && nextUser && prevUser.cells && nextUser.cells && prevUser.cells[idx] && nextUser.cells[idx]) {
                        x = lerp(prevUser.cells[idx].x, nextUser.cells[idx].x, factor);
                        y = lerp(prevUser.cells[idx].y, nextUser.cells[idx].y, factor);
                        radius = lerp(prevUser.cells[idx].radius, nextUser.cells[idx].radius, factor);
                    }
                    cells.push({ x, y, mass: targetCell.mass || 0, radius });
                });
            }
            
            const pHue = p.hue || 0;
            global.users.push({
                id, name: p.name,
                bodyColor: p.customColor || `hsl(${pHue},100%,50%)`,
                shotColor: `hsl(${(pHue + 60) % 360},100%,50%)`,
                skinId:    p.skinId    || 'default',
                isAFK:     p.isAFK     || false,
                cells
            });
        });

        if (state.massFood) {
            const mf = [];
            state.massFood.forEach(m => {
                let x = m.x;
                let y = m.y;
                let radius = m.radius;
                
                const prevM = prev.massFood[m.id];
                const nextM = next.massFood[m.id];
                if (prevM && nextM) {
                    x = lerp(prevM.x, nextM.x, factor);
                    y = lerp(prevM.y, nextM.y, factor);
                    radius = lerp(prevM.radius, nextM.radius, factor);
                }
                mf.push({ id: m.id, x, y, radius, color: m.color });
            });
            global.fireFood = mf;
        }

        if (state.viruses) {
            const viruses = [];
            state.viruses.forEach(v => {
                let x = v.x;
                let y = v.y;
                let radius = v.radius;
                
                const prevV = prev.viruses[v.id];
                const nextV = next.viruses[v.id];
                if (prevV && nextV) {
                    x = lerp(prevV.x, nextV.x, factor);
                    y = lerp(prevV.y, nextV.y, factor);
                    radius = lerp(prevV.radius, nextV.radius, factor);
                }
                viruses.push({ id: v.id, x, y, radius, isMoving: v.isMoving });
            });
            global.viruses = viruses;
        }
    }

    close() { if (this.room) this.room.leave(); }
}

module.exports = ColyseusClient;
