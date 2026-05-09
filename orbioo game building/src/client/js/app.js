// app.js – V1.5.9 (FOV Normalization)
const ColyseusClient = require('./colyseus-client');
var render    = require('./render');
var ChatClient = require('./chat-client');
var Canvas    = require('./canvas');
var global    = require('./global');
window.global = global; // Expose to index.html logic
const skinsData = require('./skinsData');

// ── Disable Browser Zooming ────────────────────────────────
window.addEventListener('wheel', function(e) {
    if (e.ctrlKey) e.preventDefault();
}, { passive: false });

window.addEventListener('keydown', function(e) {
    if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '_')) {
        e.preventDefault();
    }
});

var playerNameInput = document.getElementById('playerNameInput');
var socket;

function addDebugLine(line) {
    const log = document.getElementById('debug-log');
    if (log) {
        const time = new Date().toLocaleTimeString();
        log.innerHTML += `<br>[${time}] ${line}`;
        console.log(`[DEBUG] ${line}`);
        const lines = log.innerHTML.split('<br>');
        if (lines.length > 8) log.innerHTML = lines.slice(lines.length - 8).join('<br>');
    }
}
window.addDebugLine = addDebugLine;

const isTouch = ('ontouchstart' in window || 
                 navigator.maxTouchPoints > 0 || 
                 window.matchMedia("(pointer: coarse)").matches ||
                 /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent) ||
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)); 

global.mobile = isTouch;

if (!isTouch) {
    document.body.classList.add('is-pc');
} else {
    document.body.classList.remove('is-pc');
    document.body.classList.add('is-mobile');
}

if (global.mobile) {
    global.zoom = 0.60; 
} else {
    global.zoom = 1.0;  
}

function loadSavedSkin() {
    try {
        const saved = JSON.parse(localStorage.getItem('agarSkin') || 'null');
        if (saved && saved.body) return { body: saved.body, shot: saved.shot || saved.body, id: saved.id || null, mode: saved.mode || "preset" };
    } catch (_) {}
    return { body: 'hsl(200,100%,50%)', shot: 'hsl(60,100%,50%)', id: 'default' };
}

function hexToHue(hex) {
    if (hex.startsWith('hsl(')) {
        const m = hex.match(/hsl\((\d+)/);
        return m ? parseInt(m[1]) : 200;
    }
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h;
    if (max === min) h = 0;
    else if (max === r) h = (60 * (g - b) / (max - min) + 360) % 360;
    else if (max === g) h = (60 * (b - r) / (max - min) + 120) % 360;
    else h = (60 * (r - g) / (max - min) + 240) % 360;
    return Math.round(h);
}

function startGame(type) {
    global.playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '').substring(0, 25);
    global.playerType = type;
    global.screen.width  = window.innerWidth;
    global.screen.height = window.innerHeight;

    document.getElementById('startMenuWrapper').style.maxHeight = '0px';
    document.getElementById('gameAreaWrapper').style.opacity    = 1;
    document.body.classList.add('game-active');
    
    if (socket) return;

    const skin = loadSavedSkin();
    const hue = hexToHue(skin.body);
    addDebugLine(`Connecting to Colyseus Server…`);
    socket = new ColyseusClient('ws://localhost:2567');
    setupColyseusCallbacks(socket);

    document.getElementById('loadingOverlay').style.display = 'flex';
    global.waitingForWarmup = true;
    global.warmupStartTime = Date.now();

    socket.join('orbioo', {
        name:      global.playerName,
        type:      type,
        skinId:    skin.id || 'default',
        hue:       hue,
        bodyColor: skin.body,
        shotColor: skin.shot
    })
    .then(() => { 
        addDebugLine('Room joined… Warming up grid…'); 
    })
    .catch(err => { 
        addDebugLine(`Error: ${err.message}`); 
        handleDisconnect(); 
        document.getElementById('loadingOverlay').style.display = 'none';
    });

    if (!global.animLoopHandle) animloop();
    window.chat.socket   = socket;
    window.chat.registerFunctions();
    window.canvas.socket = socket;
    global.socket = socket;
    window._mobileSocket = socket;
    window._globalRef    = global;
}

