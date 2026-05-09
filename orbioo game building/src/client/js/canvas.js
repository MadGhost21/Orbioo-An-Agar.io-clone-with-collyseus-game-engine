// canvas.js – v7
// Fix: Space (keyCode 32) doesn't fire on 'keypress' in some browsers.
//      Added 'keydown' listener as fallback for both Space (split) and W (feed).
//      W key = keyCode 119 on keypress, but on keydown it's 87 (uppercase W).
//      We handle both so it works regardless of browser.

var global = require('./global');

class Canvas {
    constructor(params) {
        this.directionLock = false;
        this.target   = global.target || { x: 0, y: 0 };
        this.reenviar = true;
        // socket is accessed via global.socket dynamically
        this.directions = [];
        var self = this;

        this.cv = document.getElementById('cvs');
        this.cv.width  = global.screen.width;
        this.cv.height = global.screen.height;

        this.cv.addEventListener('mousemove', (e) => this.gameInput(e), false);
        this.cv.addEventListener('mouseout',  (e) => this.outOfBounds(e), false);

        // keypress: handles printable chars (w = 119)
        this.cv.addEventListener('keypress', this.keyInput, false);

        // keydown: handles Space=32 (which doesn't fire keypress in many browsers)
        //          and W=87 as a fallback for the feed action
        this.cv.addEventListener('keydown', function(event) {
            var key = event.which || event.keyCode;
            var parent = self;

            // Arrow keys for direction
            if (parent.directional(key)) {
                parent.directionLock = true;
                if (parent.newDirection(key, parent.directions, true)) {
                    parent.updateTarget(parent.directions);
                    if (global.socket) global.socket.emit('0', parent.target);
                }
            }

            // Space = split (keypress doesn't fire for Space in Firefox/Safari)
            if (key === 32 && parent.reenviar) {
                event.preventDefault(); // prevent page scroll
                if (global.socket) {
                    var audio = document.getElementById('split_cell');
                    if (audio) audio.play();
                    global.socket.emit('2');
                    parent.reenviar = false;
                }
            }

            // W key (keydown code = 87) = feed / eject mass
            if (key === 87 && parent.reenviar) {
                if (global.socket) {
                    global.socket.emit('1');
                    parent.reenviar = false;
                }
            }
        }, false);

        this.cv.addEventListener('keyup', function(event) {
            self.reenviar = true;
            self.directionUp(event);
        }, false);

        this.cv.addEventListener('touchstart', (e) => this.touchInput(e), false);
        this.cv.addEventListener('touchmove',  (e) => this.touchInput(e), false);
        this.cv.parent = self;
        global.canvas  = this;
    }

    directionDown(event) {
        var key  = event.which || event.keyCode;
        var self = this.parent;
        if (self.directional(key)) {
            self.directionLock = true;
            if (self.newDirection(key, self.directions, true)) {
                self.updateTarget(self.directions);
                global.socket.emit('0', self.target);
            }
        }
    }

    directionUp(event) {
        var key = event.which || event.keyCode;
        if (this.directional(key)) {
            if (this.newDirection(key, this.directions, false)) {
                this.updateTarget(this.directions);
                if (this.directions.length === 0) this.directionLock = false;
                global.socket.emit('0', this.target);
            }
        }
    }

    newDirection(direction, list, isAddition) {
        var result = false;
        var found  = false;
        for (var i = 0, len = list.length; i < len; i++) {
            if (list[i] === direction) {
                found = true;
                if (!isAddition) {
                    result = true;
                    list.splice(i, 1);
                }
                break;
            }
        }
        if (isAddition && !found) {
            result = true;
            list.push(direction);
        }
        return result;
    }

    updateTarget(list) {
        this.target = { x: 0, y: 0 };
        var dH = 0, dV = 0;
        for (var i = 0, len = list.length; i < len; i++) {
            if (dH === 0) {
                if (list[i] === global.KEY_LEFT)  dH -= Number.MAX_VALUE;
                if (list[i] === global.KEY_RIGHT) dH += Number.MAX_VALUE;
            }
            if (dV === 0) {
                if (list[i] === global.KEY_UP)   dV -= Number.MAX_VALUE;
                if (list[i] === global.KEY_DOWN) dV += Number.MAX_VALUE;
            }
        }
        this.target.x += dH;
        this.target.y += dV;
        global.target = this.target;
    }

    directional(key) { return this.horizontal(key) || this.vertical(key); }
    horizontal(key)  { return key === global.KEY_LEFT  || key === global.KEY_RIGHT; }
    vertical(key)    { return key === global.KEY_DOWN   || key === global.KEY_UP; }

    outOfBounds() {
        if (!global.continuity) {
            this.parent.target = { x: 0, y: 0 };
            global.target = this.parent.target;
        }
    }

    gameInput(mouse) {
        if (!this.directionLock) {
            const finalZoom = global.finalZoom || 1.0;
            this.target.x = (mouse.clientX - this.cv.width  / 2) / finalZoom;
            this.target.y = (mouse.clientY - this.cv.height / 2) / finalZoom;
            global.target = this.target;
        }
    }

    touchInput(touch) {
        touch.preventDefault();
        touch.stopPropagation();
        if (!this.directionLock) {
            const finalZoom = global.finalZoom || 1.0;
            this.target.x = (touch.touches[0].clientX - this.cv.width  / 2) / finalZoom;
            this.target.y = (touch.touches[0].clientY - this.cv.height / 2) / finalZoom;
            global.target = this.target;
        }
    }

    // keypress: fires for W key (code 119) but NOT reliably for Space
    keyInput(event) {
        var key = event.which || event.keyCode;
        // W key via keypress (code 119 = lowercase w in charCode)
        if (key === global.KEY_FIREFOOD && this.parent.reenviar) {
            if (global.socket) global.socket.emit('1');
            this.parent.reenviar = false;
        }
        // Space via keypress (some browsers)
        else if (key === global.KEY_SPLIT && this.parent.reenviar) {
            var audio = document.getElementById('split_cell');
            if (audio) audio.play();
            if (global.socket) global.socket.emit('2');
            this.parent.reenviar = false;
        }
        // Open chat
        else if (key === global.KEY_CHAT) {
            if (global.chatClient) {
                global.chatClient.toggleChat(true);
            }
        }
    }
}

module.exports = Canvas;
