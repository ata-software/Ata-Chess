// Comprehensive Chess Engine with all standard rules
// - Full legal move generation (Pins, Checks, Double Checks)
// - En Passant
// - Castling (Kingside & Queenside with all standard safety checks)
// - Pawn Promotion (Q, R, B, N)
// - Checkmate, Stalemate, 50-move rule, Insufficient Material, 3-fold repetition
// - Move undo / redo stack
// - SAN (Standard Algebraic Notation) generator

class ChessEngine {
    constructor() {
        this.reset();
    }

    reset() {
        // 8x8 Board. 0 = Rank 8, 7 = Rank 1. 0 = File a, 7 = File h.
        // Uppercase = White, Lowercase = Black
        this.board = [
            ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
            ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
            ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
        ];

        this.turn = 'w'; // 'w' = White, 'b' = Black
        this.castling = {
            wK: true, // White Kingside (e1-g1)
            wQ: true, // White Queenside (e1-c1)
            bK: true, // Black Kingside (e8-g8)
            bQ: true  // Black Queenside (e8-c8)
        };
        this.enPassant = null; // { r, c } of the square a pawn skipped over
        this.halfmoveClock = 0; // Moves since last capture or pawn advance
        this.fullmoveNumber = 1;
        this.history = []; // Move stack for undo
        this.positionCounts = new Map(); // For 3-fold repetition

        this.recordPosition();
    }

    // Helper: Clone current engine state
    clone() {
        const copy = new ChessEngine();
        copy.board = this.board.map(row => [...row]);
        copy.turn = this.turn;
        copy.castling = { ...this.castling };
        copy.enPassant = this.enPassant ? { ...this.enPassant } : null;
        copy.halfmoveClock = this.halfmoveClock;
        copy.fullmoveNumber = this.fullmoveNumber;
        return copy;
    }

    getPieceColor(piece) {
        if (!piece) return null;
        return piece === piece.toUpperCase() ? 'w' : 'b';
    }

    isOpponent(piece1, piece2) {
        if (!piece1 || !piece2) return false;
        return this.getPieceColor(piece1) !== this.getPieceColor(piece2);
    }

    isInside(r, c) {
        return r >= 0 && r < 8 && c >= 0 && c < 8;
    }

    // Position key for 3-fold repetition
    getPositionKey() {
        let boardStr = this.board.map(r => r.map(p => p || '.').join('')).join('');
        let castStr = `${this.castling.wK ? 'K' : ''}${this.castling.wQ ? 'Q' : ''}${this.castling.bK ? 'k' : ''}${this.castling.bQ ? 'q' : ''}`;
        let epStr = this.enPassant ? `${this.enPassant.r},${this.enPassant.c}` : '-';
        return `${boardStr}_${this.turn}_${castStr}_${epStr}`;
    }

    recordPosition() {
        const key = this.getPositionKey();
        this.positionCounts.set(key, (this.positionCounts.get(key) || 0) + 1);
    }

    unrecordPosition() {
        const key = this.getPositionKey();
        const count = this.positionCounts.get(key);
        if (count && count > 1) {
            this.positionCounts.set(key, count - 1);
        } else {
            this.positionCounts.delete(key);
        }
    }

