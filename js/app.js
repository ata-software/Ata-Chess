// Main Chess Application Controller

document.addEventListener('DOMContentLoaded', () => {
    // ── Core Engine and AI instances ────────────────────────────
    const engine = new ChessEngine();
    const ai     = new ChessAI();
    const audio  = window.chessAudio;
    const socket = new ChessSocket();

    // ── UI Elements ──────────────────────────────────────────────
    const canvasElement   = document.getElementById('chess-canvas');
    const boardContainer  = document.getElementById('board-container');
    const statusBanner    = document.getElementById('status-banner');
    const moveHistoryList = document.getElementById('move-history-list');

    // Player Panels
    const topPlayerName   = document.getElementById('top-player-name');
    const topPlayerBadge  = document.getElementById('top-player-badge');
    const topPlayerTimer  = document.getElementById('top-player-timer');
    const topCapturedTray = document.getElementById('top-captured-tray');
    const topMaterialDiff = document.getElementById('top-material-diff');

    const bottomPlayerName   = document.getElementById('bottom-player-name');
    const bottomPlayerBadge  = document.getElementById('bottom-player-badge');
    const bottomPlayerTimer  = document.getElementById('bottom-player-timer');
    const bottomCapturedTray = document.getElementById('bottom-captured-tray');
    const bottomMaterialDiff = document.getElementById('bottom-material-diff');

    // Controls
    const btnExit     = document.getElementById('btn-exit');
    const btnFlip     = document.getElementById('btn-flip');
    const btnNewGame  = document.getElementById('btn-new-game');
    const btnSound    = document.getElementById('btn-sound');
    const btnSettings = document.getElementById('btn-settings');
    const btnOnline   = document.getElementById('btn-online');

    // Lobby Screen Elements
    const lobbyScreen            = document.getElementById('lobby-screen');
    const lobbyModeBot           = document.getElementById('lobby-mode-bot');
    const lobbyModePvp           = document.getElementById('lobby-mode-pvp');
    const lobbyModeOnline        = document.getElementById('lobby-mode-online');
    const checkBot               = document.getElementById('check-bot');
    const checkPvp               = document.getElementById('check-pvp');
    const checkOnline            = document.getElementById('check-online');
    const lobbyDifficultySection = document.getElementById('lobby-difficulty-section');
    const lobbyOnlineSection     = document.getElementById('lobby-online-section');
    const diffPills              = document.querySelectorAll('.diff-pill');
    const sidePills              = document.querySelectorAll('.side-pill');
    const timePills              = document.querySelectorAll('.time-pill');
    const lobbyThemeCards        = document.querySelectorAll('.lobby-theme-card');
    const themePills             = document.querySelectorAll('.theme-pill');
    const lobbyStartBtn          = document.getElementById('lobby-start-btn');

    // ── Auth Session Integration ─────────────────────────────────
    // auth.js'den gelen oturum bilgisini al; nickname'i lobby'e aktar
    (function syncAuthSession() {
        const session = window.__authSession || (
            (() => {
                try {
                    const r = localStorage.getItem('ata_chess_session');
                    return r ? JSON.parse(r) : null;
                } catch (_) { return null; }
            })()
        );
        if (session && session.nickname) {
            localStorage.setItem('chess_pro_nickname', session.nickname);
        }
    })();

    // Nickname Elements
    const lobbyNicknameInput     = document.getElementById('lobby-nickname-input');
    const lobbyNicknameClear     = document.getElementById('lobby-nickname-clear');
    const lobbyNicknameWrap      = document.getElementById('lobby-nickname-wrap');
    let userNickname             = localStorage.getItem('chess_pro_nickname') || '';
    let selectedFrame            = '';
    try {
        selectedFrame = localStorage.getItem('chess_pro_frame') || '';
    } catch (e) {}
    let opponentFrame            = '';

    // ── Admin Yetkisi ve Çerçeve Kilidi Yönetimi ─────────────────
    window.__applyAdminPermissions = (isAdmin) => {
        const frameKizil = document.getElementById('frame-kizil');
        if (frameKizil) {
            if (isAdmin) {
                frameKizil.disabled = false;
                frameKizil.classList.remove('inv-frame-locked');
                const lockBadge = frameKizil.querySelector('.inv-frame-lock-badge');
                if (lockBadge) {
                    lockBadge.textContent = '👑 Admin Açık';
                    lockBadge.style.background = 'linear-gradient(135deg, #ffd700, #ff8c00)';
                    lockBadge.style.color = '#1a0f00';
                }
            } else {
                frameKizil.disabled = true;
                frameKizil.classList.add('inv-frame-locked');
                const lockBadge = frameKizil.querySelector('.inv-frame-lock-badge');
                if (lockBadge) {
                    lockBadge.textContent = '🔒 Sadece Admin';
                    lockBadge.style.background = '';
                    lockBadge.style.color = '';
                }
            }
        }
        // Oyuncu paneline admin rozeti
        const bottomNameEl = document.getElementById('bottom-player-name');
        if (bottomNameEl) {
            let existingBadge = bottomNameEl.querySelector('.hud-admin-badge');
            if (isAdmin && !existingBadge) {
                const b = document.createElement('span');
                b.className = 'hud-admin-badge';
                b.textContent = '👑 ADMIN';
                bottomNameEl.appendChild(b);
            } else if (!isAdmin && existingBadge) {
                existingBadge.remove();
            }
        }
    };

    // Başlangıçta kayıtlı admin durumunu kontrol et
    const initialIsAdmin = localStorage.getItem('chess_pro_isAdmin') === 'true';
    if (initialIsAdmin) {
        window.__applyAdminPermissions(true);
    }

    // Auth başarılı olduğunda (sayfa açıkken giriş yapılırsa) nickname ve admin güncelle
    window.__authReadyCallback = (session) => {
        if (session && session.nickname) {
            localStorage.setItem('chess_pro_nickname', session.nickname);
            userNickname = session.nickname;
            if (lobbyNicknameInput) lobbyNicknameInput.value = session.nickname;
            if (typeof updateLobbyProfile === 'function') updateLobbyProfile();
        }
        if (session && session.isAdmin !== undefined) {
            window.__applyAdminPermissions(Boolean(session.isAdmin));
        }
    };



    // Lobby Online Tab & Buttons
    const lobbyTabHost           = document.getElementById('lobby-tab-host');
    const lobbyTabJoin           = document.getElementById('lobby-tab-join');
    const lobbyPanelHost         = document.getElementById('lobby-panel-host');
    const lobbyPanelJoin         = document.getElementById('lobby-panel-join');
    const lobbyBtnCreateRoom     = document.getElementById('lobby-btn-create-room');
    const lobbyHostCodeDisplay   = document.getElementById('lobby-host-code-display');
    const lobbyHostRoomCode      = document.getElementById('lobby-host-room-code');
    const lobbyInputRoomCode     = document.getElementById('lobby-input-room-code');
    const lobbyBtnJoinRoom       = document.getElementById('lobby-btn-join-room');
    const lobbySocketStatus      = document.getElementById('lobby-socket-status');

    // Promotion Modal
    const promotionModal = document.getElementById('promotion-modal');
    const promoQueenBtn  = document.getElementById('promo-q');
    const promoRookBtn   = document.getElementById('promo-r');
    const promoBishopBtn = document.getElementById('promo-b');
    const promoKnightBtn = document.getElementById('promo-n');

    // Game Over Modal
    const gameOverModal    = document.getElementById('game-over-modal');
    const gameOverTitle    = document.getElementById('game-over-title');
    const gameOverSubtitle = document.getElementById('game-over-subtitle');
    const btnRematch       = document.getElementById('btn-rematch');

    // Settings Modal
    const settingsModal   = document.getElementById('settings-modal');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const selectMode      = document.getElementById('select-mode');
    const selectDifficulty = document.getElementById('select-difficulty');
    const selectTimer     = document.getElementById('select-timer');
    const selectTheme     = document.getElementById('select-theme');

    // Online Modal
    const onlineModal       = document.getElementById('online-modal');
    const btnCloseOnline    = document.getElementById('btn-close-online');
    const socketStatusBadge = document.getElementById('socket-status-badge');
    const tabHost           = document.getElementById('tab-host');
    const tabJoin           = document.getElementById('tab-join');
    const panelHost         = document.getElementById('panel-host');
    const panelJoin         = document.getElementById('panel-join');
    const btnCreateRoom     = document.getElementById('btn-create-room');
    const hostCodeDisplay   = document.getElementById('host-code-display');
    const hostRoomCodeEl    = document.getElementById('host-room-code');
    const inputRoomCode     = document.getElementById('input-room-code');
    const btnJoinRoom       = document.getElementById('btn-join-room');

    // Online Setup Screen Elements
    const onlineSetupScreen    = document.getElementById('online-setup-screen');
    const onlineSetupCloseBtn  = document.getElementById('online-setup-close-btn');
    const btnConfirmCreate     = document.getElementById('btn-confirm-create-room');
    const setupHostCodeDisplay = document.getElementById('setup-host-code-display');
    const setupHostRoomCode    = document.getElementById('setup-host-room-code');
    const colorGrid            = document.getElementById('online-color-grid');
    const timeGrid             = document.getElementById('online-time-grid');

    // Online Modal Server Config Elements
    const onlineServerDisplay    = document.getElementById('online-server-display');
    const btnEditServerModal     = document.getElementById('btn-edit-server-modal');
    const serverEditPanelModal   = document.getElementById('server-edit-panel-modal');
    const inputServerUrlModal    = document.getElementById('input-server-url-modal');
    const btnSaveServerModal     = document.getElementById('btn-save-server-modal');
    const btnResetServerModal    = document.getElementById('btn-reset-server-modal');
    const serverBarDot           = document.getElementById('server-bar-dot');

    // Lobby Online Server Config Elements
    const lobbyServerDisplay     = document.getElementById('lobby-server-display');
    const lobbyBtnEditServer     = document.getElementById('lobby-btn-edit-server');
    const lobbyServerPanel       = document.getElementById('lobby-server-panel');
    const lobbyInputServerUrl    = document.getElementById('lobby-input-server-url');
    const lobbyBtnSaveServer     = document.getElementById('lobby-btn-save-server');
    const lobbyBtnResetServer    = document.getElementById('lobby-btn-reset-server');

    // ── App State ────────────────────────────────────────────────
    let gameMode     = 'vs-bot'; // 'vs-bot' | 'pvp' | 'online'
    let playerColor  = 'w';      // 'w' | 'b'
    let selectedSide = 'w';      // chosen in lobby: 'w' | 'b' | 'random'
    let selectedTime = 0;        // chosen in lobby: seconds (0 = unlimited)
    let aiDifficulty = 'orta';
    let timeControl  = 0;
    let whiteTime = 0;
    let blackTime = 0;
    let timerInterval = null;
    let isGameOver = false;
    let pendingPromotionResolve = null;

    // ── GİZLİ AI ─────────────────────────────────────────────────
    let secretAIActive = false;
    let secretAIWorking = false;
    const secretAI = new SecretAI();

    // Piece symbols for captured tray
    const pieceSymbols = {
        P: '♙', N: '♘', B: '♗', R: '♖', Q: '♕',
        p: '♟', n: '♞', b: '♝', r: '♜', q: '♛'
    };

    // ── Initialize Canvas Renderer ───────────────────────────────
    const chessCanvas = new ChessCanvas(
        canvasElement,
        engine,
        (move) => handlePlayerMove(move),
        (move, color, resolve) => showPromotionModal(color, resolve),
        () => !isGameOver && isMyTurn()
    );

    // Gizli AI hint'ini arka planda hesapla ve göster
    function updateSecretHint() {
        if (!secretAIActive || isGameOver || !isMyTurn()) {
            if (chessCanvas.secretHint) {
                chessCanvas.secretHint = null;
                chessCanvas.render();
            }
            return;
        }
        if (secretAIWorking) return;
        secretAIWorking = true;

        setTimeout(() => {
            try {
                if (secretAIActive && !isGameOver && isMyTurn()) {
                    const hint = secretAI.findBestMove(engine);
                    chessCanvas.secretHint = hint ? { from: hint.from, to: hint.to } : null;
                    chessCanvas.render();
                } else {
                    chessCanvas.secretHint = null;
                    chessCanvas.render();
                }
            } catch (e) {
                chessCanvas.secretHint = null;
            } finally {
                secretAIWorking = false;
            }
        }, 30);
    }

    function isMyTurn() {
        if (gameMode === 'vs-bot')   return engine.turn === playerColor;
        if (gameMode === 'online')   return engine.turn === playerColor;
        return true; // pvp: always
    }

    // ── Resize Handler ──────────────────────────────────────────
    function handleResize() {
        // Calculate available width from container
        const rect = boardContainer.getBoundingClientRect();
        const containerWidth = rect.width || (window.innerWidth - 24);

        // Calculate maximum board size based on available vertical space
        // Account for: header (~54px), top HUD (~50px), bottom HUD (~50px),
        //              ribbon (~42px), dock (~72px), gaps (~40px)
        const reservedHeight = 54 + 50 + 50 + 42 + 72 + 40;
        const maxHeightBased = window.innerHeight - reservedHeight;

        const size = Math.min(containerWidth, maxHeightBased, 480);
        const actualBoardSize = Math.max(size, 200);
        chessCanvas.resize(actualBoardSize); // never go below 200px

        // Sync HUD width to match chess board outer bezel exactly (bezel padding 3.5px * 2 = 7px)
        const bezelWidth = actualBoardSize + 7;
        document.documentElement.style.setProperty('--hud-target-width', `${bezelWidth}px`);
        document.documentElement.style.setProperty('--board-actual-size', `${actualBoardSize}px`);
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => setTimeout(handleResize, 300));
    handleResize();

    // ══════════════════════════════════════════════════════════
    //  GAME MOVE LOGIC
    // ══════════════════════════════════════════════════════════

    function handlePlayerMove(move) {
        if (isGameOver) return;
        if (!isMyTurn()) return;
        if (chessCanvas.isBusy) return; // Guard against double-fire

        executePlayerMove(move);

        // Send move to opponent in online mode
        if (gameMode === 'online') {
            socket.sendMove(move);
        }
    }

    // Player moves: animated with isBusy lock
    function executePlayerMove(move) {
        const isCapture = !!engine.board[move.to.r][move.to.c] || move.isEnPassant;

        chessCanvas.lastMove = { from: { ...move.from }, to: { ...move.to } };
        chessCanvas.selectedSquare = null;
        chessCanvas.legalMoves = [];
        chessCanvas.draggingPiece = null;
        chessCanvas.isBusy = true;

        chessCanvas.animateMove(move, () => {
            engine.makeMove(move);

            if (move.isCastle) {
                audio.playCastle();
            } else if (isCapture) {
                audio.playCapture();
            } else {
                audio.playMove();
            }

            const status = engine.getGameStatus();
            if (status.inCheck && !status.isOver) audio.playCheck();

            updateUI();

            if (status.isOver) {
                chessCanvas.isBusy = false;
                endGame(status);
                return;
            }

            startTimerIfNeeded();

            // Trigger AI move if vs-bot and it's bot's turn
            if (gameMode === 'vs-bot' && engine.turn !== playerColor) {
                statusBanner.innerHTML = `<span class="pulse-dot"></span> Bot düşünüyor...`;
                // Keep isBusy=true while bot is thinking
                setTimeout(makeAIMove, 350);
            } else {
                chessCanvas.isBusy = false;
            }
        });
    }

    // Bot/online opponent moves: animated, does NOT require isBusy to be false
    function executeOpponentMove(move) {
        const isCapture = !!engine.board[move.to.r][move.to.c] || move.isEnPassant;

        chessCanvas.lastMove = { from: { ...move.from }, to: { ...move.to } };
        chessCanvas.selectedSquare = null;
        chessCanvas.legalMoves = [];
        chessCanvas.draggingPiece = null;
        chessCanvas.isBusy = true;

        // Animate the bot's move
        chessCanvas.animateMove(move, () => {
            engine.makeMove(move);

            if (move.isCastle) {
                audio.playCastle();
            } else if (isCapture) {
                audio.playCapture();
            } else {
                audio.playMove();
            }

            const status = engine.getGameStatus();
            if (status.inCheck && !status.isOver) audio.playCheck();

            updateUI();
            chessCanvas.isBusy = false; // Unlock for player

            if (status.isOver) {
                endGame(status);
                return;
            }

            startTimerIfNeeded();
        });
    }

    // Legacy wrapper used by online socket handler
    function executeGameMove(move, isUserAction = false) {
        if (isUserAction) {
            executePlayerMove(move);
        } else {
            executeOpponentMove(move);
        }
    }

    // ── AI Move ─────────────────────────────────────────────────
    function makeAIMove() {
        if (isGameOver) { chessCanvas.isBusy = false; return; }
        if (engine.turn === playerColor) { chessCanvas.isBusy = false; return; } // Sanity check
        try {
            const moves = engine.getAllLegalMoves();
            if (moves.length === 0) { chessCanvas.isBusy = false; return; }

            let bestMove = ai.findBestMove(engine, aiDifficulty);
            if (!bestMove) bestMove = moves[0];

            // Ensure promotion is set for pawn promotions
            if (!bestMove.promotion) {
                const piece = engine.board[bestMove.from.r][bestMove.from.c];
                const color = engine.getPieceColor(piece);
                const isPawn = piece && piece.toUpperCase() === 'P';
                const isPromoRank = (color === 'w' && bestMove.to.r === 0) || (color === 'b' && bestMove.to.r === 7);
                if (isPawn && isPromoRank) {
                    bestMove = { ...bestMove, promotion: color === 'w' ? 'Q' : 'q' };
                }
            }

            executeOpponentMove(bestMove);
        } catch (err) {
            console.error('AI Error:', err);
            chessCanvas.isBusy = false;
            // Try a random move as fallback
            try {
                const fallbackMoves = engine.getAllLegalMoves();
                if (fallbackMoves.length > 0) executeOpponentMove(fallbackMoves[0]);
            } catch (e2) {
                console.error('Fallback move also failed:', e2);
            }
        }
    }

    // ══════════════════════════════════════════════════════════
    //  UI UPDATES
    // ══════════════════════════════════════════════════════════

    function updateUI() {
        const turnColor = engine.turn;
        const status    = engine.getGameStatus();

        // Status Banner
        if (status.isOver) {
            statusBanner.innerHTML = `<span class="check-alert">${status.message}</span>`;
        } else if (status.inCheck) {
            statusBanner.innerHTML = `<span class="check-alert">⚠️ ŞAH! (${turnColor === 'w' ? 'Beyaz' : 'Siyah'})</span>`;
        } else {
            const waiting = gameMode === 'online' && engine.turn !== playerColor;
            statusBanner.innerHTML = `<span class="status-pulse-dot"></span> ${waiting ? '⏳ Rakip düşünüyor...' : `Sıra: ${turnColor === 'w' ? 'Beyaz' : 'Siyah'}`}`;
        }

        // Active turn glow
        if (chessCanvas.flipped) {
            topPlayerBadge.classList.toggle('active-turn', turnColor === 'w');
            bottomPlayerBadge.classList.toggle('active-turn', turnColor === 'b');
        } else {
            topPlayerBadge.classList.toggle('active-turn', turnColor === 'b');
            bottomPlayerBadge.classList.toggle('active-turn', turnColor === 'w');
        }

        // Captured pieces & material diff
        const captures    = engine.getCapturedPieces();
        const topPieces    = chessCanvas.flipped ? captures.byBlack : captures.byWhite;
        const bottomPieces = chessCanvas.flipped ? captures.byWhite : captures.byBlack;

        topCapturedTray.innerHTML    = topPieces.map(p => `<span class="captured-symbol">${pieceSymbols[p]}</span>`).join('');
        bottomCapturedTray.innerHTML = bottomPieces.map(p => `<span class="captured-symbol">${pieceSymbols[p]}</span>`).join('');

        const diff = captures.materialDiff;
        if (topMaterialDiff && bottomMaterialDiff) {
            if (chessCanvas.flipped) {
                topMaterialDiff.textContent    = diff > 0 ? `+${diff}` : '';
                bottomMaterialDiff.textContent = diff < 0 ? `+${Math.abs(diff)}` : '';
            } else {
                topMaterialDiff.textContent    = diff < 0 ? `+${Math.abs(diff)}` : '';
                bottomMaterialDiff.textContent = diff > 0 ? `+${diff}` : '';
            }
        }

        renderMoveHistory();
        chessCanvas.render();
        // Gizli AI aktifse yeni hamleri analiz et
        updateSecretHint();
    }

    function renderMoveHistory() {
        moveHistoryList.innerHTML = '';
        const history = engine.history;
        for (let i = 0; i < history.length; i += 2) {
            const moveNum   = Math.floor(i / 2) + 1;
            const whiteMove = history[i]     ? history[i].san     : '';
            const blackMove = history[i + 1] ? history[i + 1].san : '';
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `<span class="history-num">${moveNum}.</span> <span class="history-san">${whiteMove}</span> ${blackMove ? `<span class="history-san">${blackMove}</span>` : ''}`;
            moveHistoryList.appendChild(item);
        }
        moveHistoryList.scrollLeft = moveHistoryList.scrollWidth;
    }

    // ══════════════════════════════════════════════════════════
    //  TIMER
    // ══════════════════════════════════════════════════════════

    function startTimerIfNeeded() {
        if (timeControl === 0 || timerInterval || isGameOver) return;
        timerInterval = setInterval(() => {
            if (isGameOver) { clearInterval(timerInterval); return; }
            if (engine.turn === 'w') {
                whiteTime--;
                if (whiteTime <= 0) { whiteTime = 0; handleTimeOut('w'); }
            } else {
                blackTime--;
                if (blackTime <= 0) { blackTime = 0; handleTimeOut('b'); }
            }
            updateTimerDisplays();
        }, 1000);
    }

    function handleTimeOut(color) {
        clearInterval(timerInterval);
        isGameOver = true;
        const winner = color === 'w' ? 'b' : 'w';
        endGame({
            isOver: true, winner, reason: 'timeout',
            message: color === 'w' ? 'Süre Bitti! Siyah Kazandı.' : 'Süre Bitti! Beyaz Kazandı.'
        });
    }

    function formatTime(seconds) {
        if (timeControl === 0) return '∞';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    function updateTimerDisplays() {
        if (chessCanvas.flipped) {
            topPlayerTimer.textContent    = formatTime(whiteTime);
            bottomPlayerTimer.textContent = formatTime(blackTime);
        } else {
            topPlayerTimer.textContent    = formatTime(blackTime);
            bottomPlayerTimer.textContent = formatTime(whiteTime);
        }
    }

    // ══════════════════════════════════════════════════════════
    //  PROMOTION MODAL
    // ══════════════════════════════════════════════════════════

    function showPromotionModal(color, resolveCallback) {
        pendingPromotionResolve = resolveCallback;
        promoQueenBtn.innerHTML  = color === 'w' ? '♕' : '♛';
        promoRookBtn.innerHTML   = color === 'w' ? '♖' : '♜';
        promoBishopBtn.innerHTML = color === 'w' ? '♗' : '♝';
        promoKnightBtn.innerHTML = color === 'w' ? '♘' : '♞';
        promotionModal.classList.remove('hidden');
    }

    function selectPromotionPiece(type) {
        promotionModal.classList.add('hidden');
        if (pendingPromotionResolve) {
            const pieceCode = engine.turn === 'w' ? type.toUpperCase() : type.toLowerCase();
            pendingPromotionResolve(pieceCode);
            pendingPromotionResolve = null;
        }
    }

    promoQueenBtn.addEventListener('click',  () => selectPromotionPiece('q'));
    promoRookBtn.addEventListener('click',   () => selectPromotionPiece('r'));
    promoBishopBtn.addEventListener('click', () => selectPromotionPiece('b'));
    promoKnightBtn.addEventListener('click', () => selectPromotionPiece('n'));

    // ══════════════════════════════════════════════════════════
    //  GAME OVER
    // ══════════════════════════════════════════════════════════

    function endGame(status) {
        isGameOver = true;
        clearInterval(timerInterval);
        timerInterval = null;

        let title = 'Oyun Bitti';
        if (gameMode === 'online') {
            if (status.winner) {
                title = status.winner === playerColor ? '🏆 Kazandınız!' : '💀 Kaybettiniz!';
            } else {
                title = '🤝 Beraberlik!';
            }
        } else {
            title = status.winner
                ? (status.winner === playerColor ? 'Tebrikler, Kazandınız!' : 'Şah-Mat!')
                : 'Oyun Bitti';
        }

        gameOverTitle.textContent    = title;
        gameOverSubtitle.textContent = status.message;

        if (status.winner) {
            status.winner === playerColor ? audio.playVictory() : audio.playDefeat();
        } else {
            audio.playDefeat();
        }

        // In online mode, hide rematch button if disconnected
        if (gameMode === 'online') {
            btnRematch.textContent = '🔄 Rövanş İste';
        }

        setTimeout(() => gameOverModal.classList.remove('hidden'), 500);
    }

    // ══════════════════════════════════════════════════════════
    //  NEW GAME / RESET
    // ══════════════════════════════════════════════════════════

    function startNewGame() {
        clearInterval(timerInterval);
        timerInterval = null;
        isGameOver    = false;
        chessCanvas.isBusy = false;

        engine.reset();
        chessCanvas.lastMove      = null;
        chessCanvas.selectedSquare = null;
        chessCanvas.legalMoves    = [];

        whiteTime = timeControl;
        blackTime = timeControl;
        updateTimerDisplays();

        const headerModeBadge = document.getElementById('header-mode-badge');

        const nick = userNickname || 'Siz';
        if (gameMode === 'vs-bot') {
            const diffText = diffNames[aiDifficulty] || (selectDifficulty ? selectDifficulty.options[selectDifficulty.selectedIndex].text : 'Bot');
            if (playerColor === 'w') {
                topPlayerName.textContent    = `🤖 ${diffText}`;
                bottomPlayerName.textContent = nick;
                document.querySelector('#top-player-panel .hud-avatar').textContent    = '🤖';
                document.querySelector('#bottom-player-panel .hud-avatar').textContent = '👤';
            } else {
                topPlayerName.textContent    = nick;
                bottomPlayerName.textContent = `🤖 ${diffText}`;
                document.querySelector('#top-player-panel .hud-avatar').textContent    = '👤';
                document.querySelector('#bottom-player-panel .hud-avatar').textContent = '🤖';
            }
            if (headerModeBadge) headerModeBadge.textContent = `⚔️ ${diffText.toUpperCase()}`;
        } else if (gameMode === 'online') {
            // Names already set when game_start received — don't overwrite
        } else {
            topPlayerName.textContent    = '2. Oyuncu';
            bottomPlayerName.textContent = nick;
            if (headerModeBadge) headerModeBadge.textContent = '👥 2 OYUNCU (CİHAZ)';
        }

        gameOverModal.classList.add('hidden');
        settingsModal.classList.add('hidden');
        updateUI();
        if (typeof updateHUDFrame === 'function') updateHUDFrame();
        if (typeof updateHUDProfile === 'function') updateHUDProfile();

        if (gameMode === 'vs-bot' && playerColor === 'b') {
            chessCanvas.flipped = true;
            statusBanner.innerHTML = `<span class="pulse-dot"></span> Bot düşünüyor...`;
            setTimeout(makeAIMove, 400);
        } else if (gameMode === 'online') {
            chessCanvas.flipped = (playerColor === 'b');
        } else {
            chessCanvas.flipped = false;
        }

        chessCanvas.render();
    }

    // ══════════════════════════════════════════════════════════
    //  ONLINE MULTIPLAYER
    // ══════════════════════════════════════════════════════════

    function setSocketStatus(state) {
        // state: 'offline' | 'connecting' | 'online'
        socketStatusBadge.className = `socket-badge ${state}`;
        if (state === 'offline') {
            socketStatusBadge.textContent = 'Bağlantı Yok';
            btnOnline.classList.remove('connected');
            if (serverBarDot) { serverBarDot.style.background = '#ff3b30'; serverBarDot.style.boxShadow = '0 0 8px rgba(255, 59, 48, 0.6)'; }
        }
        if (state === 'connecting') {
            socketStatusBadge.textContent = 'Bağlanıyor...';
            if (serverBarDot) { serverBarDot.style.background = '#ffcc00'; serverBarDot.style.boxShadow = '0 0 8px rgba(255, 204, 0, 0.6)'; }
        }
        if (state === 'online') {
            socketStatusBadge.textContent = '● Çevrimiçi';
            btnOnline.classList.add('connected');
            if (serverBarDot) { serverBarDot.style.background = '#34c759'; serverBarDot.style.boxShadow = '0 0 8px rgba(52, 199, 89, 0.6)'; }
        }
    }

    function resetOnlineButtons() {
        if (btnCreateRoom) {
            btnCreateRoom.disabled = false;
            btnCreateRoom.textContent = '⚡ 4 Haneli Oda Kodu Oluştur';
        }
        if (lobbyBtnCreateRoom) {
            lobbyBtnCreateRoom.disabled = false;
            lobbyBtnCreateRoom.textContent = '⚡ Oda Oluştur';
        }
        if (btnConfirmCreate) {
            btnConfirmCreate.disabled = false;
            btnConfirmCreate.textContent = '⚡ Oda Oluştur';
        }
        if (btnJoinRoom) {
            btnJoinRoom.disabled = false;
            btnJoinRoom.textContent = 'Odaya Katıl';
        }
        if (lobbyBtnJoinRoom) {
            lobbyBtnJoinRoom.disabled = false;
            lobbyBtnJoinRoom.textContent = 'Odaya Katıl';
        }
    }

    function updateServerDisplay() {
        const url = socket.getServerUrl();
        const isCustom = !!localStorage.getItem('chess_socket_server');
        const label = isCustom ? url : (window.location && window.location.host ? window.location.host : 'Otomatik');
        if (onlineServerDisplay) onlineServerDisplay.textContent = label;
        if (lobbyServerDisplay)  lobbyServerDisplay.textContent  = label;
        if (inputServerUrlModal) inputServerUrlModal.value = url;
        if (lobbyInputServerUrl) lobbyInputServerUrl.value = url;
    }

    function showAlert(msg) {
        statusBanner.innerHTML = `<span class="check-alert">⚠️ ${msg}</span>`;
    }

    // Socket event handlers
    socket.onConnect = () => {
        setSocketStatus('online');
    };

    socket.onDisconnect = () => {
        setSocketStatus('offline');
        resetOnlineButtons();
        if (lobbySocketStatus) lobbySocketStatus.textContent = '⚫ Bağlantı Kesildi';
        if (gameMode === 'online' && !isGameOver) {
            showAlert('Sunucu bağlantısı kesildi!');
        }
    };

    socket.onError = (msg) => {
        setSocketStatus('offline');
        resetOnlineButtons();
        if (lobbySocketStatus) lobbySocketStatus.textContent = '🔴 ' + (msg || 'Bağlantı Hatası');
        showAlert(msg);
    };

    socket.onRoomCreated = (roomCode) => {
        setSocketStatus('online');
        if (hostRoomCodeEl) hostRoomCodeEl.textContent = roomCode;
        if (hostCodeDisplay) hostCodeDisplay.classList.remove('hidden');
        if (btnCreateRoom) {
            btnCreateRoom.disabled = true;
            btnCreateRoom.textContent = '⏳ Rakip Bekleniyor...';
        }
        if (setupHostRoomCode) setupHostRoomCode.textContent = roomCode;
        if (setupHostCodeDisplay) setupHostCodeDisplay.classList.remove('hidden');
        if (btnConfirmCreate) {
            btnConfirmCreate.disabled = true;
            btnConfirmCreate.textContent = '⏳ Rakip Bekleniyor...';
        }
        if (lobbyHostRoomCode) lobbyHostRoomCode.textContent = roomCode;
        if (lobbyHostCodeDisplay) lobbyHostCodeDisplay.classList.remove('hidden');
        if (lobbyBtnCreateRoom) {
            lobbyBtnCreateRoom.disabled = true;
            lobbyBtnCreateRoom.textContent = '⏳ Rakip Bekleniyor...';
        }
        if (lobbySocketStatus) lobbySocketStatus.textContent = '🟢 Kod Oluşturuldu: ' + roomCode;
    };

    socket.onGameStart = ({ color, roomId, opponentName, opponentFrame: oppFrame, timeControl: serverTimeControl }) => {
        // Game is starting — switch to online mode
        gameMode    = 'online';
        playerColor = color;
        opponentFrame = oppFrame || '';

        if (serverTimeControl !== undefined && serverTimeControl !== null) {
            timeControl = parseInt(serverTimeControl, 10);
            whiteTime   = timeControl;
            blackTime   = timeControl;
            if (selectTimer) selectTimer.value = timeControl;
            updateTimerDisplays();
        }

        const headerModeBadge = document.getElementById('header-mode-badge');
        if (headerModeBadge) headerModeBadge.textContent = '🌐 ONLİNE';

        const myName  = userNickname || 'Siz';
        const oppName = `🌐 ${opponentName}`;

        if (color === 'b') {
            // I play black → board flipped → I am bottom, opponent top
            chessCanvas.flipped = true;
            bottomPlayerName.textContent = myName;
            topPlayerName.textContent    = oppName;
        } else {
            chessCanvas.flipped = false;
            bottomPlayerName.textContent = myName;
            topPlayerName.textContent    = oppName;
        }

        // Update avatars
        document.querySelector('#top-player-panel .hud-avatar').textContent    = '🌐';
        document.querySelector('#bottom-player-panel .hud-avatar').textContent = color === 'w' ? '⬜' : '⬛';

        // Close online modal, setup screen and lobby screen to start game
        onlineModal.classList.add('hidden');
        if (onlineSetupScreen) onlineSetupScreen.classList.add('hidden');
        lobbyScreen.classList.add('hidden');
        engine.reset();
        chessCanvas.lastMove       = null;
        chessCanvas.selectedSquare = null;
        chessCanvas.legalMoves     = [];
        isGameOver = false;
        chessCanvas.isBusy = false;

        gameOverModal.classList.add('hidden');
        requestAnimationFrame(() => handleResize());
        updateUI();
        if (typeof updateHUDFrame === 'function') updateHUDFrame();
        if (typeof updateHUDProfile === 'function') updateHUDProfile();
        setSocketStatus('online');
        audio.playMove();
    };

    socket.onOpponentFrame = (frame) => {
        opponentFrame = frame || '';
        if (typeof updateHUDFrame === 'function') updateHUDFrame();
    };

    socket.onOpponentMove = (move) => {
        if (isGameOver) return;
        // Validate it's not our turn being overridden
        if (engine.turn === playerColor) return;

        chessCanvas.isBusy = false;
        executeGameMove(move, false);
    };

    socket.onOpponentDisconnected = (msg) => {
        showAlert(msg);
        if (!isGameOver) {
            endGame({
                isOver: true,
                winner: playerColor,
                reason: 'disconnect',
                message: 'Rakibin bağlantısı koptu. Kazandınız!'
            });
        }
    };

    socket.onOpponentResigned = () => {
        if (!isGameOver) {
            endGame({
                isOver: true,
                winner: playerColor,
                reason: 'resign',
                message: 'Rakibiniz teslim oldu! Kazandınız!'
            });
        }
    };

    socket.onRematchStart = (newColor) => {
        playerColor = newColor;
        startNewGame();
        gameOverModal.classList.add('hidden');
        if (typeof updateHUDFrame === 'function') updateHUDFrame();
    };

    // ── Online Setup Screen ─────────────────────────────────────
    let onlineSelectedColor = 'random'; // 'random' | 'w' | 'b'
    let onlineSelectedTime  = 0;

    // Color grid selection
    if (colorGrid) {
        colorGrid.querySelectorAll('.online-color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                colorGrid.querySelectorAll('.online-color-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                onlineSelectedColor = btn.dataset.color;
            });
        });
    }

    // Time grid selection
    if (timeGrid) {
        timeGrid.querySelectorAll('.online-time-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                timeGrid.querySelectorAll('.online-time-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                onlineSelectedTime = parseInt(btn.dataset.time, 10);
            });
        });
    }

    // Open setup screen
    function openOnlineSetup() {
        onlineModal.classList.add('hidden');
        if (setupHostCodeDisplay) setupHostCodeDisplay.classList.add('hidden');
        if (setupHostRoomCode)   setupHostRoomCode.textContent = '----';
        if (btnConfirmCreate) {
            btnConfirmCreate.disabled = false;
            btnConfirmCreate.textContent = '⚡ Oda Oluştur';
        }
        // Reset selections to defaults
        onlineSelectedColor = 'random';
        onlineSelectedTime  = 0;
        if (colorGrid) {
            colorGrid.querySelectorAll('.online-color-btn').forEach(b => b.classList.remove('active'));
            const randomBtn = colorGrid.querySelector('[data-color="random"]');
            if (randomBtn) randomBtn.classList.add('active');
        }
        if (timeGrid) {
            timeGrid.querySelectorAll('.online-time-btn').forEach(b => b.classList.remove('active'));
            const infBtn = timeGrid.querySelector('[data-time="0"]');
            if (infBtn) infBtn.classList.add('active');
        }
        if (onlineSetupScreen) onlineSetupScreen.classList.remove('hidden');
    }

    // Close setup screen → back to previous view
    if (onlineSetupCloseBtn) {
        onlineSetupCloseBtn.addEventListener('click', () => {
            if (onlineSetupScreen) onlineSetupScreen.classList.add('hidden');
            if (lobbyScreen && !lobbyScreen.classList.contains('hidden')) {
                // Return to lobby view smoothly
            } else {
                onlineModal.classList.remove('hidden');
            }
            resetOnlineButtons();
            socket.disconnect();
        });
    }

    if (onlineSetupScreen) {
        onlineSetupScreen.addEventListener('click', (e) => {
            if (e.target === onlineSetupScreen) {
                onlineSetupScreen.classList.add('hidden');
                if (lobbyScreen && !lobbyScreen.classList.contains('hidden')) {
                    // Return to lobby view smoothly
                } else {
                    onlineModal.classList.remove('hidden');
                }
                resetOnlineButtons();
                socket.disconnect();
            }
        });
    }

    // Click to copy code
    function setupCodeCopy(element) {
        if (!element) return;
        element.style.cursor = 'pointer';
        element.title = 'Kopyalamak için tıkla';
        element.addEventListener('click', () => {
            const code = element.textContent.trim();
            if (code && code !== '----') {
                navigator.clipboard.writeText(code).then(() => {
                    showAlert(`Oda kodu kopyalandı: ${code}`);
                }).catch(() => {
                    showAlert(`Oda Kodu: ${code}`);
                });
            }
        });
    }
    setupCodeCopy(hostRoomCodeEl);
    setupCodeCopy(setupHostRoomCode);
    setupCodeCopy(lobbyHostRoomCode);

    // ── Online Modal UI Handlers ────────────────────────────────

    btnOnline.addEventListener('click', () => {
        onlineModal.classList.remove('hidden');
        // Reset state
        resetOnlineButtons();
        hostCodeDisplay.classList.add('hidden');
        hostRoomCodeEl.textContent = '----';
        inputRoomCode.value = '';
    });

    btnCloseOnline.addEventListener('click', () => {
        onlineModal.classList.add('hidden');
    });

    // Tabs
    tabHost.addEventListener('click', () => {
        tabHost.classList.add('active');
        tabJoin.classList.remove('active');
        panelHost.classList.remove('hidden');
        panelJoin.classList.add('hidden');
    });

    tabJoin.addEventListener('click', () => {
        tabJoin.classList.add('active');
        tabHost.classList.remove('active');
        panelJoin.classList.remove('hidden');
        panelHost.classList.add('hidden');
    });

    // Create Room button → open setup screen
    btnCreateRoom.addEventListener('click', () => {
        openOnlineSetup();
    });

    // Confirm Create Room
    if (btnConfirmCreate) {
        btnConfirmCreate.addEventListener('click', () => {
            // Resolve color: random = coin flip
            let chosenColor = onlineSelectedColor;
            if (chosenColor === 'random') {
                chosenColor = Math.random() < 0.5 ? 'w' : 'b';
            }

            setSocketStatus('connecting');
            btnConfirmCreate.disabled = true;
            btnConfirmCreate.textContent = '⏳ Oluşturuluyor...';

            // Apply chosen time control
            timeControl = onlineSelectedTime;
            whiteTime   = timeControl;
            blackTime   = timeControl;
            if (selectTimer) selectTimer.value = timeControl;
            updateTimerDisplays();

            socket.createRoom({
                timeControl:  onlineSelectedTime,
                playerName:   userNickname || 'Oyuncu 1',
                hostColor:    chosenColor,
                frame:        selectedFrame || localStorage.getItem('chess_pro_frame') || ''
            });
        });
    }

    // Join Room
    btnJoinRoom.addEventListener('click', () => {
        const code = inputRoomCode.value.trim();
        if (!code || code.length < 4) {
            showAlert('Geçerli bir oda kodu girin (4 hane)!');
            return;
        }
        setSocketStatus('connecting');
        btnJoinRoom.disabled = true;
        btnJoinRoom.textContent = '⏳ Katılıyor...';

        socket.joinRoom(code, userNickname || 'Oyuncu 2', {
            frame: selectedFrame || localStorage.getItem('chess_pro_frame') || ''
        });

        // Re-enable if no game_start in 16 seconds (PeerJS timeout = 15s)
        setTimeout(() => {
            if (gameMode !== 'online') {
                resetOnlineButtons();
                setSocketStatus('offline');
                showAlert('Oda bulunamadı veya zaman aşımı. Kodu kontrol edin.');
                socket.disconnect();
            }
        }, 16000);
    });

    // Allow pressing Enter to join
    inputRoomCode.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btnJoinRoom.click();
    });

    // ══════════════════════════════════════════════════════════
    //  THEME APPLICATION (UI & CANVAS & CSS)
    // ══════════════════════════════════════════════════════════

    let currentTheme = 'crimson';
    try {
        currentTheme = localStorage.getItem('chess_pro_theme') || 'crimson';
    } catch (e) {}

    function applyTheme(themeName) {
        if (!themeName) return;
        currentTheme = themeName;
        try {
            localStorage.setItem('chess_pro_theme', themeName);
        } catch (e) {}

        if (chessCanvas && typeof chessCanvas.setTheme === 'function') {
            chessCanvas.setTheme(themeName);
        }
        document.documentElement.setAttribute('data-theme', themeName);
        document.body.setAttribute('data-theme', themeName);
        if (lobbyScreen) lobbyScreen.setAttribute('data-theme', themeName);

        if (selectTheme) selectTheme.value = themeName;

        // Sync old-style theme pills (if any)
        themePills.forEach(pill => {
            pill.classList.toggle('theme-pill-active', pill.dataset.theme === themeName);
        });

        // Sync rich lobby theme cards
        lobbyThemeCards.forEach(card => {
            const isActive = card.dataset.theme === themeName;
            card.classList.toggle('lobby-theme-card-active', isActive);
            const checkEl = card.querySelector('.lobby-theme-check');
            if (checkEl) checkEl.classList.toggle('hidden', !isActive);
        });

        // Sync accordion theme trigger value with theme's King piece SVG and name
        const themeLabels = {
            crimson: 'Kırmızı',
            wood: 'Ahşap',
            newspaper: 'Gazete',
            steel: 'Çelik',
            retro: 'Retro',
            cyber: 'Cyber'
        };
        const accThemeVal = document.getElementById('acc-theme-value');
        if (accThemeVal && themeLabels[themeName]) {
            let kingSvg = '';
            if (chessCanvas && typeof chessCanvas.getThemeSvgPieces === 'function') {
                const pieces = chessCanvas.getThemeSvgPieces(themeName);
                if (pieces && pieces['K']) {
                    kingSvg = pieces['K'];
                }
            }
            accThemeVal.innerHTML = `<span class="acc-theme-king-icon">${kingSvg}</span> - ${themeLabels[themeName]}`;
        }
    }

    // ══════════════════════════════════════════════════════════
    //  LOBBY LOGIC & ACCORDION
    // ══════════════════════════════════════════════════════════

    const diffNames = {
        'kolay': 'eA1 Small',
        'orta': 'RR ‑ 1 Thinking',
        'usta': 'α1Q GoD'
    };

    function updateAccModeValue() {
        const accModeValue = document.getElementById('acc-mode-value');
        if (!accModeValue) return;
        if (gameMode === 'vs-bot') {
            accModeValue.textContent = `🤖 ${diffNames[aiDifficulty] || 'Yapay Zeka'}`;
        } else if (gameMode === 'pvp') {
            accModeValue.textContent = '👥 2 Kişilik';
        } else if (gameMode === 'online') {
            accModeValue.textContent = '🌐 Online';
        }
    }

    // ── Accordion Logic ──────────────────────────────────
    const accItems = document.querySelectorAll('.acc-item');

    function syncAccSlotHeights(activeItem) {
        accItems.forEach(i => {
            const slot = i.closest('.acc-slot');
            if (!slot) return;
            if (activeItem && i === activeItem && i.classList.contains('acc-open')) {
                const trigger = i.querySelector('.acc-trigger');
                const inner = i.querySelector('.acc-panel-inner');
                const triggerH = trigger ? trigger.offsetHeight : 56;
                const innerH = inner ? inner.scrollHeight : 0;
                const totalH = triggerH + innerH + 2;
                slot.style.height = totalH + 'px';
            } else if (!activeItem || i !== activeItem) {
                slot.style.height = '';
            }
        });
    }

    function toggleAcc(itemId) {
        const item = document.getElementById(itemId);
        if (!item) return;
        const isOpen = item.classList.contains('acc-open');
        const lobbyMid = document.querySelector('.lobby-middle-content');

        // Close all
        accItems.forEach(i => {
            i.classList.remove('acc-open');
            const slot = i.closest('.acc-slot');
            if (slot) {
                slot.classList.remove('has-open', 'acc-slot-hidden');
                slot.style.height = '';
            }
            const trigger = i.querySelector('.acc-trigger');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
        });

        if (isOpen) {
            if (lobbyMid) {
                lobbyMid.classList.remove('has-open-accordion', 'has-open-time');
            }
        } else {
            // Open clicked
            item.classList.add('acc-open');
            const slot = item.closest('.acc-slot');
            if (slot) slot.classList.add('has-open');
            const trigger = item.querySelector('.acc-trigger');
            if (trigger) trigger.setAttribute('aria-expanded', 'true');

            if (lobbyMid) {
                lobbyMid.classList.add('has-open-accordion');
                if (itemId === 'acc-time') {
                    lobbyMid.classList.add('has-open-time');
                } else {
                    lobbyMid.classList.remove('has-open-time');
                }
            }

            // Hide the other buttons/slots
            accItems.forEach(i => {
                if (i !== item) {
                    const otherSlot = i.closest('.acc-slot');
                    if (otherSlot) {
                        otherSlot.classList.add('acc-slot-hidden');
                    }
                }
            });

            requestAnimationFrame(() => {
                syncAccSlotHeights(item);
            });
        }
    }
    const accModeTrigger = document.getElementById('acc-mode-trigger');
    const accThemeTrigger = document.getElementById('acc-theme-trigger');
    const accTimeTrigger = document.getElementById('acc-time-trigger');
    if (accModeTrigger) accModeTrigger.addEventListener('click', (e) => { e.stopPropagation(); toggleAcc('acc-mode'); });
    if (accThemeTrigger) accThemeTrigger.addEventListener('click', (e) => { e.stopPropagation(); toggleAcc('acc-theme'); });
    if (accTimeTrigger) accTimeTrigger.addEventListener('click', (e) => { e.stopPropagation(); toggleAcc('acc-time'); });

    // Close accordion when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.acc-item')) {
            const lobbyMid = document.querySelector('.lobby-middle-content');
            if (lobbyMid) {
                lobbyMid.classList.remove('has-open-accordion', 'has-open-time');
            }
            accItems.forEach(i => {
                i.classList.remove('acc-open');
                const slot = i.closest('.acc-slot');
                if (slot) {
                    slot.classList.remove('has-open', 'acc-slot-hidden');
                    slot.style.height = '';
                }
                const trigger = i.querySelector('.acc-trigger');
                if (trigger) trigger.setAttribute('aria-expanded', 'false');
            });
        }
    });

    window.addEventListener('resize', () => {
        const openItem = document.querySelector('.acc-item.acc-open');
        if (openItem) syncAccSlotHeights(openItem);
    });

    function setLobbyMode(mode) {
        gameMode = mode;
        if (selectMode) selectMode.value = mode;

        // Mode button active states
        [lobbyModeBot, lobbyModePvp, lobbyModeOnline].forEach(btn => {
            if (btn) btn.classList.remove('lobby-mode-active', 'lobby-card-active', 'acc-opt-active');
        });
        const activeBtn = { 'vs-bot': lobbyModeBot, 'pvp': lobbyModePvp, 'online': lobbyModeOnline }[mode];
        if (activeBtn) {
            activeBtn.classList.add('lobby-mode-active', 'acc-opt-active');
        }

        updateAccModeValue();

        // Check marks
        if (checkBot)    checkBot.classList.toggle('hidden', mode !== 'vs-bot');
        if (checkPvp)    checkPvp.classList.toggle('hidden', mode !== 'pvp');
        if (checkOnline) checkOnline.classList.toggle('hidden', mode !== 'online');

        // Sub-sections
        if (mode === 'vs-bot') {
            if (lobbyDifficultySection) lobbyDifficultySection.classList.remove('hidden');
            if (lobbyOnlineSection)     lobbyOnlineSection.classList.add('hidden');
        } else if (mode === 'pvp') {
            if (lobbyDifficultySection) lobbyDifficultySection.classList.add('hidden');
            if (lobbyOnlineSection)     lobbyOnlineSection.classList.add('hidden');
        } else if (mode === 'online') {
            if (lobbyDifficultySection) lobbyDifficultySection.classList.add('hidden');
            if (lobbyOnlineSection)     lobbyOnlineSection.classList.remove('hidden');
        }

        const accMode = document.getElementById('acc-mode');
        if (accMode && accMode.classList.contains('acc-open')) {
            requestAnimationFrame(() => {
                syncAccSlotHeights(accMode);
            });
        }
    }

    if (lobbyModeBot) lobbyModeBot.addEventListener('click', () => setLobbyMode('vs-bot'));
    if (lobbyModePvp) lobbyModePvp.addEventListener('click', () => setLobbyMode('pvp'));
    if (lobbyModeOnline) lobbyModeOnline.addEventListener('click', () => setLobbyMode('online'));

    // Difficulty Pills
    diffPills.forEach(pill => {
        pill.addEventListener('click', () => {
            diffPills.forEach(p => p.classList.remove('diff-pill-active'));
            pill.classList.add('diff-pill-active');
            aiDifficulty = pill.dataset.diff;
            if (selectDifficulty) selectDifficulty.value = aiDifficulty;
            updateAccModeValue();
        });
    });

    // Side Selection Pills
    sidePills.forEach(pill => {
        pill.addEventListener('click', () => {
            sidePills.forEach(p => p.classList.remove('side-pill-active'));
            pill.classList.add('side-pill-active');
            selectedSide = pill.dataset.side;
        });
    });

    // Time Control Pills
    const timeLabels = {
        '0': '⏳ Sınırsız',
        '180': '⚡ 3 Dk',
        '300': '⏱️ 5 Dk',
        '600': '🏆 10 Dk'
    };
    timePills.forEach(pill => {
        pill.addEventListener('click', () => {
            timePills.forEach(p => p.classList.remove('time-pill-active'));
            pill.classList.add('time-pill-active');
            selectedTime = parseInt(pill.dataset.time, 10);
            const accTimeValue = document.getElementById('acc-time-value');
            if (accTimeValue) {
                accTimeValue.textContent = timeLabels[pill.dataset.time] || (pill.dataset.time + ' s');
            }
        });
    });

    // Lobby Theme Cards
    lobbyThemeCards.forEach(card => {
        card.addEventListener('click', () => {
            applyTheme(card.dataset.theme);
        });
    });

    // Legacy theme pills (in case they're also present)
    themePills.forEach(pill => {
        pill.addEventListener('click', () => {
            applyTheme(pill.dataset.theme);
        });
    });

    // Lobby Online Tabs
    if (lobbyTabHost && lobbyTabJoin) {
        lobbyTabHost.addEventListener('click', () => {
            lobbyTabHost.classList.add('active');
            lobbyTabJoin.classList.remove('active');
            lobbyPanelHost.classList.remove('hidden');
            lobbyPanelJoin.classList.add('hidden');
            const accMode = document.getElementById('acc-mode');
            if (accMode && accMode.classList.contains('acc-open')) {
                requestAnimationFrame(() => syncAccSlotHeights(accMode));
            }
        });
        lobbyTabJoin.addEventListener('click', () => {
            lobbyTabJoin.classList.add('active');
            lobbyTabHost.classList.remove('active');
            lobbyPanelJoin.classList.remove('hidden');
            lobbyPanelHost.classList.add('hidden');
            const accMode = document.getElementById('acc-mode');
            if (accMode && accMode.classList.contains('acc-open')) {
                requestAnimationFrame(() => syncAccSlotHeights(accMode));
            }
        });
    }

    // Lobby Create Room
    if (lobbyBtnCreateRoom) {
        lobbyBtnCreateRoom.addEventListener('click', () => {
            openOnlineSetup();
        });
    }

    // Lobby Join Room
    if (lobbyBtnJoinRoom && lobbyInputRoomCode) {
        lobbyBtnJoinRoom.addEventListener('click', () => {
            const code = lobbyInputRoomCode.value.trim();
            if (!code || code.length < 4) {
                showAlert('Geçerli bir oda kodu girin (4 hane)!');
                return;
            }
            setSocketStatus('connecting');
            if (lobbySocketStatus) lobbySocketStatus.textContent = '🟡 Odaya bağlanılıyor...';
            lobbyBtnJoinRoom.disabled = true;
            lobbyBtnJoinRoom.textContent = '⏳ Katılıyor...';
            socket.joinRoom(code, userNickname || 'Oyuncu 2', {
                frame: selectedFrame || localStorage.getItem('chess_pro_frame') || ''
            });
            setTimeout(() => {
                if (gameMode !== 'online') {
                    resetOnlineButtons();
                    if (lobbySocketStatus) lobbySocketStatus.textContent = '🔴 Oda bulunamadı';
                    showAlert('Oda bulunamadı veya zaman aşımı. Kodu kontrol edin.');
                }
            }, 16000);
        });

        lobbyInputRoomCode.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') lobbyBtnJoinRoom.click();
        });
    }

    // Lobby Server Config Handlers
    if (lobbyBtnEditServer && lobbyServerPanel) {
        lobbyBtnEditServer.addEventListener('click', () => {
            lobbyServerPanel.classList.toggle('hidden');
            const accMode = document.getElementById('acc-mode');
            if (accMode && accMode.classList.contains('acc-open')) {
                requestAnimationFrame(() => syncAccSlotHeights(accMode));
            }
        });
    }
    if (lobbyBtnSaveServer && lobbyInputServerUrl) {
        lobbyBtnSaveServer.addEventListener('click', () => {
            const url = lobbyInputServerUrl.value.trim();
            socket.setServerUrl(url);
            updateServerDisplay();
            lobbyServerPanel.classList.add('hidden');
            showAlert('Sunucu adresi güncellendi.');
            const accMode = document.getElementById('acc-mode');
            if (accMode && accMode.classList.contains('acc-open')) {
                requestAnimationFrame(() => syncAccSlotHeights(accMode));
            }
        });
    }
    if (lobbyBtnResetServer) {
        lobbyBtnResetServer.addEventListener('click', () => {
            socket.setServerUrl('');
            updateServerDisplay();
            lobbyServerPanel.classList.add('hidden');
            showAlert('Sunucu otomatik moda alındı.');
            const accMode = document.getElementById('acc-mode');
            if (accMode && accMode.classList.contains('acc-open')) {
                requestAnimationFrame(() => syncAccSlotHeights(accMode));
            }
        });
    }

    // Initialize server display on startup
    updateServerDisplay();

    // ── iPhone Style Nickname Controller ──────────────────────
    if (lobbyNicknameInput) {
        if (userNickname) {
            lobbyNicknameInput.value = userNickname;
            if (lobbyNicknameClear) lobbyNicknameClear.classList.remove('hidden');
        }

        lobbyNicknameInput.addEventListener('input', () => {
            if (lobbyNicknameInput.value.length > 10) {
                lobbyNicknameInput.value = lobbyNicknameInput.value.slice(0, 10);
            }
            const hasText = lobbyNicknameInput.value.length > 0;
            if (lobbyNicknameClear) {
                lobbyNicknameClear.classList.toggle('hidden', !hasText);
            }
            const trimmed = lobbyNicknameInput.value.trim();
            if (trimmed.length >= 3 && trimmed.length <= 10) {
                if (lobbyNicknameWrap) lobbyNicknameWrap.classList.remove('ios-error', 'ios-shake');
                userNickname = trimmed;
                try { localStorage.setItem('chess_pro_nickname', userNickname); } catch (e) {}
            }
        });

        lobbyNicknameInput.addEventListener('change', () => {
            const trimmed = lobbyNicknameInput.value.trim();
            if (trimmed.length >= 3 && trimmed.length <= 10) {
                userNickname = trimmed;
                try { localStorage.setItem('chess_pro_nickname', userNickname); } catch (e) {}
            }
        });

        lobbyNicknameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (lobbyStartBtn) lobbyStartBtn.click();
            }
        });

        if (lobbyNicknameClear) {
            lobbyNicknameClear.addEventListener('click', (e) => {
                e.stopPropagation();
                lobbyNicknameInput.value = '';
                userNickname = '';
                try { localStorage.removeItem('chess_pro_nickname'); } catch (e) {}
                lobbyNicknameClear.classList.add('hidden');
                lobbyNicknameInput.focus();
            });
        }
    }

    // Start Game Button in Lobby
    if (lobbyStartBtn) {
        lobbyStartBtn.addEventListener('click', () => {
            // ── Validate Nickname (min 3, max 10 chars) ──
            const nickVal = lobbyNicknameInput ? lobbyNicknameInput.value.trim() : '';
            if (!nickVal || nickVal.length < 3 || nickVal.length > 10) {
                if (lobbyNicknameWrap) {
                    lobbyNicknameWrap.classList.remove('ios-shake');
                    void lobbyNicknameWrap.offsetWidth; // trigger reflow
                    lobbyNicknameWrap.classList.add('ios-shake', 'ios-error');
                    setTimeout(() => {
                        if (lobbyNicknameWrap) lobbyNicknameWrap.classList.remove('ios-shake');
                    }, 500);
                }
                if (lobbyNicknameInput) lobbyNicknameInput.focus();
                if (!nickVal) {
                    showAlert('Lütfen oyuna başlamak için adınızı girin!');
                } else if (nickVal.length < 3) {
                    showAlert('Kullanıcı adı en az 3 karakter olmalıdır!');
                } else {
                    showAlert('Kullanıcı adı en fazla 10 karakter olmalıdır!');
                }
                return;
            }

            userNickname = nickVal;
            localStorage.setItem('chess_pro_nickname', userNickname);

            if (gameMode === 'online') {
                if (!socket.isConnected && !socket.currentRoom) {
                    showAlert('Lütfen önce bir oda kurun veya odaya katılın!');
                    return;
                }
            }

            // ── Apply Time Control ──
            timeControl = selectedTime;
            whiteTime   = timeControl;
            blackTime   = timeControl;
            if (selectTimer) selectTimer.value = timeControl;
            updateTimerDisplays();

            // ── Apply Side Selection (bot mode only) ──
            if (gameMode === 'vs-bot') {
                let chosenSide = selectedSide;
                if (chosenSide === 'random') {
                    chosenSide = Math.random() < 0.5 ? 'w' : 'b';
                }
                playerColor = chosenSide;
                chessCanvas.flipped = (chosenSide === 'b');
            } else {
                playerColor = 'w';
                chessCanvas.flipped = false;
            }

            lobbyScreen.classList.add('hidden');
            // Wait one frame so the lobby overlay fades and board layout settles
            requestAnimationFrame(() => {
                handleResize();
                startNewGame();
            });
        });
    }

    // ══════════════════════════════════════════════════════════
    //  DOCK & MODAL CONTROLS
    // ══════════════════════════════════════════════════════════

    // Exit Button (Çık) - Returns to Lobby
    if (btnExit) {
        btnExit.addEventListener('click', () => {
            clearInterval(timerInterval);
            if (gameMode === 'online' && socket.isConnected) {
                socket.disconnect();
                setSocketStatus('offline');
            }
            lobbyScreen.classList.remove('hidden');
        });
    }

    // Flip Board
    if (btnFlip) {
        btnFlip.addEventListener('click', () => {
            if (gameMode === 'online') return; // no flip in online
            chessCanvas.flipBoard();
            updateUI();
        });
    }

    // New Game / Rematch
    if (btnNewGame) {
        btnNewGame.addEventListener('click', () => {
            if (gameMode === 'online') {
                socket.disconnect();
                setSocketStatus('offline');
                gameMode    = 'vs-bot';
                playerColor = 'w';
                const headerModeBadge = document.getElementById('header-mode-badge');
                if (headerModeBadge) headerModeBadge.textContent = '⚔️ YAPAY ZEKA';
                document.querySelector('#top-player-panel .hud-avatar').textContent    = '🤖';
                document.querySelector('#bottom-player-panel .hud-avatar').textContent = '👤';
            }
            startNewGame();
        });
    }

    if (btnRematch) {
        btnRematch.addEventListener('click', () => {
            if (gameMode === 'online' && socket.isConnected) {
                socket.requestRematch();
                gameOverModal.classList.add('hidden');
                statusBanner.innerHTML = `<span class="pulse-dot"></span> Rövanş bekleniyor...`;
            } else {
                startNewGame();
            }
        });
    }

    // Sound Toggle
    if (btnSound) {
        btnSound.addEventListener('click', () => {
            const enabled = audio.toggle();
            btnSound.textContent = enabled ? '🔊' : '🔇';
            btnSound.classList.toggle('muted', !enabled);
        });
    }

    // ── Custom Liquid Glass Selects (Native Kutucuk Yerine Sitenin Kendi Teması) ──
    const customSelectWraps  = document.querySelectorAll('.custom-select-wrap');
    const btnCloseSettingsX  = document.getElementById('btn-close-settings-x');

    function closeAllCustomSelects() {
        customSelectWraps.forEach(wrap => {
            wrap.classList.remove('open');
            const trigger = wrap.querySelector('.custom-select-trigger');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
        });
    }

    function syncCustomSelects() {
        customSelectWraps.forEach(wrap => {
            const selectId = wrap.dataset.selectId;
            const nativeSelect = document.getElementById(selectId);
            if (!nativeSelect) return;

            const currentVal = nativeSelect.value;
            const items = wrap.querySelectorAll('.custom-select-item');
            let matchedItem = null;

            items.forEach(item => {
                const isMatch = item.dataset.value === String(currentVal);
                item.classList.toggle('is-selected', isMatch);
                if (isMatch) matchedItem = item;
            });

            if (matchedItem) {
                const iconEl = matchedItem.querySelector('.custom-select-icon');
                const textEl = matchedItem.querySelector('.item-text');
                const triggerIcon = wrap.querySelector('.custom-select-icon');
                const triggerText = wrap.querySelector('.custom-select-text');

                if (triggerIcon && iconEl) triggerIcon.textContent = iconEl.textContent;
                if (triggerText && textEl) triggerText.textContent = textEl.textContent;
            }
        });
    }

    customSelectWraps.forEach(wrap => {
        const trigger = wrap.querySelector('.custom-select-trigger');
        const selectId = wrap.dataset.selectId;
        const nativeSelect = document.getElementById(selectId);
        const items = wrap.querySelectorAll('.custom-select-item');

        if (trigger) {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = wrap.classList.contains('open');
                closeAllCustomSelects();
                if (!isOpen) {
                    wrap.classList.add('open');
                    trigger.setAttribute('aria-expanded', 'true');
                }
            });
        }

        items.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const val = item.dataset.value;
                if (nativeSelect) {
                    nativeSelect.value = val;
                    nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
                }
                syncCustomSelects();
                closeAllCustomSelects();
            });
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-select-wrap')) {
            closeAllCustomSelects();
        }
    });

    // Settings Modal
    if (btnSettings) {
        btnSettings.addEventListener('click', () => {
            syncCustomSelects();
            settingsModal.classList.remove('hidden');
        });
    }

    if (btnCloseSettings) {
        btnCloseSettings.addEventListener('click', () => {
            closeAllCustomSelects();
            settingsModal.classList.add('hidden');
        });
    }

    if (btnCloseSettingsX) {
        btnCloseSettingsX.addEventListener('click', () => {
            closeAllCustomSelects();
            settingsModal.classList.add('hidden');
        });
    }

    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                closeAllCustomSelects();
                settingsModal.classList.add('hidden');
            }
        });
    }

    // Settings changes
    if (selectTheme) {
        selectTheme.addEventListener('change', (e) => {
            applyTheme(e.target.value);
            syncCustomSelects();
        });
    }

    if (selectDifficulty) {
        selectDifficulty.addEventListener('change', (e) => {
            aiDifficulty = e.target.value;
            diffPills.forEach(p => p.classList.toggle('diff-pill-active', p.dataset.diff === aiDifficulty));
            updateAccModeValue();
            if (gameMode === 'vs-bot') {
                const diffText = diffNames[aiDifficulty] || selectDifficulty.options[selectDifficulty.selectedIndex].text;
                topPlayerName.textContent = `🤖 ${diffText}`;
            }
            syncCustomSelects();
        });
    }

    if (selectMode) {
        selectMode.addEventListener('change', (e) => {
            setLobbyMode(e.target.value);
            if (gameMode !== 'online') startNewGame();
            syncCustomSelects();
        });
    }

    if (selectTimer) {
        selectTimer.addEventListener('change', (e) => {
            timeControl = parseInt(e.target.value, 10);
            whiteTime   = timeControl;
            blackTime   = timeControl;
            updateTimerDisplays();
            syncCustomSelects();
        });
    }

    // Initial sync of custom select components
    syncCustomSelects();

    // ══════════════════════════════════════════════════════════
    //  INVENTORY MODAL
    // ══════════════════════════════════════════════════════════
    const invModal       = document.getElementById('inventory-modal');
    const invCloseBtn    = document.getElementById('inv-close-btn');
    const invOpenBtn     = document.getElementById('lobby-inventory-btn');
    const invTabs        = document.querySelectorAll('.inv-tab');
    const invPanels      = document.querySelectorAll('.inv-tab-panel');
    const invFontItems   = document.querySelectorAll('.inv-font-item');

    let selectedFont = 'Outfit';
    try {
        selectedFont = localStorage.getItem('chess_pro_font') || 'Outfit';
    } catch (e) {}

    function applyFont(fontName) {
        if (!fontName) fontName = 'Outfit';
        selectedFont = fontName;
        try {
            localStorage.setItem('chess_pro_font', fontName);
        } catch (e) {}
        document.documentElement.style.setProperty('--font-main', `'${fontName}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`);
        document.body.style.fontFamily = `'${fontName}', sans-serif`;
    }

    function switchInvTab(tabId) {
        invTabs.forEach(t => {
            const active = t.dataset.tab === tabId;
            t.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        invPanels.forEach(p => {
            p.classList.toggle('hidden', p.id !== `inv-panel-${tabId}`);
        });
    }

    if (invOpenBtn && invModal) {
        invOpenBtn.addEventListener('click', () => {
            invModal.classList.remove('hidden');
            // Reset animation
            const box = invModal.querySelector('.inv-modal-box');
            if (box) { box.style.animation = 'none'; void box.offsetWidth; box.style.animation = ''; }
        });
    }

    function closeInvModal() {
        if (invModal) invModal.classList.add('hidden');
    }

    if (invCloseBtn) invCloseBtn.addEventListener('click', closeInvModal);
    if (invModal) {
        invModal.addEventListener('click', (e) => {
            if (e.target === invModal) closeInvModal();
        });
    }

    invTabs.forEach(tab => {
        tab.addEventListener('click', () => switchInvTab(tab.dataset.tab));
    });

    invFontItems.forEach(item => {
        item.addEventListener('click', () => {
            const font = item.dataset.font;
            applyFont(font);
            invFontItems.forEach(fi => {
                const active = fi.dataset.font === font;
                fi.classList.toggle('inv-font-active', active);
                const check = fi.querySelector('.inv-font-check');
                if (check) check.classList.toggle('hidden', !active);
            });
        });
    });

    // Apply saved font on boot
    applyFont(selectedFont);
    // Mark saved font as active in UI
    invFontItems.forEach(fi => {
        const active = fi.dataset.font === selectedFont;
        fi.classList.toggle('inv-font-active', active);
        const check = fi.querySelector('.inv-font-check');
        if (check) check.classList.toggle('hidden', !active);
    });

    // ── FRAME CONTROLLER ──────────────────────────────────────
    const invFrameItems   = document.querySelectorAll('.inv-frame-item');
    const topFrameOverlay    = document.getElementById('top-frame-overlay');
    const bottomFrameOverlay = document.getElementById('bottom-frame-overlay');

    function updateHUDFrame() {
        const bottomPanel = document.getElementById('bottom-player-panel');
        const topPanel    = document.getElementById('top-player-panel');
        const isUserTop   = (gameMode === 'vs-bot' && playerColor === 'b');

        const userPanel   = isUserTop ? topPanel : bottomPanel;
        const oppPanel    = isUserTop ? bottomPanel : topPanel;
        const userOverlay = isUserTop ? topFrameOverlay : bottomFrameOverlay;
        const oppOverlay  = isUserTop ? bottomFrameOverlay : topFrameOverlay;

        // Kullanıcının kendi seçtiği çerçeve
        if (userOverlay) {
            if (selectedFrame) {
                userOverlay.src = selectedFrame;
                userOverlay.classList.add('visible');
                userPanel?.classList.add('has-frame');
            } else {
                userOverlay.src = '';
                userOverlay.classList.remove('visible');
                userPanel?.classList.remove('has-frame');
            }
        }

        // Rakibin seçtiği çerçeve (online modda)
        if (oppOverlay) {
            if (gameMode === 'online' && opponentFrame) {
                oppOverlay.src = opponentFrame;
                oppOverlay.classList.add('visible');
                oppPanel?.classList.add('has-frame');
            } else {
                oppOverlay.src = '';
                oppOverlay.classList.remove('visible');
                oppPanel?.classList.remove('has-frame');
            }
        }
    }

    function applyFrame(frameSrc) {
        selectedFrame = frameSrc || '';
        try {
            localStorage.setItem('chess_pro_frame', selectedFrame);
        } catch (e) {}
        updateHUDFrame();
        if (typeof updateLobbyProfile === 'function') updateLobbyProfile();

        // Online oynarken maç esnasında çerçeve değiştirilirse rakibe hemen ilet
        if (gameMode === 'online' && socket && socket.isConnected) {
            socket.sendFrame(selectedFrame);
        }
    }

    function syncFrameUI(activeFrame) {
        invFrameItems.forEach(fi => {
            const active = (fi.dataset.frame || '') === (activeFrame || '');
            fi.classList.toggle('inv-frame-active', active);
            const check = fi.querySelector('.inv-font-check');
            if (check) {
                check.classList.toggle('hidden', !active);
                check.style.display = active ? 'inline-block' : 'none';
            }
        });
    }

    invFrameItems.forEach(item => {
        item.addEventListener('click', (e) => {
            if (item.disabled || item.classList.contains('inv-frame-locked')) return;
            const frame = item.dataset.frame || '';
            applyFrame(frame);
            syncFrameUI(frame);
        });
    });

    // ── Profile Picture System State ─────────────────────────────
    const invProfileItems = document.querySelectorAll('.inv-profile-item');
    let selectedProfile   = '';
    try {
        selectedProfile = localStorage.getItem('chess_pro_profile') || '';
    } catch (e) {}

    // Apply saved frame on boot + mark active in UI
    applyFrame(selectedFrame);
    syncFrameUI(selectedFrame);

    function updateLobbyProfile() {
        const nickIcon = document.querySelector('.ios-nickname-icon');
        if (!nickIcon) return;
        if (selectedProfile) {
            nickIcon.innerHTML = `<div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
                <img src="${selectedProfile}" style="width:20px;height:20px;border-radius:50%;object-fit:cover;display:block;" alt="Profil">
                ${selectedFrame ? `<img src="${selectedFrame}" style="position:absolute;inset:-3px;width:30px;height:30px;pointer-events:none;object-fit:contain;" alt="Çerçeve">` : ''}
            </div>`;
        } else if (selectedFrame) {
            nickIcon.innerHTML = `<div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
                <span style="font-size:0.95rem;">👤</span>
                <img src="${selectedFrame}" style="position:absolute;inset:-3px;width:30px;height:30px;pointer-events:none;object-fit:contain;" alt="Çerçeve">
            </div>`;
        } else {
            nickIcon.textContent = '👤';
        }
    }

    function applyProfileToAvatar(avatarEl, src) {
        if (!avatarEl) return;
        const existing = avatarEl.querySelector('img.profile-img');
        if (existing) existing.remove();
        if (src) {
            avatarEl.textContent = '';
            const img = document.createElement('img');
            img.src = src;
            img.className = 'profile-img';
            img.alt = 'Profil';
            avatarEl.classList.add('has-profile');
            avatarEl.appendChild(img);
        } else {
            avatarEl.classList.remove('has-profile');
            avatarEl.textContent = '👤';
        }
    }

    function updateHUDProfile() {
        const isUserTop = (gameMode === 'vs-bot' && playerColor === 'b');
        const userAvatarEl = isUserTop
            ? document.querySelector('#top-player-panel .hud-avatar')
            : document.querySelector('#bottom-player-panel .hud-avatar');
        const botAvatarEl = isUserTop
            ? document.querySelector('#bottom-player-panel .hud-avatar')
            : document.querySelector('#top-player-panel .hud-avatar');

        if (botAvatarEl && gameMode === 'vs-bot') {
            const existing = botAvatarEl.querySelector('img.profile-img');
            if (existing) existing.remove();
            botAvatarEl.classList.remove('has-profile');
            botAvatarEl.textContent = '🤖';
        }
        applyProfileToAvatar(userAvatarEl, selectedProfile);
    }

    function applyProfile(src) {
        selectedProfile = src || '';
        try {
            localStorage.setItem('chess_pro_profile', selectedProfile);
        } catch (e) {}
        updateHUDProfile();
        updateLobbyProfile();
    }

    function syncProfileUI(activeSrc) {
        invProfileItems.forEach(pi => {
            const active = (pi.dataset.profile || '') === (activeSrc || '');
            pi.classList.toggle('inv-profile-active', active);
            const check = pi.querySelector('.inv-profile-check');
            if (check) {
                check.classList.toggle('hidden', !active);
                check.style.display = active ? 'flex' : 'none';
            }
        });
    }

    invProfileItems.forEach(item => {
        item.addEventListener('click', () => {
            const src = item.dataset.profile || '';
            applyProfile(src);
            syncProfileUI(src);
        });
    });

    // Apply saved profile on boot + mark active in UI
    applyProfile(selectedProfile);
    syncProfileUI(selectedProfile);

    // ── Boot ─────────────────────────────────────────────────────
    applyTheme(currentTheme);
    setLobbyMode('vs-bot');
    // Lobby is open on boot so player configures the game first
    lobbyScreen.classList.remove('hidden');
    // Initialize background board preview after DOM settles
    engine.reset();
    // Delay resize so layout is fully painted before measuring
    requestAnimationFrame(() => {
        handleResize();
        chessCanvas.render();
    });

    // ╔══════════════════════════════════════════════════════════╗
    // ║  GİZLİ AI JEST SİSTEMİ — Profil → sağa kaydır + 2x dokun ║
    // ╚══════════════════════════════════════════════════════════╝
    (function setupSecretGesture() {
        const profileZone = document.getElementById('bottom-player-panel');
        if (!profileZone) return;

        let swipeArmed = false;
        let swipeArmedTimer = null;
        let tapCount = 0;

        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;

        let mouseStartX = 0;
        let mouseStartY = 0;
        let mouseStartTime = 0;

        function toggleSecretAI() {
            secretAIActive = !secretAIActive;
            if (navigator.vibrate) {
                try { navigator.vibrate(secretAIActive ? [40, 60, 40] : [80]); } catch (_) {}
            }
            if (secretAIActive) {
                chessCanvas.secretHint = null;
                updateSecretHint();
                showSecretToast('🔮 GİZLİ AI AKTİF', '#00f5ff');
            } else {
                chessCanvas.secretHint = null;
                chessCanvas.render();
                showSecretToast('⚫ GİZLİ AI KAPALI', '#888888');
            }
        }

        function showSecretToast(msg, color) {
            let toast = document.getElementById('secret-ai-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'secret-ai-toast';
                Object.assign(toast.style, {
                    position: 'fixed',
                    bottom: '100px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(5, 7, 15, 0.92)',
                    backdropFilter: 'blur(12px)',
                    webkitBackdropFilter: 'blur(12px)',
                    color: color,
                    fontSize: '13px',
                    fontFamily: 'Outfit, monospace',
                    fontWeight: '700',
                    letterSpacing: '0.08em',
                    padding: '9px 22px',
                    borderRadius: '24px',
                    border: `1px solid ${color}`,
                    boxShadow: `0 0 20px ${color}66`,
                    zIndex: '99999',
                    pointerEvents: 'none',
                    opacity: '0',
                    transition: 'opacity 0.22s ease, transform 0.22s ease',
                    userSelect: 'none'
                });
                document.body.appendChild(toast);
            }
            toast.textContent = msg;
            toast.style.color = color;
            toast.style.borderColor = color;
            toast.style.boxShadow = `0 0 20px ${color}66`;
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) scale(1.05)';
            setTimeout(() => { toast.style.transform = 'translateX(-50%) scale(1)'; }, 150);
            clearTimeout(toast._hideTimer);
            toast._hideTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2200);
        }

        // ── Touch Kontrolü: Sağa Kaydır → Sonra 2 Kez Dokun ──
        profileZone.addEventListener('touchstart', (e) => {
            const t = e.touches[0];
            touchStartX = t.clientX;
            touchStartY = t.clientY;
            touchStartTime = Date.now();
        }, { passive: true });

        profileZone.addEventListener('touchend', (e) => {
            const t = e.changedTouches[0];
            const dx = t.clientX - touchStartX;
            const dy = Math.abs(t.clientY - touchStartY);
            const dt = Date.now() - touchStartTime;

            // 1. Sağa kaydırma hareketi (Swipe Right)
            if (dx > 30 && dy < 55 && dt < 1200) {
                swipeArmed = true;
                tapCount = 0;
                clearTimeout(swipeArmedTimer);
                // Sağa kaydırdıktan sonra 3.5 saniye içinde 2 kez basılmalı
                swipeArmedTimer = setTimeout(() => {
                    swipeArmed = false;
                    tapCount = 0;
                }, 3500);
                return;
            }

            // 2. Sağa kaydırdıktan sonra dokunmalar (Tap)
            if (swipeArmed && Math.abs(dx) < 25 && dy < 25 && dt < 450) {
                tapCount++;
                if (tapCount >= 2) {
                    swipeArmed = false;
                    tapCount = 0;
                    clearTimeout(swipeArmedTimer);
                    toggleSecretAI();
                }
            }
        }, { passive: true });

        // ── Fare / Masaüstü Kontrolü: Sağa Sürükle → Sonra 2 Kez Tıkla ──
        profileZone.addEventListener('mousedown', (e) => {
            mouseStartX = e.clientX;
            mouseStartY = e.clientY;
            mouseStartTime = Date.now();
        });

        profileZone.addEventListener('mouseup', (e) => {
            const dx = e.clientX - mouseStartX;
            const dy = Math.abs(e.clientY - mouseStartY);
            const dt = Date.now() - mouseStartTime;

            // 1. Sağa sürükleme (Drag Right)
            if (dx > 30 && dy < 50 && dt < 1200) {
                swipeArmed = true;
                tapCount = 0;
                clearTimeout(swipeArmedTimer);
                swipeArmedTimer = setTimeout(() => {
                    swipeArmed = false;
                    tapCount = 0;
                }, 3500);
                return;
            }

            // 2. Sağa sürükledikten sonra 2 kez tıklama
            if (swipeArmed && Math.abs(dx) < 15 && dy < 15) {
                tapCount++;
                if (tapCount >= 2) {
                    swipeArmed = false;
                    tapCount = 0;
                    clearTimeout(swipeArmedTimer);
                    toggleSecretAI();
                }
            }
        });
    })();

});