function setupColyseusCallbacks(sc) {
    sc.on('welcome', function (playerSettings, gameSizes) {
        global.player = Object.assign(global.player, playerSettings);
        global.player.name      = global.playerName;
        global.player.target    = window.canvas.target;
        global.player.massTotal = playerSettings.massTotal || 10;
        global.player.cells     = playerSettings.cells     || [];
        global.game.width       = gameSizes.width  || 5000;
        global.game.height      = gameSizes.height || 5000;
        global.gameStart        = true;
        resize();
        addDebugLine('Game starting…');
        window.chat.addSystemLine('Connected!');
        c.focus();
    });

    sc.on('disconnect', handleDisconnect);

    sc.on('kick', function (reason) {
        global.gameStart = false; global.kicked = true;
        render.drawErrorMessage('Kicked!' + (reason ? ': ' + reason : ''), graph, global.screen);
        socket.close();
    });

    sc.on('RIP', function () {
        global.gameStart = false;
        render.drawErrorMessage('You died!', graph, global.screen);
        setTimeout(() => {
            document.getElementById('gameAreaWrapper').style.opacity    = 0;
            document.getElementById('startMenuWrapper').style.maxHeight = '1000px';
            document.body.classList.remove('game-active');
            if (global.animLoopHandle) {
                window.cancelAnimationFrame(global.animLoopHandle);
                global.animLoopHandle = undefined;
                socket = undefined;
            }
        }, 2500);
    });

    sc.on('pongcheck', () => window.chat.addSystemLine('Ping: ' + (Date.now() - global.startPingTime) + 'ms'));
    sc.on('playerJoin',       (d) => window.chat.addSystemLine('{GAME} – <b>' + (d.name || 'unnamed') + '</b> joined.'));
    sc.on('playerDisconnect', (d) => window.chat.addSystemLine('{GAME} – <b>' + (d.name || 'unnamed') + '</b> left.'));
    sc.on('playerDied',       (d) => window.chat.addSystemLine('{GAME} – <b>' + (d.playerEatenName || 'unnamed') + '</b> was eaten.'));

    sc.on('leaderboard', function (data) {
        if (!data?.leaderboard) return;
        let status = '<span class="title">Leaderboard</span>';
        data.leaderboard.forEach((entry, i) => {
            const score = entry.score ? ' <span style="color:#f1c40f;font-size:11px">(' + entry.score + ')</span>' : '';
            status += '<br />';
            status += entry.id === global.player.id
                ? '<span class="me">' + (i+1) + '. ' + (entry.name || 'unnamed') + score + '</span>'
                : (i+1) + '. ' + (entry.name || 'unnamed') + score;
        });

        if (data.me) {
            const score = data.me.score ? ' <span style="color:#f1c40f;font-size:11px">(' + data.me.score + ')</span>' : '';
            status += '<br /><span class="me" style="border-top:1px solid #555; display:block; margin-top:5px; padding-top:2px;">' + data.me.rank + '. ' + (data.me.name || 'unnamed') + score + '</span>';
        }
        document.getElementById('status').innerHTML = status;
    });
}

function handleDisconnect() {
    if (socket?.close) socket.close();
    addDebugLine('Disconnected.');
    global.gameStart = false;
    const deathOverlay = document.getElementById('deathOverlay');
    if (deathOverlay && deathOverlay.style.display !== 'flex') {
        document.getElementById('disconnectOverlay').style.display = 'flex';
    }
}

window.onPlayerDeath = function (data) {
    global.gameStart = false;
    document.getElementById('deathOverlay').style.display   = 'flex';
    document.getElementById('deathType').innerText          = 'YOU WERE EATEN!';
    document.getElementById('deathReason').innerText        = 'Consumed by ' + (data.killer || 'an unknown cellular force');
};

function validNick() { return /^\w*$/.exec(playerNameInput.value) !== null; }

var playerConfig = { border: 6, textColor: '#FFFFFF', textBorder: '#000000', textBorderSize: 3, defaultSize: 30 };

