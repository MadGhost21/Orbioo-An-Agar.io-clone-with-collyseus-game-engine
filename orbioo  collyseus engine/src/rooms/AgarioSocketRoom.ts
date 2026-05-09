// AgarioSocketRoom.ts – V1.4.3
// New features:
//  1. SCORE ON LEADERBOARD: leaderboard entries now include score
//  2. SCORE ON PLAYER SCHEMA: score field already existed and is broadcast
//  3. VIRUS HIDE MECHANIC: small cells can overlap viruses safely
//  4. VIRUS PUSH MECHANIC: ejecting mass at a virus moves it after N hits
//  5. CRYPTO SKINS: Bitcoin, Ethereum, Pi Network supported via setSkin
//  6. EJECT AMOUNT –20%: fireFood is now 16 (set in AgarioConfig)
//  7. VirusSchema gains speedX/speedY/isMoving so clients can animate

import { Room, Client } from "colyseus";
import { Schema, type, MapSchema, ArraySchema, view, StateView } from "@colyseus/schema";
import { AgarioConfig, ALL_SKINS, getSkinById } from "./agario/AgarioConfig.js";
import { AgarioUtils } from "./agario/AgarioUtils.js";
import { PlayerLogic, Cell } from "./agario/AgarioPhysics.js";
import { EntityManager, Food, Virus, EjectedMass } from "./agario/AgarioEntities.js";
import { SpatialHash } from "./agario/SpatialHash.js";
import * as SATPrimitive from 'sat';
const SAT: any = (SATPrimitive as any).default || SATPrimitive;

const EJECT_OWNER_DELAY = 500;

// ── Schema Definitions ────────────────────────────────────

export class CellSchema extends Schema {
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") mass: number = 0;
    @type("number") radius: number = 0;
}

export class PlayerSchema extends Schema {
    @type("string") name: string      = "Unnamed";
    @type("number") score: number     = 0;           // mass-based score
    @type("number") hue: number       = 0;           // base hue if default skin
    @type("string") customColor: string = "";        // override rgb string if custom
    @type("string") skinId: string    = "default";
    @type("boolean") spawnShield: boolean = false;   // V1.4.2
    @type("number") x: number = 0;                    // V1.4.2.1 Anchor for AOI
    @type("number") y: number = 0;                    // V1.4.2.1 Anchor for AOI
    @type("boolean") isAFK: boolean = false;          // V1.4.8
    @type("number") afkTime: number = 0;              // V1.4.8
    @type([CellSchema]) cells = new ArraySchema<CellSchema>();
}

export class FoodSchema extends Schema {
    @type("string") id!: string;
    @type("number") x!: number;
    @type("number") y!: number;
    @type("number") radius!: number;
    @type("number") hue!: number;
}

export class MassFoodSchema extends Schema {
    @type("string") id!: string;
    @type("number") x!: number;
    @type("number") y!: number;
    @type("number") radius!: number;
    @type("string") color!: string;
}

export class VirusSchema extends Schema {
    @type("string") id!: string;
    @type("number") x!: number;
    @type("number") y!: number;
    @type("number") radius!: number;
    @type("boolean") isMoving: boolean = false;
}

export class GridSectorSchema extends Schema {
    @type("string") d: string = ""; // Base64-encoded binary mask: [x,y,h][x,y,h]... (V1.4.5)
}

// ── AOI helper: compute centroid of a player's cells ────────────────────────
function playerCentroid(player: PlayerSchema): { x: number; y: number } | null {
    if (!player) return null;
    if (!player.cells || player.cells.length === 0) {
        // Fallback to schema anchor for pre-spawn AOI (V1.4.2.1)
        return { x: player.x, y: player.y };
    }
    let px = 0, py = 0;
    player.cells.forEach(c => { px += c.x; py += c.y; });
    return { x: px / player.cells.length, y: py / player.cells.length };
}

export class AgarioState extends Schema {
    @type("number") gameWidth: number  = 10000;
    @type("number") gameHeight: number = 10000;
    @type("number") foodCount: number = 0;
    @type("number") virusCount: number = 0;
    @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
    @view() @type({ map: GridSectorSchema }) grid = new MapSchema<GridSectorSchema>();
    @view() @type({ map: MassFoodSchema }) massFood = new MapSchema<MassFoodSchema>();
    @view() @type({ map: VirusSchema })    viruses  = new MapSchema<VirusSchema>();
}