    // Find the King square for a specific color
    findKing(color) {
        const target = color === 'w' ? 'K' : 'k';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.board[r][c] === target) {
                    return { r, c };
                }
            }
        }
        return null;
    }

    // Check if square (r, c) is attacked by `byColor`
    isSquareAttacked(r, c, byColor) {
        const pawn = byColor === 'w' ? 'P' : 'p';
        const knight = byColor === 'w' ? 'N' : 'n';
        const bishop = byColor === 'w' ? 'B' : 'b';
        const rook = byColor === 'w' ? 'R' : 'r';
        const queen = byColor === 'w' ? 'Q' : 'q';
        const king = byColor === 'w' ? 'K' : 'k';

        // 1. Pawn attacks
        const pStep = byColor === 'w' ? 1 : -1;
        const pawnRow = r + pStep;
        if (this.isInside(pawnRow, c - 1) && this.board[pawnRow][c - 1] === pawn) return true;
        if (this.isInside(pawnRow, c + 1) && this.board[pawnRow][c + 1] === pawn) return true;

        // 2. Knight attacks
        const knightOffsets = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        for (const [dr, dc] of knightOffsets) {
            const nr = r + dr, nc = c + dc;
            if (this.isInside(nr, nc) && this.board[nr][nc] === knight) return true;
        }

        // 3. Diagonal attacks (Bishop, Queen)
        const diagOffsets = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (const [dr, dc] of diagOffsets) {
            let step = 1;
            while (true) {
                const nr = r + dr * step, nc = c + dc * step;
                if (!this.isInside(nr, nc)) break;
                const p = this.board[nr][nc];
                if (p) {
                    if (p === bishop || p === queen) return true;
                    break;
                }
                step++;
            }
        }

        // 4. Straight attacks (Rook, Queen)
        const straightOffsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of straightOffsets) {
            let step = 1;
            while (true) {
                const nr = r + dr * step, nc = c + dc * step;
                if (!this.isInside(nr, nc)) break;
                const p = this.board[nr][nc];
                if (p) {
                    if (p === rook || p === queen) return true;
                    break;
                }
                step++;
            }
        }

        // 5. King attacks (adjacent squares)
        const kingOffsets = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];
        for (const [dr, dc] of kingOffsets) {
            const nr = r + dr, nc = c + dc;
            if (this.isInside(nr, nc) && this.board[nr][nc] === king) return true;
        }

        return false;
    }

    isKingInCheck(color = this.turn) {
        const kingPos = this.findKing(color);
        if (!kingPos) return false;
        const opponentColor = color === 'w' ? 'b' : 'w';
        return this.isSquareAttacked(kingPos.r, kingPos.c, opponentColor);
    }

    // Generate pseudo-legal moves for a specific piece
    getPseudoMoves(r, c) {
        const piece = this.board[r][c];
        if (!piece) return [];
        const color = this.getPieceColor(piece);
        if (color !== this.turn) return [];

        const type = piece.toUpperCase();
        const moves = [];

        if (type === 'P') {
            const dir = color === 'w' ? -1 : 1;
            const startRow = color === 'w' ? 6 : 1;
            const promoRow = color === 'w' ? 0 : 7;

            // 1 square forward
            const f1r = r + dir;
            if (this.isInside(f1r, c) && !this.board[f1r][c]) {
                if (f1r === promoRow) {
                    ['Q', 'R', 'B', 'N'].forEach(prom => {
                        moves.push({ from: { r, c }, to: { r: f1r, c }, promotion: color === 'w' ? prom : prom.toLowerCase() });
                    });
                } else {
                    moves.push({ from: { r, c }, to: { r: f1r, c } });

                    // 2 squares forward from starting rank
                    const f2r = r + 2 * dir;
                    if (r === startRow && !this.board[f2r][c]) {
                        moves.push({ from: { r, c }, to: { r: f2r, c }, isDoublePawn: true });
                    }
                }
            }

            // Diagonal Captures
            for (const dc of [-1, 1]) {
                const targetC = c + dc;
                if (this.isInside(f1r, targetC)) {
                    const targetPiece = this.board[f1r][targetC];
                    if (targetPiece && this.isOpponent(piece, targetPiece)) {
                        if (f1r === promoRow) {
                            ['Q', 'R', 'B', 'N'].forEach(prom => {
                                moves.push({ from: { r, c }, to: { r: f1r, c: targetC }, promotion: color === 'w' ? prom : prom.toLowerCase() });
                            });
                        } else {
                            moves.push({ from: { r, c }, to: { r: f1r, c: targetC } });
                        }
                    } else if (this.enPassant && this.enPassant.r === f1r && this.enPassant.c === targetC) {
                        // En Passant
                        moves.push({ from: { r, c }, to: { r: f1r, c: targetC }, isEnPassant: true });
                    }
                }
            }
        } else if (type === 'N') {
            const offsets = [
                [-2, -1], [-2, 1], [-1, -2], [-1, 2],
                [1, -2], [1, 2], [2, -1], [2, 1]
            ];
            for (const [dr, dc] of offsets) {
                const nr = r + dr, nc = c + dc;
                if (this.isInside(nr, nc)) {
                    const target = this.board[nr][nc];
                    if (!target || this.isOpponent(piece, target)) {
                        moves.push({ from: { r, c }, to: { r: nr, c: nc } });
                    }
                }
            }
        } else if (type === 'B' || type === 'R' || type === 'Q') {
            const directions = [];
            if (type === 'B' || type === 'Q') {
                directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
            }
            if (type === 'R' || type === 'Q') {
                directions.push([-1, 0], [1, 0], [0, -1], [0, 1]);
            }

            for (const [dr, dc] of directions) {
                let step = 1;
                while (true) {
                    const nr = r + dr * step, nc = c + dc * step;
                    if (!this.isInside(nr, nc)) break;
                    const target = this.board[nr][nc];
                    if (!target) {
                        moves.push({ from: { r, c }, to: { r: nr, c: nc } });
                    } else {
                        if (this.isOpponent(piece, target)) {
                            moves.push({ from: { r, c }, to: { r: nr, c: nc } });
                        }
                        break;
                    }
                    step++;
                }
            }
        } else if (type === 'K') {
            const directions = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1],           [0, 1],
                [1, -1],  [1, 0],  [1, 1]
            ];
            for (const [dr, dc] of directions) {
                const nr = r + dr, nc = c + dc;
                if (this.isInside(nr, nc)) {
                    const target = this.board[nr][nc];
                    if (!target || this.isOpponent(piece, target)) {
                        moves.push({ from: { r, c }, to: { r: nr, c: nc } });
                    }
                }
            }

            // Castling
            const opp = color === 'w' ? 'b' : 'w';
            if (color === 'w' && r === 7 && c === 4) {
                // White Kingside: e1 -> g1 (cols 4 to 6)
                if (this.castling.wK && !this.board[7][5] && !this.board[7][6]) {
                    if (!this.isSquareAttacked(7, 4, opp) &&
                        !this.isSquareAttacked(7, 5, opp) &&
                        !this.isSquareAttacked(7, 6, opp)) {
                        moves.push({ from: { r: 7, c: 4 }, to: { r: 7, c: 6 }, isCastle: 'K' });
                    }
                }
                // White Queenside: e1 -> c1 (cols 4 to 2)
                if (this.castling.wQ && !this.board[7][3] && !this.board[7][2] && !this.board[7][1]) {
                    if (!this.isSquareAttacked(7, 4, opp) &&
                        !this.isSquareAttacked(7, 3, opp) &&
                        !this.isSquareAttacked(7, 2, opp)) {
                        moves.push({ from: { r: 7, c: 4 }, to: { r: 7, c: 2 }, isCastle: 'Q' });
                    }
                }
            } else if (color === 'b' && r === 0 && c === 4) {
                // Black Kingside: e8 -> g8 (cols 4 to 6)
                if (this.castling.bK && !this.board[0][5] && !this.board[0][6]) {
                    if (!this.isSquareAttacked(0, 4, opp) &&
                        !this.isSquareAttacked(0, 5, opp) &&
                        !this.isSquareAttacked(0, 6, opp)) {
                        moves.push({ from: { r: 0, c: 4 }, to: { r: 0, c: 6 }, isCastle: 'k' });
                    }
                }
                // Black Queenside: e8 -> c8 (cols 4 to 2)
                if (this.castling.bQ && !this.board[0][3] && !this.board[0][2] && !this.board[0][1]) {
                    if (!this.isSquareAttacked(0, 4, opp) &&
                        !this.isSquareAttacked(0, 3, opp) &&
                        !this.isSquareAttacked(0, 2, opp)) {
                        moves.push({ from: { r: 0, c: 4 }, to: { r: 0, c: 2 }, isCastle: 'q' });
                    }
                }
            }
        }

        return moves;
    }

    // Filter pseudo-legal moves ensuring friendly King is never left in check
    getLegalMovesForSquare(r, c) {
        const pseudo = this.getPseudoMoves(r, c);
        const legal = [];

        for (const move of pseudo) {
            if (this.isMoveLegal(move)) {
                legal.push(move);
            }
        }
        return legal;
    }

    // Check legality of a candidate move by making it on board and testing check
    isMoveLegal(move) {
        const { from, to, isEnPassant, isCastle, promotion } = move;
        const piece = this.board[from.r][from.c];
        const captured = this.board[to.r][to.c];
        const color = this.getPieceColor(piece);

        // Apply move temporarily
        this.board[to.r][to.c] = promotion || piece;
        this.board[from.r][from.c] = null;

        let epCaptured = null;
        if (isEnPassant) {
            const epRow = color === 'w' ? to.r + 1 : to.r - 1;
            epCaptured = this.board[epRow][to.c];
            this.board[epRow][to.c] = null;
        }

        // For castling, rook also moves temporarily
        if (isCastle === 'K') {
            this.board[7][5] = 'R';
            this.board[7][7] = null;
        } else if (isCastle === 'Q') {
            this.board[7][3] = 'R';
            this.board[7][0] = null;
        } else if (isCastle === 'k') {
            this.board[0][5] = 'r';
            this.board[0][7] = null;
        } else if (isCastle === 'q') {
            this.board[0][3] = 'r';
            this.board[0][0] = null;
        }

        const inCheck = this.isKingInCheck(color);

        // Revert move
        this.board[from.r][from.c] = piece;
        this.board[to.r][to.c] = captured;

        if (isEnPassant) {
            const epRow = color === 'w' ? to.r + 1 : to.r - 1;
            this.board[epRow][to.c] = epCaptured;
        }

        if (isCastle === 'K') {
            this.board[7][7] = 'R';
            this.board[7][5] = null;
        } else if (isCastle === 'Q') {
            this.board[7][0] = 'R';
            this.board[7][3] = null;
        } else if (isCastle === 'k') {
            this.board[0][7] = 'r';
            this.board[0][5] = null;
        } else if (isCastle === 'q') {
            this.board[0][0] = 'r';
            this.board[0][3] = null;
        }

        return !inCheck;
    }

    // Get all legal moves for current player
    getAllLegalMoves() {
        const moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && this.getPieceColor(piece) === this.turn) {
                    moves.push(...this.getLegalMovesForSquare(r, c));
                }
            }
        }
        return moves;
    }

    // Execute move on the engine board
    makeMove(move, generateSan = true) {
        const { from, to, isEnPassant, isCastle, promotion } = move;
        const piece = this.board[from.r][from.c];
        const captured = this.board[to.r][to.c];
        const color = this.getPieceColor(piece);

        // Generate SAN before state updates if requested
        const san = generateSan ? this.generateSAN(move) : '';

        // Save history snapshot for undo
        const historyEntry = {
            from: { ...from },
            to: { ...to },
            piece,
            captured,
            isEnPassant: !!isEnPassant,
            isCastle,
            promotion,
            prevCastling: { ...this.castling },
            prevEnPassant: this.enPassant ? { ...this.enPassant } : null,
            prevHalfmoveClock: this.halfmoveClock,
            prevFullmoveNumber: this.fullmoveNumber,
            san,
            recordedPosition: generateSan
        };

        // Reset or advance 50-move clock
        if (piece.toUpperCase() === 'P' || captured || isEnPassant) {
            this.halfmoveClock = 0;
        } else {
            this.halfmoveClock++;
        }

        // Apply primary movement
        this.board[to.r][to.c] = promotion || piece;
        this.board[from.r][from.c] = null;

        // En Passant capture removal
        if (isEnPassant) {
            const epRow = color === 'w' ? to.r + 1 : to.r - 1;
            historyEntry.epCapturedPiece = this.board[epRow][to.c];
            this.board[epRow][to.c] = null;
        }

        // Castling rook movement
        if (isCastle === 'K') {
            this.board[7][5] = 'R';
            this.board[7][7] = null;
        } else if (isCastle === 'Q') {
            this.board[7][3] = 'R';
            this.board[7][0] = null;
        } else if (isCastle === 'k') {
            this.board[0][5] = 'r';
            this.board[0][7] = null;
        } else if (isCastle === 'q') {
            this.board[0][3] = 'r';
            this.board[0][0] = null;
        }

        // Update En Passant square
        if (piece.toUpperCase() === 'P' && Math.abs(to.r - from.r) === 2) {
            this.enPassant = { r: (from.r + to.r) / 2, c: from.c };
        } else {
            this.enPassant = null;
        }

        // Update Castling rights
        if (piece === 'K') {
            this.castling.wK = false;
            this.castling.wQ = false;
        } else if (piece === 'k') {
            this.castling.bK = false;
            this.castling.bQ = false;
        } else if (piece === 'R') {
            if (from.r === 7 && from.c === 7) this.castling.wK = false;
            if (from.r === 7 && from.c === 0) this.castling.wQ = false;
        } else if (piece === 'r') {
            if (from.r === 0 && from.c === 7) this.castling.bK = false;
            if (from.r === 0 && from.c === 0) this.castling.bQ = false;
        }

        // If a rook is captured in corner, revoke rights
        if (to.r === 7 && to.c === 7) this.castling.wK = false;
        if (to.r === 7 && to.c === 0) this.castling.wQ = false;
        if (to.r === 0 && to.c === 7) this.castling.bK = false;
        if (to.r === 0 && to.c === 0) this.castling.bQ = false;

        // Switch turn & update move count
        if (this.turn === 'b') {
            this.fullmoveNumber++;
        }
        this.turn = this.turn === 'w' ? 'b' : 'w';

        this.history.push(historyEntry);
        if (generateSan) {
            this.recordPosition();
        }

        return historyEntry;
    }

    // Undo the last move
    undoMove() {
        if (this.history.length === 0) return null;

        const last = this.history.pop();
        if (last.recordedPosition) {
            this.unrecordPosition();
        }

        // Restore turn & counters
        this.turn = this.turn === 'w' ? 'b' : 'w';
        this.castling = { ...last.prevCastling };
        this.enPassant = last.prevEnPassant ? { ...last.prevEnPassant } : null;
        this.halfmoveClock = last.prevHalfmoveClock;
        this.fullmoveNumber = last.prevFullmoveNumber;

        // Restore pieces
        this.board[last.from.r][last.from.c] = last.piece;
        this.board[last.to.r][last.to.c] = last.captured;

        // Restore En Passant captured piece
        if (last.isEnPassant) {
            const epRow = this.turn === 'w' ? last.to.r + 1 : last.to.r - 1;
            this.board[epRow][last.to.c] = last.epCapturedPiece;
            this.board[last.to.r][last.to.c] = null;
        }

        // Restore Rook from castling
        if (last.isCastle === 'K') {
            this.board[7][7] = 'R';
            this.board[7][5] = null;
        } else if (last.isCastle === 'Q') {
            this.board[7][0] = 'R';
            this.board[7][3] = null;
        } else if (last.isCastle === 'k') {
            this.board[0][7] = 'r';
            this.board[0][5] = null;
        } else if (last.isCastle === 'q') {
            this.board[0][0] = 'r';
            this.board[0][3] = null;
        }

        return last;
    }

    // Generate Standard Algebraic Notation (SAN)
    generateSAN(move) {
        const { from, to, isCastle, promotion, isEnPassant } = move;
        if (isCastle === 'K' || isCastle === 'k') return 'O-O';
        if (isCastle === 'Q' || isCastle === 'q') return 'O-O-O';

        const piece = this.board[from.r][from.c];
        if (!piece) return '';
        const type = piece.toUpperCase();
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const fromSquare = `${files[from.c]}${8 - from.r}`;
        const toSquare = `${files[to.c]}${8 - to.r}`;
        const isCapture = !!this.board[to.r][to.c] || isEnPassant;

        let san = '';
        if (type === 'P') {
            if (isCapture) {
                san += `${files[from.c]}x${toSquare}`;
            } else {
                san += toSquare;
            }
            if (promotion) {
                san += `=${promotion.toUpperCase()}`;
            }
        } else {
            san += type;
            // Ambiguity disambiguation
            const others = this.getAllLegalMoves().filter(m => {
                if (m.from.r === from.r && m.from.c === from.c) return false;
                if (m.to.r !== to.r || m.to.c !== to.c) return false;
                const otherPiece = this.board[m.from.r][m.from.c];
                return otherPiece && otherPiece.toUpperCase() === type;
            });

            if (others.length > 0) {
                const sameFile = others.some(m => m.from.c === from.c);
                const sameRank = others.some(m => m.from.r === from.r);
                if (!sameFile) {
                    san += files[from.c];
                } else if (!sameRank) {
                    san += `${8 - from.r}`;
                } else {
                    san += fromSquare;
                }
            }

            if (isCapture) {
                san += 'x';
            }
            san += toSquare;
        }

        // Test if this move delivers check or checkmate
        // Passing generateSan = false prevents recursive calls
        const clone = this.clone();
        clone.makeMove(move, false);
        const oppColor = clone.turn;
        if (clone.isKingInCheck(oppColor)) {
            if (clone.getAllLegalMoves().length === 0) {
                san += '#';
            } else {
                san += '+';
            }
        }

        return san;
    }

    // Check game over status
    getGameStatus() {
        const legalMoves = this.getAllLegalMoves();
        const inCheck = this.isKingInCheck(this.turn);

        if (legalMoves.length === 0) {
            if (inCheck) {
                return {
                    isOver: true,
                    winner: this.turn === 'w' ? 'b' : 'w',
                    reason: 'checkmate',
                    message: this.turn === 'w' ? 'Şah-Mat! Siyah Kazandı.' : 'Şah-Mat! Beyaz Kazandı.'
                };
            } else {
                return {
                    isOver: true,
                    winner: null,
                    reason: 'stalemate',
                    message: 'Pat! Oyun Berabere.'
                };
            }
        }

        // 50-move rule
        if (this.halfmoveClock >= 100) {
            return {
                isOver: true,
                winner: null,
                reason: 'fifty-move',
                message: '50 Hamle Kuralı! Oyun Berabere.'
            };
        }

        // 3-fold repetition
        const currentPosCount = this.positionCounts.get(this.getPositionKey()) || 0;
        if (currentPosCount >= 3) {
            return {
                isOver: true,
                winner: null,
                reason: 'repetition',
                message: '3 Tekrar Kuralı! Oyun Berabere.'
            };
        }

        // Insufficient material
        if (this.isInsufficientMaterial()) {
            return {
                isOver: true,
                winner: null,
                reason: 'insufficient-material',
                message: 'Yetersiz Materyal! Oyun Berabere.'
            };
        }

        return {
            isOver: false,
            inCheck
        };
    }

    // Check if remaining pieces cannot force checkmate
    isInsufficientMaterial() {
        const pieces = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p) pieces.push({ piece: p, r, c });
            }
        }

        // K vs K
        if (pieces.length === 2) return true;

        // K+B vs K or K+N vs K
        if (pieces.length === 3) {
            const nonKings = pieces.filter(p => p.piece.toUpperCase() !== 'K');
            if (nonKings.length === 1) {
                const type = nonKings[0].piece.toUpperCase();
                if (type === 'B' || type === 'N') return true;
            }
        }

        // K+B vs K+B (same color bishops)
        if (pieces.length === 4) {
            const bishops = pieces.filter(p => p.piece.toUpperCase() === 'B');
            if (bishops.length === 2) {
                const b1 = bishops[0], b2 = bishops[1];
                const b1Color = (b1.r + b1.c) % 2;
                const b2Color = (b2.r + b2.c) % 2;
                if (b1Color === b2Color && this.getPieceColor(b1.piece) !== this.getPieceColor(b2.piece)) {
                    return true;
                }
            }
        }

        return false;
    }

    // Get captured pieces list and material evaluation
    getCapturedPieces() {
        const startingPieces = {
            P: 8, N: 2, B: 2, R: 2, Q: 1,
            p: 8, n: 2, b: 2, r: 2, q: 1
        };
        const currentPieces = {};

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p && p.toUpperCase() !== 'K') {
                    currentPieces[p] = (currentPieces[p] || 0) + 1;
                }
            }
        }

        const capturedByWhite = []; // Black pieces captured by white
        const capturedByBlack = []; // White pieces captured by black

        for (const [p, startCount] of Object.entries(startingPieces)) {
            const currentCount = currentPieces[p] || 0;
            const diff = startCount - currentCount;
            if (diff > 0) {
                for (let i = 0; i < diff; i++) {
                    if (p === p.toLowerCase()) {
                        capturedByWhite.push(p);
                    } else {
                        capturedByBlack.push(p);
                    }
                }
            }
        }

        // Sort by piece value
        const valMap = { p: 1, P: 1, n: 3, N: 3, b: 3, B: 3, r: 5, R: 5, q: 9, Q: 9 };
        capturedByWhite.sort((a, b) => valMap[b] - valMap[a]);
        capturedByBlack.sort((a, b) => valMap[b] - valMap[a]);

        const whiteMaterial = capturedByWhite.reduce((sum, p) => sum + valMap[p], 0);
        const blackMaterial = capturedByBlack.reduce((sum, p) => sum + valMap[p], 0);

        return {
            byWhite: capturedByWhite,
            byBlack: capturedByBlack,
            materialDiff: whiteMaterial - blackMaterial // Positive = White ahead
        };
    }
}

window.ChessEngine = ChessEngine;