function gameLoop() {
    // ── V1.5.9: Camera Normalization ──
    // We calculate the scale, but enforce a hard MINIMUM of 0.60x 
    // to ensure cells are never too small on mobile/small screens.
    let fZoom = global.baseScale * global.zoom;
    global.finalZoom = Math.max(0.60, fZoom);

    const isWarm = (global.foods || []).length >= 50;
    const isTimedOut = (Date.now() - (global.warmupStartTime || 0)) > 2000;
    
    if (global.waitingForWarmup && (isWarm || isTimedOut)) {
        global.waitingForWarmup = false;
        const loader = document.getElementById('loadingOverlay');
        if (loader) loader.style.display = 'none';
        if (socket) socket.emit('respawn');
    }

    if (socket && typeof socket.syncState === 'function') {
        socket.syncState(global);
        
        const stats = document.getElementById('stats-log');
        if (stats && socket.kbpsIn !== undefined) {
            let camInfo = ` | ZOOM: ${global.finalZoom.toFixed(2)}x`;
            let afkInfo = "";
            if (global.player && typeof global.player.afkTime !== 'undefined') {
                const time = global.player.afkTime;
                let status = "";
                if (global.player.isAFK) {
                    status = (time >= 170) ? " [KICK!]" : (time >= 120 ? " [DECAY]" : " [AFK]");
                }
                afkInfo = ` | AFK: ${time}s${status}`;
            }
            stats.innerText = `IN: ${socket.kbpsIn.toFixed(1)} KB/s | OUT: ${socket.kbpsOut.toFixed(1)} KB/s${camInfo}${afkInfo}`;
            if (global.player && global.player.isAFK) stats.style.color = "#ff4757";
            else stats.style.color = "#2ecc71";
        }
    }

    if (global.gameStart && global.player && typeof global.player.x !== 'undefined') {
        graph.fillStyle = global.backgroundColor;
        graph.fillRect(0, 0, global.screen.width, global.screen.height);
        
        graph.save();
        graph.translate(global.screen.width / 2, global.screen.height / 2);
        graph.scale(global.finalZoom, global.finalZoom);
        graph.translate(-global.screen.width / 2, -global.screen.height / 2);

        render.drawGrid(global, global.player, global.screen, graph);

        (global.foods || []).forEach(food => {
            if (food.x === undefined) return;
            render.drawFood(getPosition(food, global.player, global.screen), food, graph);
        });

        (global.fireFood || []).forEach(mf => {
            if (mf.x === undefined) return;
            render.drawFireFood(getPosition(mf, global.player, global.screen), mf, playerConfig, graph);
        });

        var borders = {
            left:   global.screen.width  / 2 - global.player.x,
            right:  global.screen.width  / 2 + global.game.width  - global.player.x,
            top:    global.screen.height / 2 - global.player.y,
            bottom: global.screen.height / 2 + global.game.height - global.player.y
        };
        if (global.borderDraw) render.drawBorder(borders, graph);

        function resolveUserColor(u) {
            if (!u) return 'hsl(0, 100%, 50%)';
            if (u.customColor) return u.customColor;
            let skinId = u.skinId || 'default';
            let skin = (skinsData && typeof skinsData.getSkinById === 'function') ? skinsData.getSkinById(skinId) : null;
            if (skin && skin.bodyColor) return skin.bodyColor;
            var hue = (skin && skin.bodyHue !== undefined && skin.bodyHue !== -1) ? skin.bodyHue : (u.hue || 0);
            return 'hsl(' + hue + ', 100%, 50%)';
        }

        var cellsToDraw = [];
        (global.users || []).forEach(user => {
            const col    = resolveUserColor(user);
            const border = darkenCss(col);
            (user.cells || []).forEach(cell => {
                if (cell.x === undefined) return;
                cellsToDraw.push({
                    color: col, borderColor: border, mass: cell.mass, name: user.name, radius: cell.radius,
                    skinId: user.skinId || null, isAFK: user.isAFK || false,
                    x: cell.x - global.player.x + global.screen.width  / 2,
                    y: cell.y - global.player.y + global.screen.height / 2
                });
            });
        });

        if (global.player?.cells) {
            const col    = resolveUserColor(global.player);
            const border = darkenCss(col);
            global.player.cells.forEach(c => {
                if (c.x === undefined) return;
                cellsToDraw.push({
                    color: col, borderColor: border, mass: c.mass, name: global.player.name, radius: c.radius,
                    skinId: global.player.skinId || null, isAFK: global.player.isAFK || false,
                    x: (c.x||0) - (global.player.x||0) + global.screen.width  / 2,
                    y: (c.y||0) - (global.player.y||0) + global.screen.height / 2
                });
            });
        }

        cellsToDraw.sort((a, b) => a.mass - b.mass);
        render.drawCells(cellsToDraw, playerConfig, global.toggleMassState, borders, graph, global.showScoreInCell);

        (global.viruses || []).forEach(virus => {
            if (virus.x === undefined) return;
            const v = Object.assign({ fill: '#33ff33', stroke: '#19D119', strokeWidth: 20, isMoving: false }, virus);
            render.drawVirus(getPosition(v, global.player, global.screen), v, graph);
        });

        graph.restore();
        socket.emit('0', window.canvas.target);
    }
}