// ── Colour helpers ────────────────────────────────────────

function hslStr(h: number, s = 100, l = 50) { return `hsl(${h},${s}%,${l}%)`; }

// ── Room Implementation ───────────────────────────────────

export class AgarioSocketRoom extends Room<{ state: AgarioState }> {
    maxClients = 100;
    playerLogics: Map<string, PlayerLogic> = new Map();
    entities    = new EntityManager();
    initMassLog = AgarioUtils.mathLog(AgarioConfig.defaultPlayerMass, AgarioConfig.slowBase);
    private _leaderboardTick = 0;

    private _foodBySector = new Map<string, Set<Food>>();
    private _foodHash    = new SpatialHash<Food>(250);
    private _massHash    = new SpatialHash<EjectedMass>(250);
    private _virusHash   = new SpatialHash<Virus>(250);
    private _lastFoodCount  = -1;
    private _lastMassCount  = -1;
    private _lastVirusCount = -1;

    onCreate(options: any) {
        console.log(`[Worker ${process.env.PORT}] 🏠 Room created: ${this.roomId}`);
        
        /* V1.5.3: PM2 Dashboard Metrics Heartbeat (Disabled to stop Windows CMD flicker)
        this.clock.setInterval(() => {
            if (process.send) {
                process.send({
                    type: 'process:msg',
                    data: {
                        ccu: this.clients.length,
                        roomcount: 1
                    }
                });
            }
        }, 2000); */

        this.setState(new AgarioState());
        this.state.gameWidth  = AgarioConfig.gameWidth;
        this.state.gameHeight = AgarioConfig.gameHeight;

        this.entities.balanceMass();
        this._syncVirusesToState();

        this.setSimulationInterval((dt: number) => this.update(dt), 1000 / 30);

        // Throttled AOI Updates (200ms) - Drastically reduces CPU
        this.clock.setInterval(() => this._updateAOIViews(), 200);

        // ── Initial Food Population ──
        this._balanceFoodLocally(true);

        // ── Throttled Food Respawn ──
        // Check grid populations randomly every 5 to 10 seconds
        const scheduleFoodSpawn = () => {
            const delay = 5000 + Math.random() * 5000;
            this.clock.setTimeout(() => {
                this._balanceFoodLocally(false);
                scheduleFoodSpawn();
            }, delay);
        };
        scheduleFoodSpawn();

        // ── Respawn ──────────────────────────────────────
        this.onMessage("respawn", (client) => {
            const logic  = this.playerLogics.get(client.sessionId);
            const schema = this.state.players.get(client.sessionId);
            if (!schema || !logic) return;
            logic.init(
                AgarioUtils.randomPosition(AgarioUtils.massToRadius(AgarioConfig.defaultPlayerMass)),
                AgarioConfig.defaultPlayerMass
            );
            
            // Grant Spawn Shield (V1.4.2)
            logic.spawnShield = true;
            logic.shieldExpireTime = Date.now() + 3000;
            schema.spawnShield = true;

            this._syncLogicToSchema(logic, schema);
            client.send("welcome", {
                id: client.sessionId,
                x: logic.x,
                y: logic.y,
                massTotal: logic.massTotal,
                cells: logic.cells.map(c => ({ x: c.x, y: c.y, mass: c.mass, radius: c.radius }))
            });
        });

        // ── Mouse / heartbeat ────────────────────────────
        this.onMessage("0", (client, target) => {
            const logic = this.playerLogics.get(client.sessionId);
            const schema = this.state.players.get(client.sessionId);
            if (logic && target) { 
                // Drop shield if mouse moved significantly or after 1st message
                if (logic.spawnShield) {
                    const dx = target.x - logic.target.x;
                    const dy = target.y - logic.target.y;
                    if (Math.hypot(dx, dy) > 1) { // Any real movement drops shield
                        logic.spawnShield = false;
                    }
                }
                logic.target = target; 
                logic.lastHeartbeat = Date.now();
                
                // V1.5.7: Only update inactivity timer if they are NOT AFK.
                // This prevents background browser heartbeats from resetting the kick timer.
                if (!schema?.isAFK) {
                    logic.lastActionTime = Date.now();
                }
            }
        });

        // ── Eject mass (–20% amount, virus push) ─────────
        this.onMessage("1", (client) => {
            const logic  = this.playerLogics.get(client.sessionId);
            if (!logic) return;
            logic.lastActionTime = Date.now();
            logic.spawnShield = false; // Action drops shield
            const schema = this.state.players.get(client.sessionId);
            const minMass = AgarioConfig.fireFoodMinMass;

            for (let i = 0; i < logic.cells.length; i++) {
                const cell = logic.cells[i];
                if (cell.mass < minMass) continue;
                logic.changeCellMass(i, -AgarioConfig.fireFood);

                const shotColor = schema?.customColor || hslStr(logic.hue);
                const direction = this.entities.addEjectedMass(
                    cell.x, cell.y, cell.radius,
                    logic.target.x, logic.target.y,
                    logic.x, logic.y,
                    AgarioConfig.fireFood, shotColor,
                    client.sessionId,
                    AgarioConfig.gameWidth, AgarioConfig.gameHeight
                );

                // Check if this ball immediately hits a virus
                const justAdded = this.entities.massFood[this.entities.massFood.length - 1];
                if (justAdded) this.entities.feedVirusIfHit(justAdded);
            }
        });

        // ── Split ────────────────────────────────────────
        this.onMessage("2", (client) => {
            const logic = this.playerLogics.get(client.sessionId);
            if (logic) {
                logic.lastActionTime = Date.now();
                logic.spawnShield = false; // Action drops shield
                logic.userSplit(AgarioConfig.limitSplit, AgarioConfig.defaultPlayerMass);
            }
        });

        this.onMessage("playerFocusStatus", (client, message) => {
            const logic = this.playerLogics.get(client.sessionId);
            const schema = this.state.players.get(client.sessionId);
            if (!logic || !schema) return;

            if (message.isFocused === false) {
                schema.isAFK = true;
                // V1.5.8: No time penalty. The clock starts from 0 (or wherever they stopped moving).
                console.log(`[AFK] Player ${logic.name} (${client.sessionId}) lost focus. Clock is ticking...`);
            } else {
                // When focus returns, we reset the timer to give them control back.
                schema.isAFK = false;
                logic.lastActionTime = Date.now();
                console.log(`[AFK] Player ${logic.name} (${client.sessionId}) regained focus.`);
            }
        });

        // ── Chat ─────────────────────────────────────────
        const chatHandler = (client: Client, data: any) => {
            const logic   = this.playerLogics.get(client.sessionId);
            const sender  = logic?.name || "Guest";
            const message = String(typeof data === "string" ? data : (data?.message ?? "")).substring(0, 35);
            if (!message) return;
            this.broadcast("serverSendPlayerChat", { 
                sender, 
                message, 
                senderId: client.sessionId 
            });
        };
        this.onMessage("playerChat", chatHandler);
        this.onMessage("chat",       chatHandler);

        // ── Skin / color ──────────────────────────────────
        this.onMessage("setSkin", (client, payload: any) => {
            const logic  = this.playerLogics.get(client.sessionId);
            const schema = this.state.players.get(client.sessionId);
            if (!logic || !schema) return;

            if (typeof payload === "string") {
                if (ALL_SKINS.includes(payload as any)) {
                    logic.skinId          = payload;
                    logic.customBodyColor = null;
                    logic.customShotColor = null;
                    schema.skinId         = payload;
                    schema.customColor    = "";
                }
            } else if (payload?.body) {
                logic.customBodyColor = payload.body;
                logic.customShotColor = payload.shot || payload.body;
                logic.skinId          = "custom";
                schema.skinId         = "custom";
                schema.customColor    = payload.body;
            }
        });

        this.onMessage("windowResized", () => {});
        this.onMessage("gotit",         () => {});
        this.onMessage("pingcheck", (client) => { client.send("pongcheck", {}); });
        this.onMessage("pass", () => {});
        this.onMessage("kick", () => {});
    }

