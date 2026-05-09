/**
 * IMPORTANT:
 * ---------
 * Do not manually edit this file if you'd like to host your server on Colyseus Cloud
 *
 * If you're self-hosting, you can see "Raw usage" from the documentation.
 *
 * See: https://docs.colyseus.io/server
 */
import { listen } from "@colyseus/tools";
// Import Colyseus config
import app from "./app.config.js";
import { Encoder } from "@colyseus/schema";
Encoder.BUFFER_SIZE = 4096 * 1024; // 4096 KB
const port = Number(process.env.PORT) || 2567;
// Create and listen on 2567 (or PORT environment variable.)
listen(app, port).then(() => {
    if (process.send) {
        process.send('ready');
    }
});