function darkenCss(color) {
    if (color.startsWith('hsl(')) {
        return color.replace(/,(\s*\d+)%\)$/, (_, l) => ',' + Math.max(0, parseInt(l) - 10) + '%)');
    }
    return color;
}

window.requestAnimFrame = (function () {
    return window.requestAnimationFrame || window.webkitRequestAnimationFrame ||
           window.mozRequestAnimationFrame || window.msRequestAnimationFrame ||
           function (cb) { window.setTimeout(cb, 1000 / 60); };
})();

let throttleInterval = null;
function animloop() {
    if (document.hidden) {
        if (global.animLoopHandle) {
            window.cancelAnimationFrame(global.animLoopHandle);
            global.animLoopHandle = undefined;
        }
        if (!throttleInterval) throttleInterval = setInterval(gameLoop, 100);
    } else {
        if (throttleInterval) {
            clearInterval(throttleInterval);
            throttleInterval = null;
        }
        global.animLoopHandle = window.requestAnimFrame(animloop);
        gameLoop();
    }
}

function updateFocus(isFocused) {
    if (socket && global.gameStart) {
        socket.emit('playerFocusStatus', { isFocused: isFocused });
    }
}
window.addEventListener('blur', () => updateFocus(false));
window.addEventListener('focus', () => updateFocus(true));
document.addEventListener("visibilitychange", () => {
    const isVisible = !document.hidden;
    updateFocus(isVisible);
    if (isVisible && !global.animLoopHandle && global.gameStart) animloop();
});

window.addEventListener('resize', resize);
function resize() {
    if (!socket) return;
    global.screen.width = window.innerWidth;
    global.screen.height = window.innerHeight;

    // Calculate normalization scale (BaseScale)
    let bScale = window.innerHeight / global.refRes.height;
    const maxGameUnitsWide = 2200; 
    if (window.innerWidth / bScale > maxGameUnitsWide) {
        bScale = window.innerWidth / maxGameUnitsWide;
    }
    global.baseScale = bScale;
    
    // Update finalZoom immediately so sendAoiUpdate is accurate
    global.finalZoom = Math.max(0.60, global.baseScale * global.zoom);

    c.width = global.screen.width;
    c.height = global.screen.height;

    if (global.playerType === 'player') {
        global.player.screenWidth = global.screen.width;
        global.player.screenHeight = global.screen.height;
    } else {
        global.player.screenWidth = global.game.width;
        global.player.screenHeight = global.game.height;
        global.player.x = global.game.width  / 2;
        global.player.y = global.game.height / 2;
    }
    
    sendAoiUpdate();
}

/**
 * Sends the ACTUAL visible game units to the server.
 * This ensures the server only sends data for things you can see, 
 * regardless of your screen resolution or zoom level.
 */
function sendAoiUpdate() {
    if (!socket) return;
    
    // Calculate visible units based on zoom, with a 10% safety buffer
    const buffer = 1.1;
    const unitsW = (window.innerWidth / global.finalZoom) * buffer;
    const unitsH = (window.innerHeight / global.finalZoom) * buffer;

    socket.emit('windowResized', { 
        screenWidth: Math.round(unitsW), 
        screenHeight: Math.round(unitsH) 
    });
}
setTimeout(resize, 100);