    onJoin(client: Client, options: any) {
        let name = (options?.name || "").toString().trim().substring(0, 25);
        if (!name || name.toLowerCase() === "unnamed" || name.toLowerCase() === "guest") {
            name = `cell_${Math.floor(Math.random() * 999)}`;
        }
        console.log(`[Worker ${process.env.PORT}] 🟢 Player Joined: ${name} (${client.sessionId})`);
        
        const logic  = new PlayerLogic(client.sessionId);
        logic.name   = name;
        // ... (existing logic continues)

        const skinIdFromOptions = (options?.skinId as string) ?? "default";
        logic.skinId = ALL_SKINS.includes(skinIdFromOptions as any) ? skinIdFromOptions : "default";

        if (options?.bodyColor) {
            logic.customBodyColor = options.bodyColor;
            logic.customShotColor = options.shotColor || options.bodyColor;
            if (logic.skinId === "default") {
                logic.skinId = "custom";
            }
        }

        /* logic.init(
            AgarioUtils.randomPosition(AgarioUtils.massToRadius(AgarioConfig.defaultPlayerMass)),
            AgarioConfig.defaultPlayerMass
        ); */
        this.playerLogics.set(client.sessionId, logic);

        const schema     = new PlayerSchema();
        schema.name      = logic.name;
        schema.skinId    = logic.skinId;
        schema.hue       = logic.hue;
        schema.customColor = logic.customBodyColor || "";
        
        // Set initial pre-spawn anchor (V1.4.2.1)
        const startPos = AgarioUtils.randomPosition(AgarioUtils.massToRadius(AgarioConfig.defaultPlayerMass));
        logic.x = startPos.x;
        logic.y = startPos.y;
        schema.x = startPos.x;
        schema.y = startPos.y;
        
        this.state.players.set(client.sessionId, schema);

        // Pre-bake sectors around join position to prevent '0 food' lag (V1.4.3)
        const radius = AgarioConfig.MAX_AOI_RADIUS;
        const cellSize = AgarioConfig.foodCellSize;
        for (let x = Math.floor((logic.x - radius) / cellSize); x <= Math.floor((logic.x + radius) / cellSize); x++) {
            for (let y = Math.floor((logic.y - radius) / cellSize); y <= Math.floor((logic.y + radius) / cellSize); y++) {
                this._refreshSector(`${x},${y}`);
            }
        }

        // ── AOI: Create a StateView for this client ──
        client.view = new StateView();

        client.send("welcome", {
            id: client.sessionId,
            x: logic.x,
            y: logic.y,
            massTotal: logic.massTotal,
            cells: logic.cells.map(c => ({ x: c.x, y: c.y, mass: c.mass, radius: c.radius }))
        });

        this.broadcast("playerJoin", { name });
    }

