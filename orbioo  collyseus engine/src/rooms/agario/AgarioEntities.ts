// AgarioEntities.ts – v6
// Bug fix: VIRUS DIRECTION WAS REVERSED
//
//   Previous code: angle = atan2(ball.y - virus.y, ball.x - virus.x)
//   This gives the angle FROM virus TO ball — i.e. pointing BACK toward
//   the player who shot. The virus was launching at the shooter.
//
//   Fix: virus moves in the OPPOSITE direction = angle + Math.PI
//   So if food came from below (player below, virus above), the virus
//   now flies UP (away from the player), not DOWN toward them.

import { v4 as uuidv4 } from 'uuid';
import { AgarioUtils } from "./AgarioUtils.js";
import { AgarioConfig } from "./AgarioConfig.js";

const EJECT_SPEED        = 50;
const EJECT_FRICTION     = 0.7225;
const EJECT_MIN_SPEED    = 1.0;
const EJECT_SPAWN_OFFSET = 1.2;

export class Food {
    id: string;
    x: number;
    y: number;
    radius: number;
    mass: number;
    hue: number;

    constructor(position: { x: number; y: number }, radius: number) {
        this.id     = uuidv4();
        this.x      = position.x;
        this.y      = position.y;
        this.radius = radius;
        this.mass   = AgarioConfig.foodMass;
        this.hue    = Math.round(Math.random() * 360);
    }
}

export class Virus {
    id: string;
    x: number;
    y: number;
    radius: number;
    mass: number;
    fill: string;
    stroke: string;
    strokeWidth: number;
    feedHits: number  = 0;
    speedX: number    = 0;
    speedY: number    = 0;
    isMoving: boolean = false;

    constructor(
        position: { x: number; y: number },
        radius: number,
        mass: number,
        config: any
    ) {
        this.id          = uuidv4();
        this.x           = position.x;
        this.y           = position.y;
        this.radius      = radius;
        this.mass        = mass;
        this.fill        = config.fill;
        this.stroke      = config.stroke;
        this.strokeWidth = config.strokeWidth;
    }

    // angle = direction FROM virus TO ball (i.e. the ball's incoming vector reversed)
    // We add Math.PI so the virus launches AWAY from where the food came from.
    feed(angleBallToVirus: number) {
        this.feedHits++;
        if (this.feedHits >= AgarioConfig.virus.feedHitsToMove) {
            this.feedHits = 0;
            this.isMoving = true;
            // FIX: push AWAY from the shooter by flipping the angle
            const pushAngle = angleBallToVirus + Math.PI;
            this.speedX = Math.cos(pushAngle) * AgarioConfig.virus.moveSpeed;
            this.speedY = Math.sin(pushAngle) * AgarioConfig.virus.moveSpeed;
        }
    }

    move(gameWidth: number, gameHeight: number) {
        if (!this.isMoving) return;
        const speed = Math.hypot(this.speedX, this.speedY);
        if (speed < AgarioConfig.virus.minMoveSpeed) {
            this.speedX   = 0;
            this.speedY   = 0;
            this.isMoving = false;
            return;
        }
        this.x      += this.speedX;
        this.y      += this.speedY;
        this.speedX *= AgarioConfig.virus.moveFriction;
        this.speedY *= AgarioConfig.virus.moveFriction;

        const r = this.radius;
        if (this.x < r)             { this.x = r;             this.speedX =  Math.abs(this.speedX); }
        if (this.x > gameWidth - r) { this.x = gameWidth - r; this.speedX = -Math.abs(this.speedX); }
        if (this.y < r)             { this.y = r;             this.speedY =  Math.abs(this.speedY); }
        if (this.y > gameHeight- r) { this.y = gameHeight-r;  this.speedY = -Math.abs(this.speedY); }
    }
}

export class EjectedMass {
    id: string;
    x: number;
    y: number;
    radius: number;
    mass: number;
    color: string;
    speed: number;
    direction: number;
    ownerId: string;
    createdAt: number;

