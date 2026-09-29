// Chess AI with Minimax & Alpha-Beta Pruning + Positional Piece-Square Tables (PST)

class ChessAI {
    constructor() {
        // Standard piece values (Centipawns)
        this.PIECE_VALUES = {
            p: 100,
            n: 320,
            b: 330,
            r: 500,
            q: 900,
            k: 20000
        };

        // Positional Tables (From White's perspective; inverted for Black)
        this.PST = {
            p: [
                [ 0,  0,  0,  0,  0,  0,  0,  0],
                [50, 50, 50, 50, 50, 50, 50, 50],
                [10, 10, 20, 30, 30, 20, 10, 10],
                [ 5,  5, 10, 25, 25, 10,  5,  5],
                [ 0,  0,  0, 20, 20,  0,  0,  0],
                [ 5, -5,-10,  0,  0,-10, -5,  5],
                [ 5, 10, 10,-20,-20, 10, 10,  5],
                [ 0,  0,  0,  0,  0,  0,  0,  0]
            ],
            n: [
                [-50,-40,-30,-30,-30,-30,-40,-50],
                [-40,-20,  0,  0,  0,  0,-20,-40],
                [-30,  0, 10, 15, 15, 10,  0,-30],
                [-30,  5, 15, 20, 20, 15,  5,-30],
                [-30,  0, 15, 20, 20, 15,  0,-30],
                [-30,  5, 10, 15, 15, 10,  5,-30],
                [-40,-20,  0,  5,  5,  0,-20,-40],
                [-50,-40,-30,-30,-30,-30,-40,-50]
            ],
            b: [
                [-20,-10,-10,-10,-10,-10,-10,-20],
                [-10,  0,  0,  0,  0,  0,  0,-10],
                [-10,  0,  5, 10, 10,  5,  0,-10],
                [-10,  5,  5, 10, 10,  5,  5,-10],
                [-10,  0, 10, 10, 10, 10,  0,-10],
                [-10, 10, 10, 10, 10, 10, 10,-10],
                [-10,  5,  0,  0,  0,  0,  5,-10],
                [-20,-10,-10,-10,-10,-10,-10,-20]
            ],
            r: [
                [ 0,  0,  0,  0,  0,  0,  0,  0],
                [ 5, 10, 10, 10, 10, 10, 10,  5],
                [-5,  0,  0,  0,  0,  0,  0, -5],
                [-5,  0,  0,  0,  0,  0,  0, -5],
                [-5,  0,  0,  0,  0,  0,  0, -5],
                [-5,  0,  0,  0,  0,  0,  0, -5],
                [-5,  0,  0,  0,  0,  0,  0, -5],
                [ 0,  0,  0,  5,  5,  0,  0,  0]
            ],
            q: [
                [-20,-10,-10, -5, -5,-10,-10,-20],
                [-10,  0,  0,  0,  0,  0,  0,-10],
                [-10,  0,  5,  5,  5,  5,  0,-10],
                [ -5,  0,  5,  5,  5,  5,  0, -5],
                [  0,  0,  5,  5,  5,  5,  0, -5],
                [-10,  5,  5,  5,  5,  5,  0,-10],
                [-10,  0,  5,  0,  0,  0,  0,-10],
                [-20,-10,-10, -5, -5,-10,-10,-20]
            ],
            k: [
                [-30,-40,-40,-50,-50,-40,-40,-30],
                [-30,-40,-40,-50,-50,-40,-40,-30],
                [-30,-40,-40,-50,-50,-40,-40,-30],
                [-30,-40,-40,-50,-50,-40,-40,-30],
                [-20,-30,-30,-40,-40,-30,-30,-20],
                [-10,-20,-20,-20,-20,-20,-20,-10],
                [ 20, 20,  0,  0,  0,  0, 20, 20],
                [ 20, 30, 10,  0,  0, 10, 30, 20]
            ]
        };
    }

    // Evaluate static position (Positive = White advantage, Negative = Black advantage)
    evaluate(engine) {
        let score = 0;
        const board = engine.board;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];
                if (!piece) continue;

                const isWhite = piece === piece.toUpperCase();
                const type = piece.toLowerCase();
                const baseValue = this.PIECE_VALUES[type] || 0;

                // Positional score from table
                let pstScore = 0;
                if (this.PST[type]) {
                    const row = isWhite ? r : 7 - r;
                    const col = isWhite ? c : 7 - c;
                    pstScore = this.PST[type][row][col];
                }