    onLeave(client: Client, _code: number) {
        const logic = this.playerLogics.get(client.sessionId);
        console.log(`[Worker ${process.env.PORT}] 🔴 Player Left: ${logic?.name || "Unknown"} (${client.sessionId})`);
        
        this.state.players.delete(client.sessionId);
        this.playerLogics.delete(client.sessionId);
        if (logic) this.broadcast("playerDisconnect", { name: logic.name ?? "" });
    }

    // ── Update tick ───────────────────────────────────────
    update(dt: number) {
        // V1.4.9.7: Skip heavy logic if room is empty to save CPU
        if (this.clients.length === 0 && this.playerLogics.size === 0) return;

        try {
            this._updateCore(dt);
        } catch (e) {
            console.error("[AgarioRoom] Update Crash:", e);
        }
    }

    private _updateCore(_dt: number) {
        this.entities.balanceMass(); // Balances viruses only now

        this.entities.moveEjectedMass(AgarioConfig.gameWidth, AgarioConfig.gameHeight);
        this.entities.moveViruses(AgarioConfig.gameWidth, AgarioConfig.gameHeight);

        this.playerLogics.forEach((logic, sessionId) => {
            const schema = this.state.players.get(sessionId);
            if (!schema) return;
            
            // AFK Management System
            const inactiveTime = Date.now() - logic.lastActionTime;
            
            // Phase 3: Auto-Kick (120s / 2 Minutes)
            if (inactiveTime > 120000) {
                const client = this.clients.find(c => c.sessionId === sessionId);
                if (client) {
                    console.log(`[KICK] Player ${logic.name} (${sessionId}) kicked for inactivity.`);
                    client.send("kick", "You were kicked for being AFK");
                    
                    // Delay leave slightly to ensure 'kick' message arrives
                    this.clock.setTimeout(() => {
                        client.leave();
                    }, 100);
                }
                return; // Skip rest of update
            }
            
            // Phase 1: Visual AFK (0s - 120s)
            // schema.isAFK is controlled by the Focus message mostly, 
            // but we ensure it matches the timer here.
            schema.afkTime = Math.floor(inactiveTime / 1000);
            
            // Phase 2: Mass Decay (60s+) - 5x rate
            const massDecayRate = (inactiveTime > 60000) ? AgarioConfig.massLossRate * 5 : AgarioConfig.massLossRate;

            // Spawn Protection Timeout (V1.4.2)
            if (logic.spawnShield && Date.now() > logic.shieldExpireTime) {
                logic.spawnShield = false;
            }

            logic.move(AgarioConfig.slowBase, AgarioConfig.gameWidth, AgarioConfig.gameHeight, this.initMassLog);
            logic.loseMassIfNeeded(massDecayRate, AgarioConfig.defaultPlayerMass, AgarioConfig.minMassLoss);
            schema.score = Math.round(logic.massTotal);
            this._syncLogicToSchema(logic, schema);
        });

        this._syncMassFoodToState();
        this._syncVirusesToState();
        
        this.handleCollisions();

        this._leaderboardTick++;
        if (this._leaderboardTick >= 120) {
            this._leaderboardTick = 0;
            this._broadcastLeaderboard();
        }
    }