    constructor(
        position: { x: number; y: number },
        mass: number,
        color: string,
        speed: number,
        direction: number,
        ownerId: string
    ) {
        this.id        = uuidv4();
        this.x         = position.x;
        this.y         = position.y;
        this.mass      = mass;
        this.radius    = AgarioUtils.massToRadius(mass);
        this.color     = color;
        this.speed     = speed;
        this.direction = direction;
        this.ownerId   = ownerId;
        this.createdAt = Date.now();
    }

    move(gameWidth: number, gameHeight: number) {
        if (this.speed < EJECT_MIN_SPEED) { this.speed = 0; return; }
        this.x    += Math.cos(this.direction) * this.speed;
        this.y    += Math.sin(this.direction) * this.speed;
        this.speed *= EJECT_FRICTION;

        const r = this.radius;
        if (this.x < r)              { this.x = r;              this.direction = Math.PI - this.direction; }
        if (this.x > gameWidth - r)  { this.x = gameWidth - r;  this.direction = Math.PI - this.direction; }
        if (this.y < r)              { this.y = r;              this.direction = -this.direction; }
        if (this.y > gameHeight - r) { this.y = gameHeight - r; this.direction = -this.direction; }
    }

    isStopped(): boolean { return this.speed < EJECT_MIN_SPEED; }
}

export class EntityManager {
    food: Food[]            = [];
    viruses: Virus[]        = [];
    massFood: EjectedMass[] = [];

    addEjectedMass(
        cellX: number, cellY: number, cellRadius: number,
        targetX: number, targetY: number,
        playerX: number, playerY: number,
        mass: number, color: string,
        ownerId: string,
        gameWidth: number, gameHeight: number
    ): number {
        const absTargetX = playerX + targetX;
        const absTargetY = playerY + targetY;
        const direction  = Math.atan2(absTargetY - cellY, absTargetX - cellX);

        const spawnX = cellX + Math.cos(direction) * cellRadius * EJECT_SPAWN_OFFSET;
        const spawnY = cellY + Math.sin(direction) * cellRadius * EJECT_SPAWN_OFFSET;

        const r     = AgarioUtils.massToRadius(mass);
        const safeX = Math.max(r, Math.min(gameWidth  - r, spawnX));
        const safeY = Math.max(r, Math.min(gameHeight - r, spawnY));

        this.massFood.push(new EjectedMass(
            { x: safeX, y: safeY }, mass, color, EJECT_SPEED, direction, ownerId
        ));

        return direction;
    }

    // FIX: angle computed as atan2(ball - virus) gives direction FROM virus TO ball.
    // We pass that angle into virus.feed() which now adds PI to reverse it.
    feedVirusIfHit(ball: EjectedMass): boolean {
        for (const virus of this.viruses) {
            const dx   = ball.x - virus.x;
            const dy   = ball.y - virus.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < virus.radius + ball.radius) {
                // angle FROM virus TO ball = direction the food came FROM the player's side
                const angleVirusToBall = Math.atan2(dy, dx);
                virus.feed(angleVirusToBall); // feed() adds PI internally → virus flies away
                return true;
            }
        }
        return false;
    }

    moveEjectedMass(gameWidth: number, gameHeight: number) {
        for (const ball of this.massFood) ball.move(gameWidth, gameHeight);
    }

    moveViruses(gameWidth: number, gameHeight: number) {
        for (const virus of this.viruses) virus.move(gameWidth, gameHeight);
    }

    balanceMass() {
        const virusesToAdd = AgarioConfig.maxVirus - this.viruses.length;
        if (virusesToAdd > 0) {
            for (let i = 0; i < virusesToAdd; i++) {
                const mass   = AgarioUtils.randomInRange(
                    AgarioConfig.virus.defaultMass.from,
                    AgarioConfig.virus.defaultMass.to
                );
                const radius = AgarioUtils.massToRadius(mass);
                this.viruses.push(new Virus(AgarioUtils.randomPosition(radius), radius, mass, AgarioConfig.virus));
            }
        }
    }
}
