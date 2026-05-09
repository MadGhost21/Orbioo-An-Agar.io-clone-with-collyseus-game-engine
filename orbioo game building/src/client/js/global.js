module.exports = {
    // Keys and other mathematical constants
    KEY_ESC: 27,
    KEY_ENTER: 13,
    KEY_CHAT: 13,
    KEY_FIREFOOD: 119,
    KEY_SPLIT: 32,
    KEY_LEFT: 37,
    KEY_UP: 38,
    KEY_RIGHT: 39,
    KEY_DOWN: 40,
    borderDraw: false,
    mobile: false,
    zoom: 1.0, // Default zoom factor (1.0 for PC)
    // Canvas
    screen: {
        width: window.innerWidth,
        height: window.innerHeight
    },
    game: {
        width: 0,
        height: 0
    },
    // Reference resolution for camera normalization (1080p)
    refRes: {
        width: 1920,
        height: 1080
    },
    baseScale: 1.0,  // Normalization factor (window vs 1080p)
    finalZoom: 1.0,  // Combined baseScale * zoom
    gameStart: false,
    disconnected: false,
    kicked: false,
    continuity: false,
    showDebug: false,
    showStats: false,
    startPingTime: 0,
    toggleMassState: 0,
    target: { x: 0, y: 0 },
    backgroundColor: '#f2fbff',
    lineColor: '#000000',
    foods: [],
    users: [],
    viruses: [],
    fireFood: [],
    player: {
        cells: [],
        massTotal: 0,
        x: 0,
        y: 0,
        hue: 0,
        name: ""
    }
};