    // ── Collision detection ───────────────────────────────
    handleCollisions() {
        const now = Date.now();
        const foodHash  = this._foodHash;
        const massHash  = this._massHash;
        const virusHash = this._virusHash;

        const playerCellHash = new SpatialHash<{cell: Cell, playerId: string, x: number, y: number, radius: number}>(250);
        this.playerLogics.forEach((p, id) => {
            p.cells.forEach(c => playerCellHash.insert({cell: c, playerId: id, x: c.x, y: c.y, radius: c.radius}));
        });

        // ── 2. Check collisions using Hashes ──
        this.playerLogics.forEach((playerA, idA) => {
            for (let indexA = playerA.cells.length - 1; indexA >= 0; indexA--) {
                const cellA = playerA.cells[indexA];
                if (!cellA) continue;
                const circleA = cellA.toCircle();

                // Eat regular food (Optimized Query)
                const nearbyFood = foodHash.query(cellA.x, cellA.y, cellA.radius);
                for (const food of nearbyFood) {
                    if (SAT.pointInCircle(new SAT.Vector(food.x, food.y), circleA)) {
                        const fIdx = this.entities.food.indexOf(food);
                        if (fIdx !== -1) {
                            this.entities.food.splice(fIdx, 1);
                            this._foodHash.remove(food); // Incremental update
                            
                             // Remove from Grid Schema (Binary Mask Update)
                             const cx = Math.floor(food.x / AgarioConfig.foodCellSize);
                             const cy = Math.floor(food.y / AgarioConfig.foodCellSize);
                             const sectorKey = `${cx},${cy}`;
                             const sectorSet = this._foodBySector.get(sectorKey);
                             if (sectorSet) {
                                 sectorSet.delete(food);
                                 this._refreshSector(sectorKey);
                             }
                             
                             playerA.changeCellMass(indexA, AgarioConfig.foodMass);
                        }
                    }
                }

                // Eat ejected mass (Optimized Query)
                const nearbyMass = massHash.query(cellA.x, cellA.y, cellA.radius);
                for (const ball of nearbyMass) {
                    if (ball.ownerId === idA && (now - ball.createdAt) < EJECT_OWNER_DELAY) continue;
                    if (SAT.pointInCircle(new SAT.Vector(ball.x, ball.y), circleA)) {
                        const mIdx = this.entities.massFood.indexOf(ball);
                        if (mIdx !== -1) {
                            this.entities.massFood.splice(mIdx, 1);
                            this._massHash.remove(ball); // Incremental update
                            playerA.changeCellMass(indexA, ball.mass);
                        }
                    }
                }

                // Virus Collision (Optimized Query)
                const nearbyViruses = virusHash.query(cellA.x, cellA.y, cellA.radius);
                for (const virus of nearbyViruses) {
                    const vc = new SAT.Circle(new SAT.Vector(virus.x, virus.y), virus.radius);
                    const resp = new SAT.Response();

                    if (!SAT.testCircleCircle(circleA, vc, resp)) continue;

                    const hiding = cellA.radius <= virus.radius * AgarioConfig.virus.hideRadiusFraction;
                    if (hiding) continue;
                    if (cellA.mass > AgarioConfig.virus.splitMass) {
                        const vIdx = this.entities.viruses.indexOf(virus);
                        if (vIdx !== -1) {
                            this.entities.viruses.splice(vIdx, 1);
                            this._virusHash.remove(virus);
                            playerA.virusSplit(indexA, AgarioConfig.limitSplit, AgarioConfig.defaultPlayerMass);
                        }
                    }
                }

                // Eat other players (Optimized Query)
                const nearbyOtherCells = playerCellHash.query(cellA.x, cellA.y, cellA.radius);
                for (const entry of nearbyOtherCells) {
                    const { cell: cellB, playerId: idB } = entry;
                    if (idA === idB) continue;

                    // Spawn Protection Guard (V1.4.2)
                    const playerB = this.playerLogics.get(idB);
                    if (playerA.spawnShield || (playerB && playerB.spawnShield)) continue;

                    if (cellA.mass < cellB.mass * 1.1) continue;

                    let whoAteWho = Cell.checkWhoAteWho(cellA, cellB);
                    
                    // V1.4.8: BOTS DO NOT DIE (Stress-test mode)
                    // If the victim would be a bot, cancel the eating event
                    if (whoAteWho === 1 && this.playerLogics.get(idB)?.name?.startsWith("Bot_")) whoAteWho = 0;
                    if (whoAteWho === -1 && playerA.name?.startsWith("Bot_")) whoAteWho = 0;

                    if (whoAteWho === 1) {
                        const playerB = this.playerLogics.get(idB);
                        if (playerB) {
                            const bIdx = playerB.cells.indexOf(cellB);
                            if (bIdx !== -1) {
                                // Cell actually removed, grant mass
                                playerA.changeCellMass(indexA, cellB.mass);
                                const died = playerB.removeCell(bIdx);
                                if (died) {
                                    const victim = this.clients.find(c => c.sessionId === idB);
                                    if (victim) {
                                         victim.send("death", { reason: "eaten", killer: playerA.name });
                                         victim.send("RIP", {});
                                         // Force disconnect to save server resources
                                         victim.leave();
                                     }
                                    this.broadcast("playerDied", { playerEatenName: playerB.name ?? "" });
                                    this.state.players.delete(idB);
                                    this.playerLogics.delete(idB);
                                }
                            }
                        }
                    }
                }
            }
        });

        // ── Ejected mass hitting viruses (push mechanic) ──
        for (let i = this.entities.massFood.length - 1; i >= 0; i--) {
            const ball = this.entities.massFood[i];
            if (this.entities.feedVirusIfHit(ball)) {
                // Ball is consumed by the virus hit
                this.entities.massFood.splice(i, 1);
            }
        }
    }

