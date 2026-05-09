import { Client } from "@colyseus/sdk";
import { cli } from "@colyseus/loadtest";
/**
 * Orbioo Loadtest Bot - V1.4.7
 * Optimized for 500+ bots stress-testing the Redis presence.
 */
export async function main(options) {
    const client = new Client(options.endpoint);
    let room;
    try {
        // V1.4.8: Join with a staggering name and handle as a 'Bot'
        room = await client.joinOrCreate(options.roomName, {
            name: `Bot_${options.clientId}`
        });
        // CRITICAL PERFORMANCE FIX: 
        // We tell the client to STOP listening to state changes.
        // This stops the 'refId not found' errors and drops CPU usage.
        // @ts-ignore
        room.serializer.decoder.decode = (bytes) => { };
    }
    catch (e) {
        // Retry logic for connection spikes
        console.error(`[LoadTest] Bot ${options.clientId} failed to join. Retrying in 2s...`);
        await new Promise(r => setTimeout(r, 2000));
        return main(options);
    }
    console.log(`[LoadTest] Bot ${options.clientId} connected to room: ${room.roomId}`);
    // Initial spawn with staggered delay to prevent server CPU spikes
    const spawn = () => {
        setTimeout(() => {
            if (room)
                room.send("respawn");
        }, 500 + Math.random() * 2000);
    };
    spawn();
    // PEACEFUL PATROL LOGIC (Avoids targeting other players)
    // We use a slow-changing angle to ensure bots wander and cover more map area
    let currentAngle = Math.random() * Math.PI * 2;
    let turnSpeed = (Math.random() - 0.5) * 0.1; // Randomly turn left or right
    const moveInterval = setInterval(() => {
        if (!room)
            return;
        currentAngle += turnSpeed;
        // Occasionally change turn direction
        if (Math.random() < 0.05)
            turnSpeed = (Math.random() - 0.5) * 0.1;
        room.send("0", {
            x: Math.cos(currentAngle) * 800,
            y: Math.sin(currentAngle) * 800
        });
    }, 500); // 2Hz updates are plenty for bots
    room.onMessage("leaderboard", () => { }); // Suppress log warnings
    room.onMessage("welcome", () => { }); // Suppress log warnings
    room.onMessage("playerDied", () => { }); // Suppress log warnings
    room.onMessage("death", () => {
        console.log(`[LoadTest] Bot ${options.clientId} died. Respawning...`);
        spawn();
    });
    // V1.5.0: Heartbeat pinger to keep bot sessions active
    const heartInterval = setInterval(() => {
        if (room)
            room.send("pingcheck");
    }, 5000);
    room.onLeave((code) => {
        clearInterval(moveInterval);
        clearInterval(heartInterval);
        console.log(`[LoadTest] Bot ${options.clientId} left (${code}).`);
    });
    room.onError((code, message) => {
        console.error(`[LoadTest] Bot ${options.clientId} Error: ${code} - ${message}`);
    });
}
cli(main);