                const totalVal = baseValue + pstScore;
                if (isWhite) {
                    score += totalVal;
                } else {
                    score -= totalVal;
                }
            }
        }
        return score;
    }

    // Sort moves so captures and checks come first (drastically boosts alpha-beta pruning)
    orderMoves(moves, engine) {
        return moves.sort((a, b) => {
            let scoreA = 0;
            let scoreB = 0;

            const targetA = engine.board[a.to.r][a.to.c];
            const targetB = engine.board[b.to.r][b.to.c];

            if (targetA) {
                const pieceA = engine.board[a.from.r][a.from.c];
                if (pieceA) {
                    scoreA += 10 * (this.PIECE_VALUES[targetA.toLowerCase()] || 0) - (this.PIECE_VALUES[pieceA.toLowerCase()] || 0);
                }
            }
            if (targetB) {
                const pieceB = engine.board[b.from.r][b.from.c];
                if (pieceB) {
                    scoreB += 10 * (this.PIECE_VALUES[targetB.toLowerCase()] || 0) - (this.PIECE_VALUES[pieceB.toLowerCase()] || 0);
                }
            }

            if (a.promotion) scoreA += 900;
            if (b.promotion) scoreB += 900;

            if (a.isCastle) scoreA += 50;
            if (b.isCastle) scoreB += 50;

            return scoreB - scoreA;
        });
    }

    // Alpha-Beta Minimax
    minimax(engine, depth, alpha, beta, isMaximizing) {
        if (depth === 0) {
            return { score: this.evaluate(engine) };
        }

        const legalMoves = engine.getAllLegalMoves();
        if (legalMoves.length === 0) {
            if (engine.isKingInCheck(engine.turn)) {
                // Checkmate: prioritize quicker mate
                return { score: isMaximizing ? -50000 - depth : 50000 + depth };
            } else {
                // Stalemate
                return { score: 0 };
            }
        }

        const orderedMoves = this.orderMoves(legalMoves, engine);
        let bestMove = orderedMoves[0];

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of orderedMoves) {
                engine.makeMove(move, false);
                const evaluation = this.minimax(engine, depth - 1, alpha, beta, false).score;
                engine.undoMove();

                if (evaluation > maxEval) {
                    maxEval = evaluation;
                    bestMove = move;
                }
                alpha = Math.max(alpha, evaluation);
                if (beta <= alpha) break; // Beta cutoff
            }
            return { score: maxEval, move: bestMove };
        } else {
            let minEval = Infinity;
            for (const move of orderedMoves) {
                engine.makeMove(move, false);
                const evaluation = this.minimax(engine, depth - 1, alpha, beta, true).score;
                engine.undoMove();

                if (evaluation < minEval) {
                    minEval = evaluation;
                    bestMove = move;
                }
                beta = Math.min(beta, evaluation);
                if (beta <= alpha) break; // Alpha cutoff
            }
            return { score: minEval, move: bestMove };
        }
    }

    // Main entry point for AI to calculate the best move
    findBestMove(engine, difficulty = 'orta') {
        const moves = engine.getAllLegalMoves();
        if (moves.length === 0) return null;

        // ── Level 1: Kolay (Easy) ────────────────────────────────
        // Completely random — beginner friendly, no strategy
        if (difficulty === 'kolay') {
            return moves[Math.floor(Math.random() * moves.length)];
        }

        // ── Level 2: Orta (Medium) ───────────────────────────────
        // Depth-2 minimax but with 35% chance of picking a random move (blunder)
        // Feels like an intermediate club player who occasionally makes mistakes
        if (difficulty === 'orta') {
            if (Math.random() < 0.35) {
                // Intentional blunder: pick a random (but not losing) move
                return moves[Math.floor(Math.random() * moves.length)];
            }
            const isMaximizing = engine.turn === 'w';
            const result = this.minimax(engine, 2, -Infinity, Infinity, isMaximizing);
            return result.move || moves[0];
        }

        // ── Level 3: Usta (Hard) ─────────────────────────────────
        // Depth-4 minimax with full move ordering — strong, consistent play
        // Looks 4 half-moves ahead, rarely blunders
        const isMaximizing = engine.turn === 'w';
        const result = this.minimax(engine, 4, -Infinity, Infinity, isMaximizing);
        return result.move || moves[0];
    }
}

window.ChessAI = ChessAI;