    // ── AOI View Manager ─────────────────────────────────────────────────────
    private _updateAOIViews() {
        this.clients.forEach(client => {
            const playerSchema = this.state.players.get(client.sessionId);
            if (!playerSchema) return;
            const centroid = playerCentroid(playerSchema);
            if (!centroid) return;

            // 1. Dynamic Radius based on mass (V1.4.5.1 logic)
            // Bigger players see further, but never beyond the MAX_AOI_RADIUS
            const totalMass = playerSchema.cells.reduce((sum, c) => sum + c.mass, 0);
            let radius = Math.min(AgarioConfig.MAX_AOI_RADIUS, 800 + Math.sqrt(totalMass) * 40);
            
            const view = (client as any).view as StateView;
            if (!view) return;

            const cellSize = AgarioConfig.foodCellSize;
            const cols = Math.floor(AgarioConfig.gameWidth / cellSize);
            const rows = Math.floor(AgarioConfig.gameHeight / cellSize);

            // 2. Calculate the bounding box of visible sectors
            const startX = Math.max(0, Math.floor((centroid.x - radius) / cellSize));
            const endX   = Math.min(cols - 1, Math.floor((centroid.x + radius) / cellSize));
            const startY = Math.max(0, Math.floor((centroid.y - radius) / cellSize));
            const endY   = Math.min(rows - 1, Math.floor((centroid.y + radius) / cellSize));

            const currentVisibleKeys = new Set<string>();
            const prevVisibleKeys = (client as any).viewedSectors || new Set<string>();

            // V1.5.1: Manage Sector Visibility
            for (let x = startX; x <= endX; x++) {
                for (let y = startY; y <= endY; y++) {
                    const key = `${x},${y}`;
                    currentVisibleKeys.add(key);
                    const sector = this.state.grid.get(key);
                    if (sector) view.add(sector);
                }
            }
            // Remove old sectors
            prevVisibleKeys.forEach((key: string) => {
                if (!currentVisibleKeys.has(key)) {
                    const sector = this.state.grid.get(key);
                    if (sector) view.remove(sector);
                }
            });
            (client as any).viewedSectors = currentVisibleKeys;

            // 3. Optimized Entity Visibility (Using SpatialHash instead of full Map scan)
            
            // MassFood AOI
            const visibleMass = this._massHash.query(centroid.x, centroid.y, radius);
            const currentMassIds = new Set(visibleMass.map(m => m.id));
            const prevMassIds = (client as any).viewedMass || new Set<string>();

            visibleMass.forEach(m => {
                const schema = this.state.massFood.get(m.id);
                if (schema) view.add(schema);
            });
            prevMassIds.forEach((id: string) => {
                if (!currentMassIds.has(id)) {
                    const schema = this.state.massFood.get(id);
                    if (schema) view.remove(schema);
                }
            });
            (client as any).viewedMass = currentMassIds;

            // Virus AOI
            const visibleViruses = this._virusHash.query(centroid.x, centroid.y, radius);
            const currentVirusIds = new Set(visibleViruses.map(v => v.id));
            const prevVirusIds = (client as any).viewedViruses || new Set<string>();

            visibleViruses.forEach(v => {
                const schema = this.state.viruses.get(v.id);
                if (schema) view.add(schema);
            });
            prevVirusIds.forEach((id: string) => {
                if (!currentVirusIds.has(id)) {
                    const schema = this.state.viruses.get(id);
                    if (schema) view.remove(schema);
                }
            });
            (client as any).viewedViruses = currentVirusIds;
        });
    }

