const os = require('os');

/**
 * Orbioo Engine — Multi-Port Cluster Configuration (V1.5.8)
 * 
 * Each worker gets its own port (2567-2570) to avoid Windows port conflicts.
 * Shared Redis brain ensures all players can see each other across ports.
 * 
 * windowsHide: true — hides each worker's CMD window.
 * out_file / error_file — redirects all logs to files (no visible CMD popup).
 * merge_logs: true — merges stdout + stderr into one log file per worker.
 */

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const INSTANCES = 4; // 4 workers is optimal for local stability
const LOG_DIR = `${os.homedir()}/.pm2/logs`;

module.exports = {
  apps: Array.from({ length: INSTANCES }).map((_, i) => ({
    name: `colyseus-worker-${i}`,
    script: 'build/index.js',
    time: true,
    watch: false,
    windowsHide: true,
    merge_logs: true,
    out_file: `${LOG_DIR}/colyseus-worker-${i}-out.log`,
    error_file: `${LOG_DIR}/colyseus-worker-${i}-error.log`,
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    env: {
      NODE_ENV: "production",
      REDIS_URL: REDIS_URL,
      PORT: 2567 + Number(i),
    },
  })),
};