const getPosition = (e, p, s) => ({ x: e.x - p.x + s.width/2, y: e.y - p.y + s.height/2 });

window.canvas = new Canvas();
window.chat   = new ChatClient();
var c     = window.canvas.cv;
var graph = c.getContext('2d');

$('#feed').click(function  () { socket.emit('1'); window.canvas.reenviar = false; });
$('#split').click(function () { socket.emit('2'); window.canvas.reenviar = false; });

window.onload = function () {
    var btn = document.getElementById('startButton');
    var nickErrorText = document.querySelector('#startMenu .input-error');
    if (btn) {
        btn.onclick = () => {
            if (validNick()) { nickErrorText.style.opacity = 0; startGame('player'); }
            else if (nickErrorText) nickErrorText.style.opacity = 1;
        };
    }
    const setBtn = document.getElementById('settingsButton');
    if (setBtn) setBtn.onclick = () => document.getElementById('settingsModal').style.display = 'flex';
    const closeBtn = document.getElementById('closeSettings');
    if (closeBtn) closeBtn.onclick = () => document.getElementById('settingsModal').style.display = 'none';

    if (playerNameInput) {
        playerNameInput.addEventListener('keypress', function (e) {
            if ((e.which || e.keyCode) === global.KEY_ENTER) {
                if (validNick()) { if (nickErrorText) nickErrorText.style.opacity = 0; startGame('player'); }
                else if (nickErrorText) nickErrorText.style.opacity = 1;
            }
        });
    }

    function saveSettings() {
        const settings = {
            visBord: document.getElementById('visBord').checked,
            showMass: document.getElementById('showMass').checked,
            showScore: document.getElementById('showScore').checked,
            continuity: document.getElementById('continuity').checked,
            roundFood: document.getElementById('roundFood').checked,
            darkMode: document.getElementById('darkMode').checked,
            showDebug: document.getElementById('showDebug').checked,
            showStats: document.getElementById('showStats').checked
        };
        localStorage.setItem('agarSettings', JSON.stringify(settings));
    }

    function loadSettings() {
        try {
            const s = JSON.parse(localStorage.getItem('agarSettings') || 'null');
            if (s) {
                Object.keys(s).forEach(id => {
                    const el = document.getElementById(id);
                    if (el) { el.checked = s[id]; el.dispatchEvent(new Event('change')); }
                });
            }
        } catch (_) {}
    }

    document.getElementById('visBord')?.addEventListener('change', function () { global.borderDraw = this.checked; saveSettings(); });
    document.getElementById('showMass')?.addEventListener('change', function () { global.toggleMassState = this.checked ? 1 : 0; saveSettings(); });
    document.getElementById('showScore')?.addEventListener('change', function () { global.showScoreInCell = this.checked; saveSettings(); });
    document.getElementById('continuity')?.addEventListener('change', function () { global.continuity = this.checked; saveSettings(); });
    document.getElementById('roundFood')?.addEventListener('change', function () { saveSettings(); });
    document.getElementById('darkMode')?.addEventListener('change', function () {
        global.backgroundColor = this.checked ? '#181818' : '#f2fbff';
        global.lineColor       = this.checked ? '#ffffff' : '#000000';
        saveSettings();
    });
    document.getElementById('showDebug')?.addEventListener('change', function () {
        global.showDebug = this.checked;
        const log = document.getElementById('debug-log');
        if (log) log.style.display = this.checked ? 'block' : 'none';
        saveSettings();
    });
    document.getElementById('showStats')?.addEventListener('change', function () {
        global.showStats = this.checked;
        const log = document.getElementById('stats-log');
        if (log) log.style.display = this.checked ? 'block' : 'none';
        saveSettings();
    });
    loadSettings();

    window.addEventListener('wheel', function(e) {
        if (e.deltaY > 0) global.zoom = Math.max(0.60, global.zoom - 0.05);
        else global.zoom = Math.min(2.5, global.zoom + 0.05);
        
        // Recalculate finalZoom and update server AOI
        global.finalZoom = Math.max(0.60, global.baseScale * global.zoom);
        sendAoiUpdate();
    });
};
