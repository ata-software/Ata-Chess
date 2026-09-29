// Standalone Online Chess WebSocket & HTTP Server
// Serves both the web client and real-time multiplayer sockets on the same port

const http = require('http');
const fs = require('fs');
const path = require('path');

let WebSocket;
try {
    WebSocket = require('ws');
} catch (e) {
    console.error("\n[!] 'ws' modülü bulunamadı. Lütfen sunucuda şu komutu çalıştırın:\n    npm install ws\n");
    process.exit(1);
}

const PORT = process.env.PORT || 3000;

// MIME types for static files
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff'
};

// 1. HTTP Server for static game files
const server = http.createServer((req, res) => {
    let filePath = req.url.split('?')[0];
    if (filePath === '/') filePath = '/index.html';

    const safePath = path.normalize(path.join(__dirname, filePath));
    if (!safePath.startsWith(__dirname)) {
        res.writeHead(403);
        return res.end('Access Denied');
    }

    fs.readFile(safePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('404 Bulunamadı');
            } else {
                res.writeHead(500);
                res.end('Sunucu Hatası: ' + err.code);
            }
        } else {
            const ext = path.extname(safePath).toLowerCase();
            res.writeHead(200, {
                'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
                'Cache-Control': 'no-cache'
            });
            res.end(content);
        }
    });
});

// 2. WebSocket Server for Online Multiplayer
const wss = new WebSocket.Server({ server });

// Active rooms storage: roomId -> { id, white: ws, black: ws, fen, moves: [] }
const rooms = new Map();

function generateRoomCode() {
    let code;
    do {
        code = Math.floor(1000 + Math.random() * 9000).toString();
    } while (rooms.has(code));
    return code;
}

function broadcast(room, payload, excludeWs = null) {
    const msg = JSON.stringify(payload);
    [room.white, room.black].forEach(client => {
        if (client && client.readyState === WebSocket.OPEN && client !== excludeWs) {
            client.send(msg);
        }
    });
}

wss.on('connection', (ws) => {
    ws.currentRoom = null;
    ws.color = null;

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            handleClientMessage(ws, message);
        } catch (err) {
            console.error('Mesaj işleme hatası:', err.message);
        }
    });

    ws.on('close', () => {
        if (ws.currentRoom) {
            const room = rooms.get(ws.currentRoom);
            if (room) {
                broadcast(room, {
                    type: 'opponent_disconnected',
                    message: 'Rakibin bağlantısı koptu.'
                }, ws);
                // If both left, delete room
                if (room.white === ws) room.white = null;
                if (room.black === ws) room.black = null;
                if (!room.white && !room.black) {
                    rooms.delete(ws.currentRoom);
                }
            }
        }
    });
});

function handleClientMessage(ws, msg) {
    switch (msg.type) {
        case 'create_room': {
            const roomId = generateRoomCode();
            const playerName = (msg.playerName || 'Oyuncu 1').trim();
            const room = {
                id: roomId,
                white: ws,
                black: null,
                whiteName: playerName,
                whiteFrame: msg.playerFrame || '',
                blackName: null,
                blackFrame: '',
                timeControl: msg.timeControl || 0,
                createdAt: Date.now()
            };
            rooms.set(roomId, room);
            ws.currentRoom = roomId;
            ws.color = 'w';

            ws.send(JSON.stringify({
                type: 'room_created',
                roomId,
                color: 'w',
                message: 'Oda oluşturuldu. Rakip bekleniyor...'
            }));
            console.log(`[+] Yeni Oda Oluşturuldu: ${roomId} (${playerName})`);
            break;
        }

        case 'join_room': {
            const roomId = (msg.roomId || '').trim();
            const room = rooms.get(roomId);

            if (!room) {
                return ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Oda bulunamadı! Kodu kontrol edin.'
                }));
            }

            if (!room.white || room.white.readyState !== WebSocket.OPEN) {
                rooms.delete(roomId);
                return ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Oda sahibi ayrılmış! Yeni bir oda oluşturun.'
                }));
            }

            if (room.black && room.black.readyState === WebSocket.OPEN) {
                return ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Bu oda şu anda dolu!'
                }));
            }

            const guestName = (msg.playerName || 'Oyuncu 2').trim();
            room.black = ws;
            room.blackName = guestName;
            room.blackFrame = msg.playerFrame || '';
            ws.currentRoom = roomId;
            ws.color = 'b';

            // Send confirmation to Black
            ws.send(JSON.stringify({
                type: 'game_start',
                roomId,
                color: 'b',
                opponentName: room.whiteName || 'Oyuncu 1 (Beyaz)',
                opponentFrame: room.whiteFrame || '',
                timeControl: room.timeControl
            }));

            // Notify White that Black joined
            room.white.send(JSON.stringify({
                type: 'game_start',
                roomId,
                color: 'w',
                opponentName: guestName || 'Oyuncu 2 (Siyah)',
                opponentFrame: room.blackFrame || '',
                timeControl: room.timeControl
            }));

            console.log(`[>] Odaya Katılındı: ${roomId} (${room.whiteName} vs ${guestName}) - Oyun Başladı!`);
            break;
        }

        case 'frame_update': {
            if (!ws.currentRoom) return;
            const room = rooms.get(ws.currentRoom);
            if (!room) return;
            if (ws === room.white) room.whiteFrame = msg.frame || '';
            if (ws === room.black) room.blackFrame = msg.frame || '';
            broadcast(room, {
                type: 'frame_update',
                frame: msg.frame || ''
            }, ws);
            break;
        }

        case 'make_move': {
            if (!ws.currentRoom) return;
            const room = rooms.get(ws.currentRoom);
            if (!room) return;

            // Relay move to opponent
            broadcast(room, {
                type: 'opponent_move',
                move: msg.move
            }, ws);
            break;
        }

        case 'rematch_request': {
            if (!ws.currentRoom) return;
            const room = rooms.get(ws.currentRoom);
            if (!room) return;

            broadcast(room, {
                type: 'rematch_offered',
                fromColor: ws.color
            }, ws);
            break;
        }

        case 'rematch_accept': {
            if (!ws.currentRoom) return;
            const room = rooms.get(ws.currentRoom);
            if (!room) return;

            // Swap colors for rematch
            const temp = room.white;
            room.white = room.black;
            room.black = temp;

            if (room.white) room.white.color = 'w';
            if (room.black) room.black.color = 'b';

            if (room.white) {
                room.white.send(JSON.stringify({ type: 'rematch_start', color: 'w' }));
            }
            if (room.black) {
                room.black.send(JSON.stringify({ type: 'rematch_start', color: 'b' }));
            }
            break;
        }

        case 'resign': {
            if (!ws.currentRoom) return;
            const room = rooms.get(ws.currentRoom);
            if (!room) return;

            broadcast(room, {
                type: 'opponent_resigned',
                resignedColor: ws.color
            }, ws);
            break;
        }

        case 'ping': {
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
        }
    }
}

server.listen(PORT, () => {
    console.log(`\n==============================================`);
    console.log(`🚀 Satranç Sunucusu Aktif!`);
    console.log(`📡 HTTP & WebSocket Portu: http://localhost:${PORT}`);
    console.log(`🌐 Uzak Sunucu IP: wss://<sunucu-ip-veya-domain>:${PORT}`);
    console.log(`==============================================\n`);
});
