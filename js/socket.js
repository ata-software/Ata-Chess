// Online Chess – PeerJS WebRTC Client
// Sunucu gerektirmez. GitHub Pages + PeerJS public TURN/STUN ile çalışır.
// API: ChessSocket sınıfı, önceki WebSocket tabanlı ChessSocket ile tamamen uyumlu.

class ChessSocket {
    constructor() {
        this.peer = null;         // PeerJS Peer instance (host veya guest)
        this.conn = null;         // DataConnection (aktif bağlantı)
        this.isConnected = false;
        this.isConnecting = false;
        this.currentRoom = null;  // Oda kodu (host'un Peer ID'si)
        this.myColor = null;      // 'w' or 'b'
        this.myRole  = null;      // 'host' or 'guest'
        this.ping = 0;
        this._pingTimer = null;
        this._pingTime  = null;
        this._pendingActions = [];
        this._connectTimeout = null;

        // Callbacks (app.js ile aynı arayüz)
        this.onConnect              = null;
        this.onDisconnect           = null;
        this.onRoomCreated          = null;  // (roomCode)
        this.onGameStart            = null;  // ({color, roomId, opponentName, opponentFrame, timeControl})
        this.onOpponentMove         = null;  // (move)
        this.onOpponentDisconnected = null;  // (message)
        this.onError                = null;  // (errorMessage)
        this.onRematchStart         = null;  // (color)
        this.onOpponentResigned     = null;  // ()
        this.onOpponentFrame        = null;  // (frameSrc)

        this._pendingHostFrame      = '';
        this._pendingGuestFrame     = '';
    }

    // ── Yardımcılar ───────────────────────────────────────────────

    _log(...args)  { console.log('[PeerSocket]', ...args); }
    _warn(...args) { console.warn('[PeerSocket]', ...args); }

    _triggerError(msg) {
        this._warn('Hata:', msg);
        if (this.onError) this.onError(msg);
    }

    _triggerDisconnect() {
        const wasConnected = this.isConnected;
        this.isConnected  = false;
        this.isConnecting = false;
        this._stopPing();
        if (this.onDisconnect) this.onDisconnect();
        if (!wasConnected && this.onError) {
            this.onError('Bağlantı kurulamadı. PeerJS ağına erişilemiyor olabilir.');
        }
    }

    _startPing() {
        this._stopPing();
        this._pingTimer = setInterval(() => {
            if (this.conn && this.conn.open) {
                this._pingTime = performance.now();
                this._send({ type: 'ping' });
            }
        }, 10000);
    }

    _stopPing() {
        if (this._pingTimer) { clearInterval(this._pingTimer); this._pingTimer = null; }
    }

    _send(obj) {
        if (!this.conn || !this.conn.open) {
            this._warn('Mesaj gönderilemedi, bağlantı kapalı:', obj);
            return;
        }
        try { this.conn.send(obj); } catch (e) { this._warn('Send hatası:', e); }
    }

    // ── PeerJS Peer oluşturma ─────────────────────────────────────