    // ── Sync helpers ──────────────────────────────────────

    private _refreshSector(key: string) {
        const sector = this.state.grid.get(key);
        if (!sector) return;
        const foods = this._foodBySector.get(key);
        if (!foods || foods.size === 0) {
            sector.d = "";
            return;
        }
        // Encode each food as 3 bytes in a buffer, then to Base64 for safe transport
        const bytes = new Uint8Array(foods.size * 3);
        let i = 0;
        foods.forEach(f => {
            bytes[i++] = Math.floor(f.x % AgarioConfig.foodCellSize);
            bytes[i++] = Math.floor(f.y % AgarioConfig.foodCellSize);
            bytes[i++] = Math.floor(f.hue / 2);
        });
        sector.d = Buffer.from(bytes).toString('base64');
    }


    private _balanceFoodLocally(initialFill: boolean = false) {
        const cellSize = AgarioConfig.foodCellSize;
        const localMax = AgarioConfig.localMaxFood;
        const radius   = AgarioUtils.massToRadius(AgarioConfig.foodMass);
        
        const cols = Math.floor(AgarioConfig.gameWidth / cellSize);
        const rows = Math.floor(AgarioConfig.gameHeight / cellSize);
        const dirtySectors = new Set<string>();

        for (let cx = 0; cx < cols; cx++) {
            for (let cy = 0; cy < rows; cy++) {
                const key = `${cx},${cy}`;
                let sector = this.state.grid.get(key);
                if (!sector) {
                    sector = new GridSectorSchema();
                    this.state.grid.set(key, sector);
                }

                const currentCount = this._foodHash.getCellCount(cx, cy);
                if (currentCount < localMax) {
                    const toAdd = initialFill ? (localMax - currentCount) : Math.min(2, localMax - currentCount);
                    if (toAdd > 0) {
                        for (let i = 0; i < toAdd; i++) {
                            const x = (cx * cellSize) + Math.random() * cellSize;
                            const y = (cy * cellSize) + Math.random() * cellSize;
                            const safeX = Math.max(radius, Math.min(AgarioConfig.gameWidth - radius, x));
                            const safeY = Math.max(radius, Math.min(AgarioConfig.gameHeight - radius, y));

                            const newFood = new Food({ x: safeX, y: safeY }, radius);
                            this.entities.food.push(newFood);
                            this._foodHash.insert(newFood);

                            // Track in raw Set for buffer rebuild
                            if (!this._foodBySector.has(key)) this._foodBySector.set(key, new Set());
                            this._foodBySector.get(key)!.add(newFood);
                        }
                        dirtySectors.add(key);
                    }
                }
            }
        }
        // Rebuild binary strings for changed sectors
        dirtySectors.forEach(k => this._refreshSector(k));
    }

