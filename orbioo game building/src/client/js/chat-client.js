var global = require('./global');

class ChatClient {
    constructor(params) {
        this.canvas = global.canvas;
        this.socket = global.socket;
        this.mobile = global.mobile;
        this.player = global.player;
        var self = this;
        this.commands = {};
        var input = document.getElementById('chatInput');
        this.box = document.getElementById('chatbox');
        this.toggleBtn = document.getElementById('chatToggle');
        this.badge = document.getElementById('chatBadge');
        this.unreadCount = 0;
        
        // Hide by default
        this.box.classList.add('hidden');

        input.addEventListener('keydown', this.sendChat.bind(this));
        input.addEventListener('keyup', function(key) {
            input = document.getElementById('chatInput');
            key = key.which || key.keyCode;
            if (key === global.KEY_ESC) {
                input.value = '';
                self.toggleChat(false);
            }
        });

        if (this.toggleBtn) {
            this.toggleBtn.onclick = () => this.toggleChat();
        }

        global.chatClient = this;
    }

    toggleChat(force) {
        if (typeof force === 'boolean') {
            if (force) this.box.classList.remove('hidden');
            else this.box.classList.add('hidden');
        } else {
            this.box.classList.toggle('hidden');
        }

        // Clear notifications when opened
        if (!this.box.classList.contains('hidden')) {
            this.unreadCount = 0;
            if (this.badge) {
                this.badge.classList.add('hidden');
                this.badge.innerText = '0';
            }
        }

        const input = document.getElementById('chatInput');
        if (!this.box.classList.contains('hidden')) {
            input.focus();
        } else {
            input.blur();
            if (global.canvas && global.canvas.cv) {
                global.canvas.cv.focus();
            }
        }
    }

    // TODO: Break out many of these GameControls into separate classes.

    registerFunctions() {
        var self = this;
        this.registerCommand('ping', 'Check your latency.', function () {
            self.checkLatency();
        });

        this.registerCommand('dark', 'Toggle dark mode.', function () {
            self.toggleDarkMode();
        });

        this.registerCommand('border', 'Toggle visibility of border.', function () {
            self.toggleBorder();
        });

        this.registerCommand('mass', 'Toggle visibility of mass.', function () {
            self.toggleMass();
        });

        this.registerCommand('continuity', 'Toggle continuity.', function () {
            self.toggleContinuity();
        });

        this.registerCommand('roundfood', 'Toggle food drawing.', function (args) {
            self.toggleRoundFood(args);
        });

        this.registerCommand('help', 'Information about the chat commands.', function () {
            self.printHelp();
        });

        this.registerCommand('login', 'Login as an admin.', function (args) {
            self.socket.emit('pass', args);
        });

        this.registerCommand('kick', 'Kick a player, for admins only.', function (args) {
            self.socket.emit('kick', args);
        });

        if (this.socket) {
            this.socket.on('serverSendPlayerChat', (data) => {
                const isMe = data.senderId === this.socket.sessionId;
                this.addChatLine(data.sender, data.message, isMe);
            });
        }

        global.chatClient = this;
    }

    // Chat box implementation for the users.
    addChatLine(name, message, me) {
        var newline = document.createElement('li');

        // Colours the chat input correctly.
        newline.className = (me) ? 'me' : 'friend';
        newline.innerHTML = '<b>' + ((name.length < 1) ? 'An unnamed cell' : name) + '</b>: ' + message;

        this.appendMessage(newline);
    }

    // Chat box implementation for the system.
    addSystemLine(message) {
        var newline = document.createElement('li');

        // Colours the chat input correctly.
        newline.className = 'system';
        newline.innerHTML = message;

        // Append messages to the logs.
        this.appendMessage(newline);
    }

    // Places the message DOM node into the chat box.
    appendMessage(node) {
        var chatList = document.getElementById('chatList');
        if (chatList.childNodes.length > 10) {
            chatList.removeChild(chatList.childNodes[0]);
        }
        chatList.appendChild(node);
        chatList.scrollTop = chatList.scrollHeight;

        // Update notification badge if chat is hidden
        if (this.box && this.box.classList.contains('hidden')) {
            this.unreadCount++;
            if (this.badge) {
                this.badge.innerText = this.unreadCount > 9 ? '9+' : this.unreadCount;
                this.badge.classList.remove('hidden');
            }
        }
    }

    // Sends a message or executes a command on the click of enter.
    sendChat(key) {
        var commands = this.commands,
            input = document.getElementById('chatInput');

        key = key.which || key.keyCode;

        if (key === global.KEY_ENTER) {
            var text = input.value.replace(/(<([^>]+)>)/ig,'');
            if (text !== '') {

                // Chat command.
                if (text.indexOf('-') === 0) {
                    var args = text.substring(1).split(' ');
                    if (commands[args[0]]) {
                        commands[args[0]].callback(args.slice(1));
                    } else {
                        this.addSystemLine('Unrecognized Command: ' + text + ', type -help for more info.');
                    }

                // Allows for regular messages to be sent to the server.
                } else {
                    this.socket.emit('chat', { message: text });
                }

                // Resets input.
                input.value = '';
            }
            this.toggleChat(false);
        }
    }

    // Allows for addition of commands.
    registerCommand(name, description, callback) {
        this.commands[name] = {
            description: description,
            callback: callback
        };
    }

    // Allows help to print the list of all the commands and their descriptions.
    printHelp() {
        var commands = this.commands;
        for (var cmd in commands) {
            if (commands.hasOwnProperty(cmd)) {
                this.addSystemLine('-' + cmd + ': ' + commands[cmd].description);
            }
        }
    }

    checkLatency() {
        // Ping.
        global.startPingTime = Date.now();
        this.socket.emit('pingcheck');
    }

    toggleDarkMode() {
        var LIGHT = '#f2fbff',
            DARK = '#181818';
        var LINELIGHT = '#000000',
            LINEDARK = '#ffffff';

        if (global.backgroundColor === LIGHT) {
            global.backgroundColor = DARK;
            global.lineColor = LINEDARK;
            this.addSystemLine('Dark mode enabled.');
        } else {
            global.backgroundColor = LIGHT;
            global.lineColor = LINELIGHT;
            this.addSystemLine('Dark mode disabled.');
        }
    }

    toggleBorder() {
        if (!global.borderDraw) {
            global.borderDraw = true;
            this.addSystemLine('Showing border.');
        } else {
            global.borderDraw = false;
            this.addSystemLine('Hiding border.');
        }
    }

    toggleMass() {
        if (global.toggleMassState === 0) {
            global.toggleMassState = 1;
            this.addSystemLine('Viewing mass enabled.');
        } else {
            global.toggleMassState = 0;
            this.addSystemLine('Viewing mass disabled.');
        }
    }

    toggleContinuity() {
        if (!global.continuity) {
            global.continuity = true;
            this.addSystemLine('Continuity enabled.');
        } else {
            global.continuity = false;
            this.addSystemLine('Continuity disabled.');
        }
    }

    toggleRoundFood(args) {
        if (args || global.foodSides < 10) {
            global.foodSides = (args && !isNaN(args[0]) && +args[0] >= 3) ? +args[0] : 10;
            this.addSystemLine('Food is now rounded!');
        } else {
            global.foodSides = 5;
            this.addSystemLine('Food is no longer rounded!');
        }
    }
}

module.exports = ChatClient;