    _makePeer(customId) {
        if (typeof Peer === 'undefined') {
            this._triggerError('PeerJS kütüphanesi yüklenemedi. İnternet bağlantınızı kontrol edin.');
            throw new Error('PeerJS not loaded');
        }
        const options = {
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            },
            debug: 0
        };
        return customId ? new Peer(customId, options) : new Peer(options);
    }

    // ── Bağlantı Kapatma ──────────────────────────────────────────

    disconnect(clearRooms = true) {
        clearTimeout(this._connectTimeout);
        this._stopPing();
        if (this.conn) {
            try { this.conn.close(); } catch (e) {}
            this.conn = null;
        }
        if (this.peer) {
            try { this.peer.destroy(); } catch (e) {}
            this.peer = null;
        }
        this.isConnected  = false;
        this.isConnecting = false;
        if (clearRooms) {
            this.currentRoom = null;
            this.myColor = null;
            this.myRole  = null;
            this._pendingActions = [];
        }
    }

    // ── Mesaj Yönlendirme ─────────────────────────────────────────

    _handleMessage(msg) {
        if (!msg || !msg.type) return;
        switch (msg.type) {
            case 'pong':
                if (this._pingTime) this.ping = Math.round(performance.now() - this._pingTime);
                break;

            case 'ping':
                this._send({ type: 'pong' });
                break;

            case 'game_start':
                // Guest tarafında host'tan gelir
                this.currentRoom = msg.roomId;
                this.myColor = msg.color;
                if (this.onGameStart) {
                    this.onGameStart({
                        color:         msg.color,
                        roomId:        msg.roomId,
                        opponentName:  msg.opponentName,
                        opponentFrame: msg.opponentFrame || '',
                        timeControl:   msg.timeControl
                    });
                }
                break;

            case 'host_ready':
                // Host'ta guest'ten "hazırım" sinyali gelir → oyunu başlat
                if (this.myRole === 'host') {
                    const guestName  = msg.playerName || 'Rakip';
                    const guestFrame = msg.playerFrame || '';
                    const hostColor  = this.myColor || 'w';
                    const guestColor = hostColor === 'w' ? 'b' : 'w';

                    // Host'a game_start gönder
                    if (this.onGameStart) {
                        this.onGameStart({
                            color:         hostColor,
                            roomId:        this.currentRoom,
                            opponentName:  guestName,
                            opponentFrame: guestFrame,
                            timeControl:   this._pendingTimeControl || 0
                        });
                    }
                    // Guest'e de game_start gönder (Host'un seçili çerçevesi dahil)
                    this._send({
                        type:          'game_start',
                        color:         guestColor,
                        roomId:        this.currentRoom,
                        opponentName:  this._pendingHostName || 'Rakip',
                        opponentFrame: this._pendingHostFrame || '',
                        timeControl:   this._pendingTimeControl || 0
                    });
                }
                break;

            case 'frame_update':
                if (this.onOpponentFrame) {
                    this.onOpponentFrame(msg.frame || '');
                }
                break;

            case 'opponent_move':
                if (this.onOpponentMove) this.onOpponentMove(msg.move);
                break;

            case 'opponent_resigned':
                if (this.onOpponentResigned) this.onOpponentResigned();
                break;

            case 'rematch_offered':
                // Karşı taraf rematch istedi → otomatik kabul
                this._send({ type: 'rematch_accept', fromColor: this.myColor });
                break;

            case 'rematch_accept':
                // Her iki taraf da renk değiştirir
                const newMyColor = this.myColor === 'w' ? 'b' : 'w';
                this.myColor = newMyColor;
                if (this.onRematchStart) this.onRematchStart(newMyColor);
                break;

            case 'opponent_disconnected':
                if (this.onOpponentDisconnected) {
                    this.onOpponentDisconnected(msg.message || 'Rakibin bağlantısı koptu.');
                }
                break;
        }
    }

    _setupConn(conn, role) {
        this.conn = conn;

        conn.on('open', () => {
            clearTimeout(this._connectTimeout);
            this.isConnected  = true;
            this.isConnecting = false;
            this._log('DataConnection açıldı, rol:', role);
            this._startPing();
            if (this.onConnect) this.onConnect();

            if (role === 'guest') {
                // Guest bağlandığında host'a hazır sinyali ve kendi çerçevesini gönder
                this._send({
                    type:        'host_ready',
                    playerName:  this._pendingGuestName || 'Rakip',
                    playerFrame: this._pendingGuestFrame || ''
                });
            }
        });

        conn.on('data', (data) => {
            try { this._handleMessage(data); } catch (e) { this._warn('Mesaj hatası:', e); }
        });

        conn.on('close', () => {
            this._log('DataConnection kapandı');
            const wasConnected = this.isConnected;
            this.isConnected = false;
            this._stopPing();
            if (wasConnected) {
                if (this.onOpponentDisconnected) {
                    this.onOpponentDisconnected('Rakibin bağlantısı koptu.');
                }
            }
            if (this.onDisconnect) this.onDisconnect();
        });

        conn.on('error', (err) => {
            this._warn('DataConnection hatası:', err);
            this._triggerError('Bağlantı hatası: ' + (err.message || err));
        });
    }

    // ── Public API (app.js ile aynı) ──────────────────────────────

    _generateRoomCode() {
        const digits = '0123456789';
        const lower  = 'abcdefghijklmnopqrstuvwxyz';
        const upper  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

        // 1 rakam, 1 küçük harf, 2 büyük harf
        const d  = digits[Math.floor(Math.random() * digits.length)];
        const l  = lower[Math.floor(Math.random() * lower.length)];
        const u1 = upper[Math.floor(Math.random() * upper.length)];
        const u2 = upper[Math.floor(Math.random() * upper.length)];

        // 4 haneyi rastgele karıştır
        const arr = [d, l, u1, u2];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr.join('');
    }

    createRoom(options = {}) {
        this.disconnect(true);
        this.myRole  = 'host';
        this.myColor = options.hostColor || 'w';
        this._pendingHostName    = options.playerName || 'Oyuncu 1';
        this._pendingHostFrame   = options.frame || '';
        this._pendingTimeControl = options.timeControl || 0;

        const roomCode = this._generateRoomCode();
        this._log('Oda oluşturuluyor, kod:', roomCode);

        try {
            // PeerJS'e kısa custom ID ver → kullanıcılar bu kodu kullanır
            const peer = this._makePeer(roomCode);
            this.peer = peer;

            // 15 saniyelik timeout
            this._connectTimeout = setTimeout(() => {
                if (!this.currentRoom) {
                    this.disconnect();
                    this._triggerError('PeerJS sunucusuna bağlanılamadı. İnternet bağlantınızı kontrol edin.');
                }
            }, 15000);

            peer.on('open', (id) => {
                clearTimeout(this._connectTimeout);
                this.currentRoom = id;
                this._log('Peer açıldı, oda kodu:', id);

                if (this.onRoomCreated) this.onRoomCreated(id);

                // Rakip bağlantısını bekle
                peer.on('connection', (conn) => {
                    this._log('Rakip bağlandı!');
                    this._setupConn(conn, 'host');
                });
            });

            peer.on('error', (err) => {
                this._warn('Peer hatası:', err);
                let msg = 'PeerJS hatası: ' + (err.type || err.message || err);
                if (err.type === 'unavailable-id') {
                    // Kod çakıştı → yeni kod dene
                    this._log('Kod çakıştı, yeniden deneniyor...');
                    this.disconnect(false);
                    this.createRoom(options);
                    return;
                }
                if (err.type === 'network') msg = 'Ağ bağlantısı kesildi.';
                if (err.type === 'server-error') msg = 'PeerJS sunucusuna ulaşılamıyor. İnternet bağlantınızı kontrol edin.';
                this._triggerError(msg);
            });

            peer.on('disconnected', () => {
                this._log('Peer sunucusu bağlantısı kesildi');
            });
        } catch (err) {
            this._triggerError('Oda oluşturulamadı: ' + (err.message || err));
        }
    }

    joinRoom(roomCode, playerName = 'Oyuncu 2', options = {}) {
        const cleanCode = roomCode.trim();

        this.disconnect(true);
        this.myRole  = 'guest';
        this.myColor = 'b';
        this.currentRoom = cleanCode;
        this._pendingGuestName = playerName;
        this._pendingGuestFrame = (typeof options === 'object' && options && options.frame)
            ? options.frame
            : (typeof options === 'string' ? options : '');

        this._log('Odaya katılınıyor:', cleanCode);
        try {
            const peer = this._makePeer();
            this.peer = peer;

            this._connectTimeout = setTimeout(() => {
                if (!this.isConnected) {
                    this.disconnect();
                    this._triggerError('Oda bulunamadı veya bağlantı zaman aşımına uğradı. Kodu kontrol edin.');
                }
            }, 15000);

            peer.on('open', (myId) => {
                this._log('Guest peer açıldı:', myId, '→ Host\'a bağlanılıyor:', cleanCode);
                const conn = peer.connect(cleanCode, {
                    reliable: true,
                    serialization: 'json'
                });
                this._setupConn(conn, 'guest');
            });

            peer.on('error', (err) => {
                this._warn('Guest peer hatası:', err);
                let msg = 'Bağlantı hatası: ' + (err.type || err.message || err);
                if (err.type === 'peer-unavailable') msg = 'Oda bulunamadı! Kodu kontrol edin veya oda kapanmış olabilir.';
                if (err.type === 'network') msg = 'Ağ bağlantısı kesildi.';
                this._triggerError(msg);
            });
        } catch (err) {
            this._triggerError('Odaya bağlanılamadı: ' + (err.message || err));
        }
    }

    sendFrame(frame) {
        if (!this.isConnected || !this.conn) return;
        this._send({ type: 'frame_update', frame: frame || '' });
    }

    sendMove(move) {
        if (!this.isConnected || !this.currentRoom) return;
        this._send({ type: 'opponent_move', move });
    }

    sendResign() {
        if (!this.isConnected) return;
        this._send({ type: 'opponent_resigned' });
    }

    requestRematch() {
        if (!this.isConnected) return;
        this._send({ type: 'rematch_offered', fromColor: this.myColor });
    }

    goodbye() {
        this._send({ type: 'opponent_disconnected', message: 'Rakibin bağlantısı koptu.' });
        this.disconnect();
    }

    // Legacy uyumluluk – app.js bazı yerlerde çağırıyor
    connect(cb) { if (cb) cb(); }
    setServerUrl() {}
    getServerUrl() { return 'PeerJS (Sunucusuz P2P)'; }
}

window.ChessSocket = ChessSocket;