    private _syncLogicToSchema(logic: PlayerLogic, schema: PlayerSchema) {
        schema.spawnShield = logic.spawnShield; // V1.4.2
        schema.x = logic.x; // Sync anchor
        schema.y = logic.y; // Sync anchor
        logic.cells.forEach((c, i) => {
            let sc = schema.cells[i];
            if (!sc) { sc = new CellSchema(); schema.cells.push(sc); }
            sc.x = c.x; sc.y = c.y; sc.mass = c.mass; sc.radius = c.radius;
        });
        while (schema.cells.length > logic.cells.length) schema.cells.pop();
    }
    private _syncMassFoodToState() {
        const entityIds = new Set(this.entities.massFood.map(m => m.id));
        this.state.massFood.forEach((m: any, id: string) => { if (!entityIds.has(id)) this.state.massFood.delete(id); });
        this.entities.massFood.forEach((m: any) => {
            if (!this.state.massFood.has(m.id)) {
                const ms = new MassFoodSchema();
                ms.id = m.id; ms.x = m.x; ms.y = m.y; ms.radius = m.radius; ms.color = m.color;
                this.state.massFood.set(m.id, ms);
                this._massHash.insert(m);
            } else {
                const ms = this.state.massFood.get(m.id)!;
                ms.x = m.x; ms.y = m.y;
            }
        });
    }

    private _syncVirusesToState() {
        const entityIds = new Set(this.entities.viruses.map(v => v.id));
        this.state.viruses.forEach((v: any, id: string) => { if (!entityIds.has(id)) this.state.viruses.delete(id); });
        this.entities.viruses.forEach((v: any) => {
            if (!this.state.viruses.has(v.id)) {
                const vs = new VirusSchema();
                vs.id = v.id; vs.x = v.x; vs.y = v.y; vs.radius = v.radius; vs.isMoving = v.isMoving;
                this.state.viruses.set(v.id, vs);
                this._virusHash.insert(v);
            } else {
                const vs = this.state.viruses.get(v.id)!;
                vs.x = v.x; vs.y = v.y; vs.isMoving = v.isMoving;
            }
        });
    }

    private _broadcastLeaderboard() {
        const entries: { id: string; name: string; score: number }[] = [];
        this.playerLogics.forEach((logic, id) => {
            entries.push({ id, name: logic.name ?? "", score: Math.round(logic.massTotal) });
        });
        entries.sort((a, b) => b.score - a.score);
        
        const top10 = entries.slice(0, 10);

        this.clients.forEach(client => {
            const myIdx = entries.findIndex(e => e.id === client.sessionId);
            if (myIdx === -1) return;

            const payload: any = { leaderboard: top10 };
            
            // If the player is NOT in the Top 10, include their specific rank info
            if (myIdx >= 10) {
                const myEntry = entries[myIdx];
                payload.me = {
                    rank: myIdx + 1,
                    name: myEntry.name,
                    score: myEntry.score
                };
            }

            client.send("leaderboard", payload);
        });
    }
}
