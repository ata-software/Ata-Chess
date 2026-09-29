// ╔══════════════════════════════════════════════════════════════════════╗
// ║              ATA GİZLİ ŞAMPİYON AI — ULTRA ZEKA                      ║
// ║  • PeSTO Pozisyonel Değerlendirme + Taş Çifti + Merkez Kontrolü      ║
// ║  • Iterative Deepening (Zaman Korumalı Derinlik 4-5)                 ║
// ║  • MVV-LVA & PV Move Ordering (Ultra Hızlı Alfa-Beta Budama)         ║
// ║  • Quiescence (Sessizlik) Arama — Horizon Etkisi ve Tuzak Korumalı   ║
// ║  • Dahili GM Açılış Kitaplığı (İlk Hamleler Kusursuz ve Anında)     ║
// ║  • Çevrimiçi soket, bot ve PvP'de tam uyumlu                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

class SecretAI {
    constructor() {
        this.PIECE_VALUES = {
            p: 100,
            n: 325,
            b: 340,
            r: 510,
            q: 980,
            k: 20000
        };

        // PeSTO Midgame Piece-Square Tables (Beyaz perspektifinden)
        this.PST = {
            p: [
                [  0,   0,   0,   0,   0,   0,   0,   0],
                [ 98, 134,  61,  95,  68, 126,  34, -11],
                [ -6,   7,  26,  31,  65,  56,  25, -20],
                [-14,  13,   6,  21,  23,  12,  17, -23],
                [-27,  -2,  -5,  12,  17,   6,  10, -25],
                [-26,  -4,  -4, -10,   3,   3,  33, -12],
                [-35,  -1, -20, -23, -15,  24,  38, -22],
                [  0,   0,   0,   0,   0,   0,   0,   0]
            ],
            n: [
                [-167, -89, -34, -49,  61, -97, -15,-107],
                [ -73, -41,  72,  36,  23,  62,   7, -17],
                [ -47,  60,  37,  65,  84, 129,  73,  44],
                [  -9,  17,  19,  53,  37,  69,  18,  22],
                [ -13,   4,  16,  13,  28,  19,  21,  -8],
                [ -23,  -9,  12,  10,  19,  17,  25, -16],
                [ -29, -53, -12,  -3,  -1,  18, -14, -19],
                [-105, -21, -58, -33, -17, -28, -19, -23]
            ],
            b: [
                [-29,   4, -82, -37, -25, -42,   7,  -8],
                [-26,  16, -18, -13,  30,  59,  18, -47],
                [-16,  37,  43,  40,  35,  50,  37,  -2],
                [ -4,   5,  19,  50,  37,  37,   7,  -2],
                [ -6,  13,  13,  26,  34,  12,  10,   4],
                [  0,  15,  15,  15,  14,  27,  18,  10],
                [  4,  15,  16,   0,   7,  21,  33,   1],
                [-33,  -3, -14, -21, -13, -12, -39, -21]
            ],
            r: [
                [ 32,  42,  32,  51,  63,   9,  31,  43],
                [ 27,  32,  58,  62,  80,  67,  26,  44],
                [ -5,  19,  26,  36,  17,  45,  61,  16],
                [-24, -11,   7,  26,  24,  35,  -8, -20],
                [-36, -26, -12,  -1,   9,  -7,   6, -23],
                [-45, -25, -16, -17,   3,   0,  -5, -33],
                [-44, -16, -20,  -9,  -1,  11,  -6, -71],
                [-19, -13,   1,  17,  16,   7, -37, -26]
            ],
            q: [
                [-28,   0,  29,  12,  59,  44,  43,  45],
                [-24, -39,  -5,   1, -16,  57,  28,  54],
                [-13, -17,   7,   8,  29,  56,  47,  57],
                [-27, -27, -16, -16,  -1,  17,  -2,   1],
                [ -9, -26,  -9, -10,  -2,  -4,   3,  -3],
                [-14,   2, -11,  -2,  -5,   2,  14,   5],
                [-35,  -8,  11,   2,   8,  15,  -3,   1],
                [ -1, -18,  -9,  10, -15, -25, -48, -18]
            ],
            k: [
                [-65,  23,  16, -15, -56, -34,   2,  13],
                [ 29,  -1, -20,  -7,  -8,  -4, -38, -29],
                [ -9,  24,   2, -16, -20,   6,  22, -22],
                [-17, -20, -12, -27, -30, -25, -14, -36],
                [-49,  -1, -27, -39, -46, -44, -33, -51],
                [-14, -14, -22, -46, -44, -30, -15, -27],
                [  1,   7,  -8, -64, -43, -16,   9,   8],
                [-15,  36,  12, -54,   8, -28,  24,  14]
            ]
        };

        // Dahili GM Açılış Hamleleri (İlk 2-4 hamle için kusursuz satranç prensipleri)
        this.openingBook = [
            // Beyaz ilk hamleler
            { match: () => true, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w', moves: [
                { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } }, // 1. e4 (Kral Piyonu)
                { from: { r: 6, c: 3 }, to: { r: 4, c: 3 } }, // 1. d4 (Vezir Piyonu)
                { from: { r: 7, c: 6 }, to: { r: 5, c: 5 } }  // 1. Nf3 (Reti)
            ]},
            // Siyah yanıt: 1. e4'e karşı
            { match: (b) => b[4][4] === 'P' && b[1][4] === 'p', moves: [
                { from: { r: 1, c: 4 }, to: { r: 3, c: 4 } }, // 1... e5
                { from: { r: 1, c: 2 }, to: { r: 3, c: 2 } }  // 1... c5 (Sicilya)
            ]},
            // Siyah yanıt: 1. d4'e karşı
            { match: (b) => b[4][3] === 'P' && b[0][6] === 'n', moves: [
                { from: { r: 0, c: 6 }, to: { r: 2, c: 5 } }, // 1... Nf6 (Hint)
                { from: { r: 1, c: 3 }, to: { r: 3, c: 3 } }  // 1... d5
            ]}
        ];
    }

    // Gelişmiş Pozisyon Değerlendirmesi
    evaluate(engine) {
        let score = 0;
        const board = engine.board;
        let whiteBishops = 0;
        let blackBishops = 0;
        let whitePawnsByCol = [0, 0, 0, 0, 0, 0, 0, 0];
        let blackPawnsByCol = [0, 0, 0, 0, 0, 0, 0, 0];

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];
                if (!piece) continue;

                const isWhite = piece === piece.toUpperCase();
                const type = piece.toLowerCase();
                const baseVal = this.PIECE_VALUES[type] || 0;

                // PST tablosu
                let pst = 0;
                if (this.PST[type]) {
                    const row = isWhite ? r : 7 - r;
                    const col = isWhite ? c : 7 - c;
                    pst = this.PST[type][row][col];
                }

                let pieceEval = baseVal + pst;

                // Taş özel değerlendirmeleri
                if (type === 'p') {
                    if (isWhite) whitePawnsByCol[c]++;
                    else         blackPawnsByCol[c]++;
                } else if (type === 'b') {
                    if (isWhite) whiteBishops++;
                    else         blackBishops++;
                } else if (type === 'r') {
                    // Açık veya yarı açık hat kontrolü
                    const colPawns = isWhite ? whitePawnsByCol[c] : blackPawnsByCol[c];
                    if (colPawns === 0) pieceEval += 25; // Açık hat
                    if (isWhite && r === 1) pieceEval += 35; // 7. yataydaki kale
                    if (!isWhite && r === 6) pieceEval += 35;
                }

                if (isWhite) score += pieceEval;
                else         score -= pieceEval;
            }
        }

        // Fil Çifti Bonusu (+35 centipawn)
        if (whiteBishops >= 2) score += 35;
        if (blackBishops >= 2) score -= 35;

        // Çift Piyon Cezası
        for (let c = 0; c < 8; c++) {
            if (whitePawnsByCol[c] > 1) score -= (whitePawnsByCol[c] - 1) * 20;
            if (blackPawnsByCol[c] > 1) score += (blackPawnsByCol[c] - 1) * 20;
        }

        // Merkez Hakimiyeti (d4, d5, e4, e5 kareleri kontrolü)
        const center = [ [3,3], [3,4], [4,3], [4,4] ];
        for (const [cr, cc] of center) {
            const p = board[cr][cc];
            if (p) {
                if (p === p.toUpperCase()) score += 15;
                else score -= 15;
            }
        }

        return score;
    }

    // MVV-LVA (Most Valuable Victim - Least Valuable Attacker) ve PV Hamle Sıralaması
    orderMoves(moves, engine, pvMove = null) {
        return moves.sort((a, b) => {
            // 1. PV (Önceki derinlikte en iyi bulunan hamle) her zaman ilk sırada
            if (pvMove) {
                const isAPV = a.from.r === pvMove.from.r && a.from.c === pvMove.from.c &&
                              a.to.r === pvMove.to.r && a.to.c === pvMove.to.c;
                const isBPV = b.from.r === pvMove.from.r && b.from.c === pvMove.from.c &&
                              b.to.r === pvMove.to.r && b.to.c === pvMove.to.c;
                if (isAPV) return -1;
                if (isBPV) return 1;
            }

            let scoreA = 0;
            let scoreB = 0;

            const tA = engine.board[a.to.r][a.to.c];
            const tB = engine.board[b.to.r][b.to.c];
            const pA = engine.board[a.from.r][a.from.c];
            const pB = engine.board[b.from.r][b.from.c];

            // MVV-LVA: Değerli taşı ucuz taşla yemek en öncelikli
            if (tA && pA) {
                scoreA += 10000 + (this.PIECE_VALUES[tA.toLowerCase()] || 0) * 10 - (this.PIECE_VALUES[pA.toLowerCase()] || 0);
            } else if (a.isEnPassant) {
                scoreA += 10500;
            }

            if (tB && pB) {
                scoreB += 10000 + (this.PIECE_VALUES[tB.toLowerCase()] || 0) * 10 - (this.PIECE_VALUES[pB.toLowerCase()] || 0);
            } else if (b.isEnPassant) {
                scoreB += 10500;
            }

            // Terfiler
            if (a.promotion) scoreA += 9000;
            if (b.promotion) scoreB += 9000;

            // Rok
            if (a.isCastle) scoreA += 500;
            if (b.isCastle) scoreB += 500;

            // Merkeze doğru hamleler
            const centerDistA = Math.abs(3.5 - a.to.r) + Math.abs(3.5 - a.to.c);
            const centerDistB = Math.abs(3.5 - b.to.r) + Math.abs(3.5 - b.to.c);
            scoreA += (7 - centerDistA) * 10;
            scoreB += (7 - centerDistB) * 10;

            return scoreB - scoreA;
        });
    }

    // Quiescence Search (Horizon etkisini önleyen taktiksel vuruş analizi)
    quiescence(engine, alpha, beta, isMaximizing, qDepth = 0) {
        const standPat = this.evaluate(engine);

        if (qDepth >= 4) return standPat; // Derinlik sınırı (aşırı uzamayı engeller)

        if (isMaximizing) {
            if (standPat >= beta) return beta;
            if (standPat > alpha) alpha = standPat;
        } else {
            if (standPat <= alpha) return alpha;
            if (standPat < beta) beta = standPat;
        }

        // Sadece taş alışları ve terfileri incele
        const allLegal = engine.getAllLegalMoves();
        const captures = allLegal.filter(m =>
            engine.board[m.to.r][m.to.c] || m.isEnPassant || m.promotion
        );

        if (captures.length === 0) return standPat;

        this.orderMoves(captures, engine);

        for (const move of captures) {
            engine.makeMove(move, false);
            const score = this.quiescence(engine, alpha, beta, !isMaximizing, qDepth + 1);
            engine.undoMove();

            if (isMaximizing) {
                if (score > alpha) alpha = score;
                if (alpha >= beta) return beta;
            } else {
                if (score < beta) beta = score;
                if (alpha >= beta) return alpha;
            }
        }

        return isMaximizing ? alpha : beta;
    }

    // Alfa-Beta Minimax Arama Motoru
    minimax(engine, depth, alpha, beta, isMaximizing, pvMove = null) {
        if (depth === 0) {
            return { score: this.quiescence(engine, alpha, beta, isMaximizing, 0) };
        }

        const legalMoves = engine.getAllLegalMoves();
        if (legalMoves.length === 0) {
            if (engine.isKingInCheck(engine.turn)) {
                // Şah-mat: ne kadar erken olursa o kadar iyi
                return { score: isMaximizing ? -50000 - depth : 50000 + depth };
            }
            return { score: 0 }; // Pat (Beraberlik)
        }

        const ordered = this.orderMoves(legalMoves, engine, pvMove);
        let bestMove = ordered[0];

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of ordered) {
                engine.makeMove(move, false);
                const ev = this.minimax(engine, depth - 1, alpha, beta, false).score;
                engine.undoMove();

                if (ev > maxEval) {
                    maxEval = ev;
                    bestMove = move;
                }
                alpha = Math.max(alpha, ev);
                if (beta <= alpha) break; // Beta budaması
            }
            return { score: maxEval, move: bestMove };
        } else {
            let minEval = Infinity;
            for (const move of ordered) {
                engine.makeMove(move, false);
                const ev = this.minimax(engine, depth - 1, alpha, beta, true).score;
                engine.undoMove();

                if (ev < minEval) {
                    minEval = ev;
                    bestMove = move;
                }
                beta = Math.min(beta, ev);
                if (beta <= alpha) break; // Alfa budaması
            }
            return { score: minEval, move: bestMove };
        }
    }

    // Açılış Kitaplığından Hamle Ara
    getOpeningMove(engine) {
        const moveCount = engine.moveHistory ? engine.moveHistory.length : 0;
        if (moveCount > 3) return null; // Sadece ilk 2 tam tur

        // Beyazın ilk hamlesi
        if (moveCount === 0 && engine.turn === 'w') {
            const open = this.openingBook[0].moves;
            return open[Math.floor(Math.random() * open.length)];
        }

        // Siyahın ilk hamlesi
        if (moveCount === 1 && engine.turn === 'b') {
            const firstMove = engine.moveHistory[0];
            // e4'e karşı
            if (firstMove.to.r === 4 && firstMove.to.c === 4) {
                const blackResponses = this.openingBook[1].moves;
                return blackResponses[Math.floor(Math.random() * blackResponses.length)];
            }
            // d4'e karşı
            if (firstMove.to.r === 4 && firstMove.to.c === 3) {
                const blackResponses = this.openingBook[2].moves;
                return blackResponses[Math.floor(Math.random() * blackResponses.length)];
            }
        }

        return null;
    }

    // Ana En İyi Hamle Arayıcı — Iterative Deepening ile Garantili Ultra Hızlı & Güçlü Yanıt
    findBestMove(engine) {
        const moves = engine.getAllLegalMoves();
        if (moves.length === 0) return null;

        // 1. Açılış hamlesi varsa anında Grandmaster hamlesi döndür (0 ms)
        try {
            const bookMove = this.getOpeningMove(engine);
            if (bookMove) {
                const validBook = moves.find(m =>
                    m.from.r === bookMove.from.r && m.from.c === bookMove.from.c &&
                    m.to.r === bookMove.to.r && m.to.c === bookMove.to.c
                );
                if (validBook) return validBook;
            }
        } catch (_) {}

        const isMaximizing = engine.turn === 'w';
        let bestMove = moves[0];
        const startTime = performance.now();
        const maxTimeMs = 320; // 320ms tavan — UI sıfır takılma, akıcı 60 FPS

        // 2. Iterative Deepening: Derinlik 1 -> 2 -> 3 -> 4 -> (zaman yeterliyse 5)
        try {
            for (let d = 1; d <= 5; d++) {
                const res = this.minimax(engine, d, -Infinity, Infinity, isMaximizing, bestMove);
                if (res && res.move) {
                    bestMove = res.move;
                }

                // Zaman limitine ulaşıldıysa daha derine inme, eldeki en kaliteli derinliği ver
                const elapsed = performance.now() - startTime;
                if (elapsed >= maxTimeMs || d >= 4 && moves.length > 25) {
                    break;
                }
            }
        } catch (e) {
            console.error('SecretAI search error:', e);
        }

        return bestMove || moves[0];
    }
}

window.SecretAI = SecretAI;
