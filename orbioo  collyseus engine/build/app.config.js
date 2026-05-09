/**
 * app.config.ts — Orbioo Engine V1.4.6
 *
 * Presence Strategy:
 * ─────────────────
 * When REDIS_URL is set (production / cluster mode), the server uses
 * RedisPresence + RedisDriver so all CPU workers share matchmaker state.
 *
 * When REDIS_URL is absent (local dev, single-process), it falls back
 * to LocalPresence — zero external dependencies required.
 *
 * To run in cluster mode locally:
 *   1. Start Redis:  docker run -p 6379:6379 redis
 *   2. Set env:      REDIS_URL=redis://localhost:6379
 *   3. Start PM2:    npm run build && pm2 start ecosystem.config.cjs
 */
import { defineServer, defineRoom, monitor, playground, createRouter, createEndpoint, } from "colyseus";
import cors from "cors";
let presence;
let driver;
const REDIS_URL = process.env.REDIS_URL; // e.g. "redis://localhost:6379"
if (REDIS_URL) {
    try {
        // Dynamic import keeps the fallback branch tree-shake friendly
        const { RedisPresence } = await import("@colyseus/redis-presence");
        const { RedisDriver } = await import("@colyseus/redis-driver");
        presence = new RedisPresence(REDIS_URL);
        driver = new RedisDriver(REDIS_URL);
        console.log(`[Orbioo] ✅  RedisPresence + RedisDriver connected → ${REDIS_URL}`);
        console.log("[Orbioo]     Multi-process cluster mode ACTIVE — all rooms share matchmaker.");
    }
    catch (err) {
        console.error("[Orbioo] ❌  Failed to initialise Redis presence:", err);
        console.error("[Orbioo]     Falling back to LocalPresence (single-process mode).");
        presence = undefined;
        driver = undefined;
    }
}
else {
    console.log("[Orbioo] ℹ️   REDIS_URL not set — using LocalPresence (single-process / dev mode).");
    console.log("[Orbioo]     To enable cluster scaling, set REDIS_URL=redis://localhost:6379");
}
// ─────────────────────────────────────────────────────────────────────────────
const IS_PRODUCTION = process.env.NODE_ENV === "production";
/**
 * Import your Room files
 * Add any new room handlers here — they all automatically use the
 * shared presence/driver configured above.
 */
import { AgarioSocketRoom } from "./rooms/AgarioSocketRoom.js";
const server = defineServer({
    /**
     * Shared Presence — enables cross-room, cross-process matchmaking.
     * Undefined = Colyseus defaults to LocalPresence automatically.
     */
    ...(presence && { presence }),
    ...(driver && { driver }),
    // V1.4.9.2: Dynamic scaling — ensured port is included in redirect URL
    publicAddress: `localhost:${process.env.PORT || 2567}`,
    /**
     * Room handlers — all rooms benefit from the shared presence above.
     * To add Chess or any future game: defineRoom(ChessRoom), etc.
     */
    rooms: {
        orbioo: defineRoom(AgarioSocketRoom),
        // chess:  defineRoom(ChessRoom),   ← uncomment when ready
    },
    routes: createRouter({
        api_hello: createEndpoint("/api/hello", { method: "GET" }, async () => {
            return { message: "Hello World" };
        }),
        api_status: createEndpoint("/api/status", { method: "GET" }, async () => {
            return {
                version: "V1.4.6",
                presence: REDIS_URL ? "redis" : "local",
                cluster: REDIS_URL ? true : false,
            };
        }),
    }),
    express: (app) => {
        const allowedOrigins = IS_PRODUCTION
            ? ["https://your-domain.com"]
            : true;
        app.use(cors({ origin: allowedOrigins, credentials: true }));
        app.get("/hi", (_req, res) => {
            res.send("It's time to kick ass and chew bubblegum!");
        });
        /**
         * @colyseus/monitor — protect with Basic Auth in production!
         * URL: http://localhost:2567/monitor
         */
        app.use("/monitor", monitor());
        /**
         * @colyseus/playground — enabled for local dev (works in prod cluster too)
         * URL: http://localhost:2567/
         */
        app.use("/", playground());
    },
});
export default server;
