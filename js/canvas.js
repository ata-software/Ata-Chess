// High-DPI HTML5 Canvas Chessboard Renderer with Smooth Animations & Vector Pieces

class ChessCanvas {
    constructor(canvas, engine, onMoveCallback, onPromotionNeeded, isTurnAllowed) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.engine = engine;
        this.onMoveCallback = onMoveCallback;
        this.onPromotionNeeded = onPromotionNeeded;
        this.isTurnAllowed = isTurnAllowed;
        this.isBusy = false;

        this.flipped = false; // false: White at bottom, true: Black at bottom
        this.theme = 'crimson'; // 'crimson' | 'wood' | 'newspaper' | 'steel' | 'retro'
        this.themes = {
            crimson: {
                light: '#ffffff',
                dark: '#991b1b',
                lastMove: 'rgba(251, 191, 36, 0.45)',
                selected: 'rgba(254, 240, 138, 0.65)',
                hintDot: 'rgba(0, 0, 0, 0.72)',
                hintDotGlow: 'rgba(255, 255, 255, 0.55)',
                hintCapture: 'rgba(239, 68, 68, 0.9)',
                coordLight: '#991b1b',
                coordDark: '#ffffff'
            },
            wood: {
                light: '#eed8ae',
                dark: '#9c5b28',
                lastMove: 'rgba(250, 204, 21, 0.45)',
                selected: 'rgba(251, 191, 36, 0.65)',
                hintDot: 'rgba(0, 0, 0, 0.68)',
                hintDotGlow: 'rgba(255, 255, 255, 0.5)',
                hintCapture: 'rgba(217, 119, 6, 0.92)',
                coordLight: '#9c5b28',
                coordDark: '#eed8ae'
            },
            newspaper: {
                light: '#f5f0e6',
                dark: '#3f4752',
                lastMove: 'rgba(148, 163, 184, 0.45)',
                selected: 'rgba(203, 213, 225, 0.65)',
                hintDot: 'rgba(15, 23, 42, 0.82)',
                hintDotGlow: 'rgba(255, 255, 255, 0.45)',
                hintCapture: 'rgba(15, 23, 42, 0.9)',
                coordLight: '#3f4752',
                coordDark: '#f5f0e6'
            },
            steel: {
                light: '#d5dde5',
                dark: '#475569',
                lastMove: 'rgba(56, 189, 248, 0.45)',
                selected: 'rgba(125, 211, 252, 0.65)',
                hintDot: 'rgba(2, 132, 199, 0.85)',
                hintDotGlow: 'rgba(125, 211, 252, 0.6)',
                hintCapture: 'rgba(14, 165, 233, 0.92)',
                coordLight: '#475569',
                coordDark: '#d5dde5'
            },
            retro: {
                light: '#1f103b',
                dark: '#3e166a',
                lastMove: 'rgba(236, 72, 153, 0.55)',
                selected: 'rgba(6, 182, 212, 0.7)',
                hintDot: 'rgba(6, 182, 212, 0.92)',
                hintDotGlow: 'rgba(236, 72, 153, 0.65)',
                hintCapture: 'rgba(6, 182, 212, 0.92)',
                coordLight: '#06b6d4',
                coordDark: '#ec4899'
            },
            cyber: {
                light: '#0a1d37',
                dark: '#020914',
                lastMove: 'rgba(0, 245, 255, 0.55)',
                selected: 'rgba(0, 255, 170, 0.7)',
                hintDot: 'rgba(0, 245, 255, 0.92)',
                hintDotGlow: 'rgba(0, 255, 170, 0.55)',
                hintCapture: 'rgba(255, 0, 127, 0.92)',
                coordLight: '#00f5ff',
                coordDark: '#00ffaa'
            }
        };

        this.selectedSquare = null; // { r, c }
        this.legalMoves = []; // Moves available for selectedSquare
        this.draggingPiece = null; // { piece, r, c, x, y, startX, startY }
        this.lastMove = null; // { from: {r,c}, to: {r,c} }
        this.animatingPiece = null; // { piece, fromR, fromC, toR, toC, curX, curY, targetX, targetY, startTime, duration }
        this.secretHint = null; // { from: {r,c}, to: {r,c} } — gizli AI önerisi

        this.dpr = window.devicePixelRatio || 1;
        this.squareSize = 60;
        this.boardSize = 480;

        this.patterns = {};
        this.initTextures();

        this.pieceImages = {};
        this.loadPieces();
        this.bindEvents();
    }

    // Procedural board texture pattern generators
    initTextures() {
        this.patterns = {};

        // 1. Wood Grain Pattern Generator
        const makeWoodPattern = (baseColor, grainColors) => {
            const tc = document.createElement('canvas');
            tc.width = 160;
            tc.height = 160;
            const tctx = tc.getContext('2d');
            tctx.fillStyle = baseColor;
            tctx.fillRect(0, 0, 160, 160);

            // Wavy organic wood grain lines
            grainColors.forEach(gc => {
                tctx.strokeStyle = gc;
                tctx.lineWidth = 1.2;
                for (let i = 0; i < 12; i++) {
                    const y = (i * 15);
                    tctx.beginPath();
                    tctx.moveTo(0, y);
                    tctx.bezierCurveTo(40, y + 10, 100, y - 8, 160, y + 6);
                    tctx.stroke();
                }
            });
            // Fine fibers
            for (let i = 0; i < 80; i++) {
                tctx.fillStyle = grainColors[0];
                tctx.fillRect(Math.random() * 160, Math.random() * 160, Math.random() * 8 + 2, 0.8);
            }
            return this.ctx.createPattern(tc, 'repeat');
        };

        // 2. Newspaper Print Pattern Generator
        const makeNewspaperPattern = (baseColor, isLight) => {
            const tc = document.createElement('canvas');
            tc.width = 140;
            tc.height = 140;
            const tctx = tc.getContext('2d');
            tctx.fillStyle = baseColor;
            tctx.fillRect(0, 0, 140, 140);

            // Miniature vintage news text columns / halftone rows
            tctx.fillStyle = isLight ? 'rgba(30, 41, 59, 0.13)' : 'rgba(255, 255, 255, 0.12)';
            for (let y = 10; y < 140; y += 7) {
                let x = 8;
                while (x < 130) {
                    const wordLen = Math.random() * 14 + 4;
                    tctx.fillRect(x, y, wordLen, 1.8);
                    x += wordLen + (Math.random() * 6 + 3);
                }
            }
            // Paper fiber noise
            for (let i = 0; i < 60; i++) {
                tctx.fillStyle = isLight ? 'rgba(120, 113, 108, 0.1)' : 'rgba(255, 255, 255, 0.08)';
                tctx.fillRect(Math.random() * 140, Math.random() * 140, 1.2, 1.2);
            }
            return this.ctx.createPattern(tc, 'repeat');
        };

        // 3. Brushed Steel Pattern Generator
        const makeSteelPattern = (baseColor, isLight) => {
            const tc = document.createElement('canvas');
            tc.width = 160;
            tc.height = 160;
            const tctx = tc.getContext('2d');
            tctx.fillStyle = baseColor;
            tctx.fillRect(0, 0, 160, 160);

            // Diagonal brushed steel hairline scratches
            for (let i = 0; i < 140; i++) {
                const alpha = Math.random() * 0.14 + 0.02;
                tctx.strokeStyle = Math.random() > 0.5 
                    ? `rgba(255, 255, 255, ${alpha})` 
                    : `rgba(15, 23, 42, ${alpha * 1.5})`;
                tctx.lineWidth = Math.random() * 1.5 + 0.5;
                const offset = (Math.random() - 0.5) * 320;
                tctx.beginPath();
                tctx.moveTo(offset, 0);
                tctx.lineTo(offset + 240, 160);
                tctx.stroke();
            }
            // Subtle metallic specular sheen gradient
            const sheen = tctx.createLinearGradient(0, 0, 160, 160);
            sheen.addColorStop(0, 'rgba(255,255,255,0.06)');
            sheen.addColorStop(0.5, 'rgba(255,255,255,0.18)');
            sheen.addColorStop(1, 'rgba(0,0,0,0.1)');
            tctx.fillStyle = sheen;
            tctx.fillRect(0, 0, 160, 160);

            return this.ctx.createPattern(tc, 'repeat');
        };

        // 4. Retro Arcade CRT Scanline Pattern Generator
        const makeRetroPattern = (baseColor, lineColor) => {
            const tc = document.createElement('canvas');
            tc.width = 60;
            tc.height = 60;
            const tctx = tc.getContext('2d');
            tctx.fillStyle = baseColor;
            tctx.fillRect(0, 0, 60, 60);

            // CRT scanlines
            tctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
            for (let y = 0; y < 60; y += 3) {
                tctx.fillRect(0, y, 60, 1);
            }
            // Neon grid line
            tctx.strokeStyle = lineColor;
            tctx.lineWidth = 1;
            tctx.strokeRect(0, 0, 60, 60);

            return this.ctx.createPattern(tc, 'repeat');
        };

        // 5. Crimson Polished Marble Pattern Generator
        const makeCrimsonPattern = (baseColor, veinColor) => {
            const tc = document.createElement('canvas');
            tc.width = 140;
            tc.height = 140;
            const tctx = tc.getContext('2d');
            tctx.fillStyle = baseColor;
            tctx.fillRect(0, 0, 140, 140);

            // Soft marble veins
            tctx.strokeStyle = veinColor;
            tctx.lineWidth = 1.6;
            for (let i = 0; i < 5; i++) {
                const startX = Math.random() * 140;
                tctx.beginPath();
                tctx.moveTo(startX, 0);
                tctx.bezierCurveTo(startX + 30, 45, startX - 25, 95, startX + 20, 140);
                tctx.stroke();
            }
            return this.ctx.createPattern(tc, 'repeat');
        };

        // 6. Cyber Grid & Circuit Pattern Generator
        const makeCyberPattern = (baseColor, isLight) => {
            const tc = document.createElement('canvas');
            tc.width = 120;
            tc.height = 120;
            const tctx = tc.getContext('2d');
            tctx.fillStyle = baseColor;
            tctx.fillRect(0, 0, 120, 120);

            // Cyber tech micro-grid
            tctx.strokeStyle = isLight ? 'rgba(0, 245, 255, 0.12)' : 'rgba(0, 245, 255, 0.07)';
            tctx.lineWidth = 1;
            for (let i = 0; i <= 120; i += 24) {
                tctx.beginPath();
                tctx.moveTo(i, 0); tctx.lineTo(i, 120);
                tctx.moveTo(0, i); tctx.lineTo(120, i);
                tctx.stroke();
            }

            // Cyber circuit traces and glowing micro-nodes
            tctx.strokeStyle = isLight ? 'rgba(0, 255, 170, 0.28)' : 'rgba(0, 245, 255, 0.22)';
            tctx.lineWidth = 1.4;
            tctx.beginPath();
            tctx.moveTo(12, 36); tctx.lineTo(48, 36); tctx.lineTo(72, 60); tctx.lineTo(108, 60);
            tctx.moveTo(24, 96); tctx.lineTo(72, 96); tctx.lineTo(96, 120);
            tctx.stroke();

            // Micro nodes
            tctx.fillStyle = isLight ? '#00ffaa' : '#00f5ff';
            tctx.fillRect(46, 34, 4, 4);
            tctx.fillRect(106, 58, 4, 4);
            tctx.fillRect(70, 94, 4, 4);

            return this.ctx.createPattern(tc, 'repeat');
        };

        try {
            this.patterns = {
                wood: {
                    light: makeWoodPattern('#eddcb9', ['rgba(161, 98, 7, 0.18)', 'rgba(120, 53, 15, 0.12)']),
                    dark: makeWoodPattern('#8c4e20', ['rgba(69, 26, 3, 0.35)', 'rgba(217, 119, 6, 0.15)'])
                },
                newspaper: {
                    light: makeNewspaperPattern('#f4efe4', true),
                    dark: makeNewspaperPattern('#373f49', false)
                },
                steel: {
                    light: makeSteelPattern('#d8e0e8', true),
                    dark: makeSteelPattern('#434d59', false)
                },
                retro: {
                    light: makeRetroPattern('#1d1238', 'rgba(6, 182, 212, 0.22)'),
                    dark: makeRetroPattern('#3b1260', 'rgba(236, 72, 153, 0.25)')
                },
                crimson: {
                    light: makeCrimsonPattern('#fafbfc', 'rgba(225, 29, 72, 0.08)'),
                    dark: makeCrimsonPattern('#991b1b', 'rgba(255, 255, 255, 0.14)')
                },
                cyber: {
                    light: makeCyberPattern('#0a1d37', true),
                    dark: makeCyberPattern('#020914', false)
                }
            };
        } catch (e) {
            console.warn('Pattern creation fallback', e);
        }
    }

    // High quality SVG chess pieces generated dynamically for the selected theme
    getThemeSvgPieces(themeName) {
        // ── 1. 3D STEEL THEME PIECES (Extruded Chrome / Dark Titanium with 3D Bevels) ──
        if (themeName === 'steel') {
            const buildSteelPiece = (type, color) => {
                const gid = color === 'w' ? 'st3d-w' : 'st3d-b';
                const str = color === 'w' ? '#0f172a' : '#38bdf8';
                const ext = color === 'w' ? '#475569' : '#030712';
                const fill = `url(#${gid})`;
                const defs = `<defs>
                    <linearGradient id="st3d-w" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#94a3b8"/>
                        <stop offset="25%" stop-color="#ffffff"/>
                        <stop offset="50%" stop-color="#cbd5e1"/>
                        <stop offset="78%" stop-color="#f8fafc"/>
                        <stop offset="100%" stop-color="#64748b"/>
                    </linearGradient>
                    <linearGradient id="st3d-b" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#0f172a"/>
                        <stop offset="25%" stop-color="#334155"/>
                        <stop offset="50%" stop-color="#1e293b"/>
                        <stop offset="80%" stop-color="#475569"/>
                        <stop offset="100%" stop-color="#050811"/>
                    </linearGradient>
                    <filter id="sh3d" x="-20%" y="-20%" width="150%" height="150%">
                        <feDropShadow dx="2" dy="4" stdDeviation="2.2" flood-color="#000" flood-opacity="0.65"/>
                    </filter>
                </defs>`;

                let body = '';
                switch (type) {
                    case 'K':
                        body = `
                            <!-- 3D Base Extrusion -->
                            <path d="M 8 38 L 37 38 L 35 41 L 10 41 Z" fill="${ext}"/>
                            <!-- 3D Base Front -->
                            <rect x="8" y="35" width="29" height="3" rx="1" fill="${fill}" stroke="${str}" stroke-width="1.2"/>
                            <!-- 3D Pedestal Body -->
                            <path d="M 12 35 C 13 28 17 26 18 22 C 16 19 14 15 15 11 C 18 10 27 10 30 11 C 31 15 29 19 27 22 C 28 26 32 28 33 35 Z" fill="${fill}" stroke="${str}" stroke-width="1.4"/>
                            <!-- 3D Crown -->
                            <path d="M 14 11 L 11 16 L 22.5 13 L 34 16 L 31 11 Z" fill="${fill}" stroke="${str}" stroke-width="1.2"/>
                            <!-- 3D Cross -->
                            <path d="M 22.5 4 V 11 M 19.5 7 H 25.5" stroke="${str}" stroke-width="2.2" stroke-linecap="square"/>
                            <!-- Chrome Specular Highlights -->
                            <line x1="16" y1="14" x2="17" y2="33" stroke="rgba(255,255,255,0.7)" stroke-width="1.5" stroke-linecap="round"/>
                            <circle cx="22.5" cy="7" r="1.2" fill="#38bdf8"/>
                        `;
                        break;
                    case 'Q':
                        body = `
                            <path d="M 8 38 L 37 38 L 35 41 L 10 41 Z" fill="${ext}"/>
                            <rect x="8" y="35" width="29" height="3" rx="1" fill="${fill}" stroke="${str}" stroke-width="1.2"/>
                            <path d="M 11 35 C 13 27 17 25 18 20 C 16 17 14 14 14 12 L 18 17 L 22.5 10 L 27 17 L 31 12 C 31 14 29 17 27 20 C 28 25 32 27 34 35 Z" fill="${fill}" stroke="${str}" stroke-width="1.4"/>
                            <circle cx="14" cy="11" r="2.2" fill="${fill}" stroke="${str}" stroke-width="1"/>
                            <circle cx="18" cy="15.5" r="1.8" fill="${fill}" stroke="${str}" stroke-width="1"/>
                            <circle cx="22.5" cy="9" r="2.5" fill="${fill}" stroke="${str}" stroke-width="1"/>
                            <circle cx="27" cy="15.5" r="1.8" fill="${fill}" stroke="${str}" stroke-width="1"/>
                            <circle cx="31" cy="11" r="2.2" fill="${fill}" stroke="${str}" stroke-width="1"/>
                            <line x1="16" y1="18" x2="17" y2="33" stroke="rgba(255,255,255,0.7)" stroke-width="1.5" stroke-linecap="round"/>
                        `;
                        break;
                    case 'R':
                        body = `
                            <path d="M 8 38 L 37 38 L 35 41 L 10 41 Z" fill="${ext}"/>
                            <rect x="8" y="35" width="29" height="3" rx="1" fill="${fill}" stroke="${str}" stroke-width="1.2"/>
                            <!-- Tower Body with 3D Bevel -->
                            <path d="M 12 35 L 14 16 L 31 16 L 33 35 Z" fill="${fill}" stroke="${str}" stroke-width="1.4"/>
                            <!-- 3D Castle Battlements -->
                            <path d="M 11 16 L 11 8 L 16 8 L 16 12 L 20 12 L 20 8 L 25 8 L 25 12 L 29 12 L 29 8 L 34 8 L 34 16 Z" fill="${fill}" stroke="${str}" stroke-width="1.4"/>
                            <line x1="15" y1="17" x2="15" y2="33" stroke="rgba(255,255,255,0.7)" stroke-width="1.5" stroke-linecap="round"/>
                        `;
                        break;
                    case 'B':
                        body = `
                            <path d="M 9 38 L 36 38 L 34 41 L 11 41 Z" fill="${ext}"/>
                            <rect x="9" y="35" width="27" height="3" rx="1" fill="${fill}" stroke="${str}" stroke-width="1.2"/>
                            <path d="M 13 35 C 14 27 18 24 18 20 C 15 18 15 13 18 10 C 20 7 25 7 27 10 C 30 13 30 18 27 20 C 27 24 31 27 32 35 Z" fill="${fill}" stroke="${str}" stroke-width="1.4"/>
                            <!-- Mitre Slit Cutout -->
                            <path d="M 20 11 L 25 18" stroke="${str}" stroke-width="2.2" stroke-linecap="round"/>
                            <circle cx="22.5" cy="6.5" r="2.2" fill="${fill}" stroke="${str}" stroke-width="1.2"/>
                            <line x1="16" y1="18" x2="16" y2="32" stroke="rgba(255,255,255,0.7)" stroke-width="1.5" stroke-linecap="round"/>
                        `;
                        break;
                    case 'N':
                        body = `
                            <path d="M 9 38 L 36 38 L 34 41 L 11 41 Z" fill="${ext}"/>
                            <rect x="9" y="35" width="27" height="3" rx="1" fill="${fill}" stroke="${str}" stroke-width="1.2"/>
                            <!-- 3D Chiseled Angular Mecha Knight -->
                            <path d="M 13 35 C 13 28 12 24 15 18 L 19 10 L 25 8 L 29 11 L 28 17 L 33 21 L 32 26 L 27 23 C 27 27 29 30 32 35 Z" fill="${fill}" stroke="${str}" stroke-width="1.4"/>
                            <!-- Mane Plates -->
                            <path d="M 25 8 L 22 15 L 18 20" stroke="${str}" stroke-width="1.2" fill="none"/>
                            <!-- Cyber eye -->
                            <circle cx="25.5" cy="14" r="1.5" fill="#38bdf8"/>
                            <line x1="16" y1="21" x2="16" y2="33" stroke="rgba(255,255,255,0.7)" stroke-width="1.5" stroke-linecap="round"/>
                        `;
                        break;
                    case 'P':
                        body = `
                            <path d="M 11 38 L 34 38 L 32 41 L 13 41 Z" fill="${ext}"/>
                            <rect x="11" y="35" width="23" height="3" rx="1" fill="${fill}" stroke="${str}" stroke-width="1.2"/>
                            <!-- 3D Conical Base -->
                            <path d="M 15 35 C 16 28 19 26 19 22 L 26 22 C 26 26 29 28 30 35 Z" fill="${fill}" stroke="${str}" stroke-width="1.4"/>
                            <ellipse cx="22.5" cy="22" rx="6" ry="2" fill="${fill}" stroke="${str}" stroke-width="1.2"/>
                            <!-- 3D Chrome Sphere -->
                            <circle cx="22.5" cy="13.5" r="6.5" fill="${fill}" stroke="${str}" stroke-width="1.4"/>
                            <!-- Specular Light Reflection Orb -->
                            <circle cx="20.5" cy="11.5" r="1.8" fill="#ffffff" opacity="0.9"/>
                        `;
                        break;
                }
                return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">${defs}<g filter="url(#sh3d)">${body}</g></svg>`;
            };

            return {
                'K': buildSteelPiece('K', 'w'), 'Q': buildSteelPiece('Q', 'w'),
                'R': buildSteelPiece('R', 'w'), 'B': buildSteelPiece('B', 'w'),
                'N': buildSteelPiece('N', 'w'), 'P': buildSteelPiece('P', 'w'),
                'k': buildSteelPiece('K', 'b'), 'q': buildSteelPiece('Q', 'b'),
                'r': buildSteelPiece('R', 'b'), 'b': buildSteelPiece('B', 'b'),
                'n': buildSteelPiece('N', 'b'), 'p': buildSteelPiece('P', 'b')
            };
        }

        // ── 2. NEWSPAPER THEME PIECES (Origami newsprint – distinct classic silhouettes) ──
        if (themeName === 'newspaper') {
            const buildNewspaperPiece = (type, color) => {
                const baseF  = color === 'w' ? '#f5f0e6' : '#22211f';
                const foldF  = color === 'w' ? '#ddd8ce' : '#38342f';
                const str    = color === 'w' ? '#1c1917' : '#e7e5e4';
                const accentF = color === 'w' ? '#a8a29e' : '#78716c';
                // Unique pattern ID per color to avoid SVG namespace collisions
                const pid = color === 'w' ? 'np-w' : 'np-b';
                const defs = `<defs>
                    <pattern id="${pid}" width="6" height="6" patternUnits="userSpaceOnUse">
                        <line x1="0" y1="2" x2="6" y2="2" stroke="${accentF}" stroke-width="0.7"/>
                        <line x1="0" y1="5" x2="6" y2="5" stroke="${accentF}" stroke-width="0.5"/>
                    </pattern>
                </defs>`;
                const pp = `url(#${pid})`;

                let body = '';
                switch (type) {
                    // ── KING ── tall column + flat crown plate + bold cross
                    case 'K':
                        body = `
                            <!-- base -->
                            <rect x="8"  y="36" width="29" height="4" rx="2" fill="${foldF}" stroke="${str}" stroke-width="1.2"/>
                            <rect x="10" y="33" width="25" height="3"  rx="1" fill="${baseF}" stroke="${str}" stroke-width="1"/>
                            <!-- column body -->
                            <path d="M 14 33 C 14 25 18 23 18 19 L 27 19 C 27 23 31 25 31 33 Z" fill="${baseF}" stroke="${str}" stroke-width="1.3"/>
                            <path d="M 15 33 C 15 26 19 24 19 20 L 26 20 C 26 24 30 26 30 33 Z" fill="${pp}"/>
                            <!-- neck disc -->
                            <ellipse cx="22.5" cy="19" rx="5.5" ry="1.8" fill="${foldF}" stroke="${str}" stroke-width="1"/>
                            <!-- crown platform -->
                            <rect x="12" y="13" width="21" height="6" rx="1.5" fill="${foldF}" stroke="${str}" stroke-width="1.3"/>
                            <!-- bold cross -->
                            <rect x="21" y="4"  width="3"  height="9"  rx="1" fill="${str}"/>
                            <rect x="17" y="7"  width="11" height="3"  rx="1" fill="${str}"/>
                        `;
                        break;

                    // ── QUEEN ── column + 5-spike crown
                    case 'Q':
                        body = `
                            <rect x="8"  y="36" width="29" height="4" rx="2" fill="${foldF}" stroke="${str}" stroke-width="1.2"/>
                            <rect x="10" y="33" width="25" height="3"  rx="1" fill="${baseF}" stroke="${str}" stroke-width="1"/>
                            <path d="M 14 33 C 14 25 18 23 18 19 L 27 19 C 27 23 31 25 31 33 Z" fill="${baseF}" stroke="${str}" stroke-width="1.3"/>
                            <path d="M 15 33 C 15 26 19 24 19 20 L 26 20 C 26 24 30 26 30 33 Z" fill="${pp}"/>
                            <ellipse cx="22.5" cy="19" rx="5.5" ry="1.8" fill="${foldF}" stroke="${str}" stroke-width="1"/>
                            <!-- 5-spike crown -->
                            <polygon points="10,16 13,10 16.5,14 19,8 22.5,6 26,8 28.5,14 32,10 35,16" fill="${foldF}" stroke="${str}" stroke-width="1.3"/>
                            <!-- crown base bar -->
                            <rect x="10" y="14" width="25" height="3" rx="1" fill="${foldF}" stroke="${str}" stroke-width="1"/>
                            <!-- 5 ball tips -->
                            <circle cx="10" cy="10" r="1.8" fill="${str}"/>
                            <circle cx="16" cy="8"  r="1.8" fill="${str}"/>
                            <circle cx="22.5" cy="5.5" r="2" fill="${str}"/>
                            <circle cx="29" cy="8"  r="1.8" fill="${str}"/>
                            <circle cx="35" cy="10" r="1.8" fill="${str}"/>
                        `;
                        break;

                    // ── ROOK ── wide rectangular tower + 3 clear merlons
                    case 'R':
                        body = `
                            <rect x="7"  y="36" width="31" height="4" rx="2" fill="${foldF}" stroke="${str}" stroke-width="1.2"/>
                            <rect x="10" y="33" width="25" height="3"  rx="1" fill="${baseF}" stroke="${str}" stroke-width="1"/>
                            <!-- tower shaft -->
                            <rect x="12" y="14" width="21" height="19" rx="1" fill="${baseF}" stroke="${str}" stroke-width="1.3"/>
                            <rect x="13" y="15" width="19" height="17" rx="1" fill="${pp}"/>
                            <!-- 3 merlons -->
                            <rect x="11" y="8"  width="7" height="6" rx="1" fill="${foldF}" stroke="${str}" stroke-width="1.3"/>
                            <rect x="19" y="8"  width="7" height="6" rx="1" fill="${foldF}" stroke="${str}" stroke-width="1.3"/>
                            <rect x="27" y="8"  width="7" height="6" rx="1" fill="${foldF}" stroke="${str}" stroke-width="1.3"/>
                            <!-- horizontal crease line -->
                            <line x1="12" y1="24" x2="33" y2="24" stroke="${str}" stroke-width="1"/>
                        `;
                        break;

                    // ── BISHOP ── narrow column + tall sharp mitre with slit
                    case 'B':
                        body = `
                            <rect x="9"  y="36" width="27" height="4" rx="2" fill="${foldF}" stroke="${str}" stroke-width="1.2"/>
                            <rect x="11" y="33" width="23" height="3"  rx="1" fill="${baseF}" stroke="${str}" stroke-width="1"/>
                            <path d="M 15 33 C 15 26 18 24 18 20 L 27 20 C 27 24 30 26 30 33 Z" fill="${baseF}" stroke="${str}" stroke-width="1.3"/>
                            <path d="M 16 33 C 16 27 19 25 19 21 L 26 21 C 26 25 29 27 29 33 Z" fill="${pp}"/>
                            <ellipse cx="22.5" cy="20" rx="5" ry="1.6" fill="${foldF}" stroke="${str}" stroke-width="1"/>
                            <!-- tall mitre shape -->
                            <path d="M 16 20 C 16 16 20 14 22.5 5 C 25 14 29 16 29 20 Z" fill="${foldF}" stroke="${str}" stroke-width="1.3"/>
                            <!-- mitre slit -->
                            <line x1="22.5" y1="8" x2="22.5" y2="18" stroke="${str}" stroke-width="2" stroke-linecap="round"/>
                            <!-- finial ball -->
                            <circle cx="22.5" cy="4.5" r="2.2" fill="${foldF}" stroke="${str}" stroke-width="1.3"/>
                        `;
                        break;

                    // ── KNIGHT ── proper horse-head profile (Staunton-style)
                    case 'N':
                        body = `
                            <rect x="9"  y="36" width="27" height="4" rx="2" fill="${foldF}" stroke="${str}" stroke-width="1.2"/>
                            <rect x="11" y="33" width="23" height="3"  rx="1" fill="${baseF}" stroke="${str}" stroke-width="1"/>
                            <!-- Horse head silhouette: classic left-facing Staunton profile -->
                            <path d="
                                M 15 33
                                C 15 29  14 26  15 23
                                C 16 21  17 20  17 18
                                C 14 17  12 15  13 12
                                C 14 10  16  9  18  9
                                C 18  7  19  6  21  5
                                C 24  4  28  6  30 10
                                C 32 13  31 17  29 20
                                C 28 22  27 23  28 25
                                C 29 27  30 29  31 33
                                Z
                            " fill="${baseF}" stroke="${str}" stroke-width="1.4" stroke-linejoin="round"/>
                            <!-- Newsprint texture overlay on body -->
                            <path d="
                                M 16 33 C 16 29 15 26 16 23 C 17 21 18 20 18 18
                                C 15 17 13 15 14 12 C 15 10 17 9 19 9
                                C 19 7 20 6 22 5 C 25 4 29 6 31 10
                                C 33 13 32 17 30 20 C 29 22 28 23 29 25
                                C 30 27 31 29 30 33 Z
                            " fill="${pp}" stroke="none"/>
                            <!-- Rein line (neck fold crease) -->
                            <path d="M 17 18 C 20 19 24 20 28 19" stroke="${str}" stroke-width="1" fill="none" stroke-linecap="round"/>
                            <!-- Mane (back of head) -->
                            <path d="M 21 5 C 20 8 19 12 19 16" stroke="${str}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
                            <!-- Eye -->
                            <circle cx="27" cy="11" r="2.2" fill="${str}"/>
                            <circle cx="27.6" cy="10.4" r="0.8" fill="${baseF}"/>
                            <!-- Nostril -->
                            <ellipse cx="18" cy="9" rx="1.2" ry="0.8" fill="${str}" transform="rotate(-20 18 9)"/>
                        `;
                        break;


                    // ── PAWN ── strictly fixed geometry, same size for all 8
                    case 'P':
                        body = `
                            <!-- base (wide trapezoid) -->
                            <path d="M 10 40 L 35 40 L 32 35 L 13 35 Z" fill="${foldF}" stroke="${str}" stroke-width="1.2"/>
                            <!-- stem (narrow trapezoid) -->
                            <path d="M 16 35 L 29 35 L 27 25 L 18 25 Z" fill="${baseF}" stroke="${str}" stroke-width="1.2"/>
                            <path d="M 17 34 L 28 34 L 26 26 L 19 26 Z" fill="${pp}"/>
                            <!-- neck collar -->
                            <ellipse cx="22.5" cy="25" rx="5.5" ry="1.6" fill="${foldF}" stroke="${str}" stroke-width="1"/>
                            <!-- head (circle, always same size) -->
                            <circle cx="22.5" cy="17" r="7" fill="${foldF}" stroke="${str}" stroke-width="1.3"/>
                            <circle cx="22.5" cy="17" r="5" fill="${pp}"/>
                        `;
                        break;
                }
                return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">${defs}<g>${body}</g></svg>`;
            };

            return {
                'K': buildNewspaperPiece('K', 'w'), 'Q': buildNewspaperPiece('Q', 'w'),
                'R': buildNewspaperPiece('R', 'w'), 'B': buildNewspaperPiece('B', 'w'),
                'N': buildNewspaperPiece('N', 'w'), 'P': buildNewspaperPiece('P', 'w'),
                'k': buildNewspaperPiece('K', 'b'), 'q': buildNewspaperPiece('Q', 'b'),
                'r': buildNewspaperPiece('R', 'b'), 'b': buildNewspaperPiece('B', 'b'),
                'n': buildNewspaperPiece('N', 'b'), 'p': buildNewspaperPiece('P', 'b')
            };
        }


        // ── 3. WOOD THEME PIECES (Hand-Turned Artisan Carved Wood with Woodgrain Rings) ──
        if (themeName === 'wood') {
            const buildWoodPiece = (type, color) => {
                const gid = color === 'w' ? 'wg-w' : 'wg-b';
                const str = color === 'w' ? '#78350f' : '#f59e0b';
                const ringC = color === 'w' ? '#b45309' : '#d97706';
                const fill = `url(#${gid})`;
                const defs = `<defs>
                    <linearGradient id="wg-w" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#fef08a"/>
                        <stop offset="35%" stop-color="#fde047"/>
                        <stop offset="70%" stop-color="#f59e0b"/>
                        <stop offset="100%" stop-color="#d97706"/>
                    </linearGradient>
                    <linearGradient id="wg-b" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#78350f"/>
                        <stop offset="35%" stop-color="#451a03"/>
                        <stop offset="70%" stop-color="#361402"/>
                        <stop offset="100%" stop-color="#1f0a01"/>
                    </linearGradient>
                </defs>`;

                let body = '';
                switch (type) {
                    case 'K':
                        body = `
                            <!-- Turned concentric wood base rings -->
                            <ellipse cx="22.5" cy="38" rx="14" ry="3" fill="${fill}" stroke="${str}" stroke-width="1.4"/>
                            <ellipse cx="22.5" cy="35" rx="12" ry="2.5" fill="${fill}" stroke="${str}" stroke-width="1.2"/>
                            <!-- Bulbous turned column -->
                            <path d="M 14 35 C 14 26 18 24 18 21 C 16 18 15 14 17 11 C 19 8 26 8 28 11 C 30 14 29 18 27 21 C 27 24 31 26 31 35 Z" fill="${fill}" stroke="${str}" stroke-width="1.4"/>
                            <!-- Lathe chisel ring grooves -->
                            <ellipse cx="22.5" cy="23" rx="5" ry="1.5" fill="none" stroke="${ringC}" stroke-width="1.2"/>
                            <!-- Bulbous wooden crown and finial -->
                            <ellipse cx="22.5" cy="11" rx="6" ry="3" fill="${fill}" stroke="${str}" stroke-width="1.2"/>
                            <path d="M 22.5 5 V 10 M 20 7.5 H 25" stroke="${str}" stroke-width="2" stroke-linecap="round"/>
                        `;
                        break;
                    case 'Q':
                        body = `
                            <ellipse cx="22.5" cy="38" rx="14" ry="3" fill="${fill}" stroke="${str}" stroke-width="1.4"/>
                            <ellipse cx="22.5" cy="35" rx="12" ry="2.5" fill="${fill}" stroke="${str}" stroke-width="1.2"/>
                            <path d="M 14 35 C 14 26 18 24 18 20 C 16 17 15 14 17 12 C 18 10 27 10 28 12 C 30 14 29 17 27 20 C 27 24 31 26 31 35 Z" fill="${fill}" stroke="${str}" stroke-width="1.4"/>
                            <ellipse cx="22.5" cy="22" rx="5" ry="1.5" fill="none" stroke="${ringC}" stroke-width="1.2"/>
                            <!-- Scalloped carved wooden tiara -->
                            <path d="M 14 13 C 16 9 19 14 22.5 8 C 26 14 29 9 31 13 Z" fill="${fill}" stroke="${str}" stroke-width="1.4"/>
                            <circle cx="22.5" cy="7.5" r="2" fill="${fill}" stroke="${str}" stroke-width="1.2"/>
                        `;
                        break;
                    case 'R':
                        body = `
                            <ellipse cx="22.5" cy="38" rx="14" ry="3" fill="${fill}" stroke="${str}" stroke-width="1.4"/>
                            <ellipse cx="22.5" cy="35" rx="12" ry="2.5" fill="${fill}" stroke="${str}" stroke-width="1.2"/>
                            <!-- Chunky wooden tower -->
                            <path d="M 14 35 L 15 16 L 30 16 L 31 35 Z" fill="${fill}" stroke="${str}" stroke-width="1.4"/>
                            <!-- Rounded battlements -->
                            <path d="M 13 16 L 13 10 L 17 10 L 17 13 L 21 13 L 21 10 L 24 10 L 24 13 L 28 13 L 28 10 L 32 10 L 32 16 Z" fill="${fill}" stroke="${str}" stroke-width="1.4"/>
                            <line x1="16" y1="23" x2="29" y2="23" stroke="${ringC}" stroke-width="1.2"/>
                        `;
                        break;
                    case 'B':
                        body = `
                            <ellipse cx="22.5" cy="38" rx="13" ry="3" fill="${fill}" stroke="${str}" stroke-width="1.4"/>
                            <ellipse cx="22.5" cy="35" rx="11" ry="2.5" fill="${fill}" stroke="${str}" stroke-width="1.2"/>
                            <path d="M 15 35 C 15 27 18 24 18 20 C 16 18 15 13 18 10 C 20 8 25 8 27 10 C 30 13 29 18 27 20 C 27 24 30 27 30 35 Z" fill="${fill}" stroke="${str}" stroke-width="1.4"/>
                            <!-- Carved rounded mitre slit -->
                            <path d="M 21 12 C 24 15 25 18 25 19" stroke="${str}" stroke-width="2" stroke-linecap="round"/>
                            <circle cx="22.5" cy="7" r="2" fill="${fill}" stroke="${str}" stroke-width="1.2"/>
                            <ellipse cx="22.5" cy="22" rx="4.5" ry="1.5" fill="none" stroke="${ringC}" stroke-width="1.2"/>
                        `;
                        break;
                    case 'N':
                        body = `
                            <ellipse cx="22.5" cy="38" rx="13" ry="3" fill="${fill}" stroke="${str}" stroke-width="1.4"/>
                            <ellipse cx="22.5" cy="35" rx="11" ry="2.5" fill="${fill}" stroke="${str}" stroke-width="1.2"/>
                            <!-- Sculpted wooden horse head with flowing mane -->
                            <path d="M 15 35 C 15 27 13 23 16 18 C 17 14 17 9 21 8 C 25 8 28 11 28 16 C 30 19 32 22 31 24 C 29 23 27 22 26 21 C 26 26 28 30 30 35 Z" fill="${fill}" stroke="${str}" stroke-width="1.4"/>
                            <!-- Carved wood grain mane lines -->
                            <path d="M 18 15 C 22 14 26 16 27 19" stroke="${ringC}" stroke-width="1.2" fill="none"/>
                            <circle cx="25.5" cy="14" r="1.5" fill="${str}"/>
                        `;
                        break;
                    case 'P':
                        body = `
                            <ellipse cx="22.5" cy="38" rx="12" ry="2.8" fill="${fill}" stroke="${str}" stroke-width="1.4"/>
                            <ellipse cx="22.5" cy="35" rx="10" ry="2.2" fill="${fill}" stroke="${str}" stroke-width="1.2"/>
                            <path d="M 16 35 C 16 28 19 26 19 22 L 26 22 C 26 26 29 28 29 35 Z" fill="${fill}" stroke="${str}" stroke-width="1.4"/>
                            <ellipse cx="22.5" cy="22" rx="5" ry="1.5" fill="${fill}" stroke="${str}" stroke-width="1.2"/>
                            <circle cx="22.5" cy="14" r="6" fill="${fill}" stroke="${str}" stroke-width="1.4"/>
                            <ellipse cx="22.5" cy="14" rx="4" ry="2" fill="none" stroke="${ringC}" stroke-width="1"/>
                        `;
                        break;
                }
                return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">${defs}<g>${body}</g></svg>`;
            };

            return {
                'K': buildWoodPiece('K', 'w'), 'Q': buildWoodPiece('Q', 'w'),
                'R': buildWoodPiece('R', 'w'), 'B': buildWoodPiece('B', 'w'),
                'N': buildWoodPiece('N', 'w'), 'P': buildWoodPiece('P', 'w'),
                'k': buildWoodPiece('K', 'b'), 'q': buildWoodPiece('Q', 'b'),
                'r': buildWoodPiece('R', 'b'), 'b': buildWoodPiece('B', 'b'),
                'n': buildWoodPiece('N', 'b'), 'p': buildWoodPiece('P', 'b')
            };
        }

        // ── 4. RETRO THEME PIECES (8-Bit Stepped Pixel Arcade with Neon Glow) ──
        if (themeName === 'retro') {
            const buildRetroPiece = (type, color) => {
                const neonC = color === 'w' ? '#00f5ff' : '#ff007f';
                const coreC = color === 'w' ? '#083344' : '#4a0429';
                const defs = `<defs>
                    <filter id="neon-glow-${color}" x="-30%" y="-30%" width="160%" height="160%">
                        <feDropShadow dx="0" dy="0" stdDeviation="2.2" flood-color="${neonC}" flood-opacity="0.95"/>
                    </filter>
                </defs>`;

                let body = '';
                switch (type) {
                    case 'K':
                        body = `
                            <rect x="10" y="36" width="25" height="4" fill="${neonC}"/>
                            <rect x="12" y="32" width="21" height="4" fill="${coreC}" stroke="${neonC}" stroke-width="1.5"/>
                            <rect x="15" y="24" width="15" height="8" fill="${coreC}" stroke="${neonC}" stroke-width="1.5"/>
                            <!-- Pixel Crown -->
                            <polygon points="12,24 12,14 17,19 22.5,12 28,19 33,14 33,24" fill="${coreC}" stroke="${neonC}" stroke-width="1.5"/>
                            <!-- 8-Bit Pixel Cross -->
                            <rect x="21" y="5" width="3" height="7" fill="${neonC}"/>
                            <rect x="19" y="7" width="7" height="3" fill="${neonC}"/>
                        `;
                        break;
                    case 'Q':
                        body = `
                            <rect x="10" y="36" width="25" height="4" fill="${neonC}"/>
                            <rect x="12" y="32" width="21" height="4" fill="${coreC}" stroke="${neonC}" stroke-width="1.5"/>
                            <rect x="15" y="24" width="15" height="8" fill="${coreC}" stroke="${neonC}" stroke-width="1.5"/>
                            <!-- 8-Bit Arcade Tiara -->
                            <polygon points="11,24 10,13 16,18 22.5,10 29,18 35,13 34,24" fill="${coreC}" stroke="${neonC}" stroke-width="1.5"/>
                            <rect x="9" y="10" width="3" height="3" fill="${neonC}"/>
                            <rect x="21" y="7" width="3" height="3" fill="${neonC}"/>
                            <rect x="33" y="10" width="3" height="3" fill="${neonC}"/>
                        `;
                        break;
                    case 'R':
                        body = `
                            <rect x="10" y="36" width="25" height="4" fill="${neonC}"/>
                            <rect x="13" y="20" width="19" height="16" fill="${coreC}" stroke="${neonC}" stroke-width="1.5"/>
                            <!-- 8-Bit Castle Ramparts -->
                            <rect x="11" y="10" width="5" height="10" fill="${coreC}" stroke="${neonC}" stroke-width="1.5"/>
                            <rect x="20" y="10" width="5" height="10" fill="${coreC}" stroke="${neonC}" stroke-width="1.5"/>
                            <rect x="29" y="10" width="5" height="10" fill="${coreC}" stroke="${neonC}" stroke-width="1.5"/>
                        `;
                        break;
                    case 'B':
                        body = `
                            <!-- Base & Pedestal -->
                            <rect x="9" y="36" width="27" height="4" fill="${neonC}"/>
                            <rect x="12" y="32" width="21" height="4" fill="${coreC}" stroke="${neonC}" stroke-width="1.5"/>
                            <!-- Slender Pedestal Column -->
                            <path d="M 14 32 L 16 23 L 29 23 L 31 32 Z" fill="${coreC}" stroke="${neonC}" stroke-width="1.5"/>
                            <!-- Collar Ring -->
                            <rect x="13" y="21" width="19" height="3" fill="${neonC}"/>
                            <!-- Classic Arched Mitre (Bishop Hat) -->
                            <path d="M 14 21 C 14 12 18 7 22.5 7 C 27 7 31 12 31 21 Z" fill="${coreC}" stroke="${neonC}" stroke-width="1.6"/>
                            <!-- Deep Diagonal Mitre Slash (Clear Bishop Cut) -->
                            <line x1="17" y1="12" x2="26" y2="20" stroke="${neonC}" stroke-width="2.5" stroke-linecap="round"/>
                            <!-- Glowing Top Finial Ball -->
                            <circle cx="22.5" cy="4.5" r="2.5" fill="${neonC}"/>
                            <circle cx="22.5" cy="4.5" r="1" fill="${coreC}"/>
                            <!-- Center Accent Jewel -->
                            <rect x="21" y="25" width="3" height="3" fill="${neonC}"/>
                        `;
                        break;
                    case 'N':
                        body = `
                            <!-- Base & Pedestal -->
                            <rect x="9" y="36" width="27" height="4" fill="${neonC}"/>
                            <rect x="12" y="32" width="21" height="4" fill="${coreC}" stroke="${neonC}" stroke-width="1.5"/>
                            <!-- Iconic Stepped Mane & Horse Silhouette -->
                            <path d="M 14 32 L 14 18 L 18 9 L 20 4 L 23 9 L 27 12 L 35 16 L 36 22 L 29 24 L 29 26 L 24 26 L 25 32 Z" fill="${coreC}" stroke="${neonC}" stroke-width="1.6" stroke-linejoin="bevel"/>
                            <!-- Stepped 8-bit Pixel Mane Crests -->
                            <rect x="10" y="14" width="4" height="4" fill="${neonC}"/>
                            <rect x="10" y="20" width="4" height="4" fill="${neonC}"/>
                            <rect x="10" y="26" width="4" height="4" fill="${neonC}"/>
                            <!-- Sharp Pointed Horse Ear -->
                            <polygon points="19,8 21,3 23,8" fill="${neonC}"/>
                            <!-- Glowing Arcade Pixel Eye -->
                            <rect x="24" y="13" width="3" height="3" fill="${neonC}"/>
                            <!-- Horse Snout Nostril / Mouth Slit -->
                            <rect x="31" y="19" width="4" height="2" fill="${neonC}"/>
                            <!-- Chest Contour Line -->
                            <line x1="23" y1="26" x2="25" y2="32" stroke="${neonC}" stroke-width="1.5"/>
                        `;
                        break;
                    case 'P':
                        body = `
                            <rect x="12" y="36" width="21" height="4" fill="${neonC}"/>
                            <rect x="15" y="26" width="15" height="10" fill="${coreC}" stroke="${neonC}" stroke-width="1.5"/>
                            <rect x="18" y="22" width="9" height="4" fill="${neonC}"/>
                            <!-- Pixel Head -->
                            <rect x="17" y="10" width="11" height="12" fill="${coreC}" stroke="${neonC}" stroke-width="1.5"/>
                            <rect x="20" y="13" width="5" height="6" fill="${neonC}"/>
                        `;
                        break;
                }
                return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">${defs}<g filter="url(#neon-glow-${color})">${body}</g></svg>`;
            };

            return {
                'K': buildRetroPiece('K', 'w'), 'Q': buildRetroPiece('Q', 'w'),
                'R': buildRetroPiece('R', 'w'), 'B': buildRetroPiece('B', 'w'),
                'N': buildRetroPiece('N', 'w'), 'P': buildRetroPiece('P', 'w'),
                'k': buildRetroPiece('K', 'b'), 'q': buildRetroPiece('Q', 'b'),
                'r': buildRetroPiece('R', 'b'), 'b': buildRetroPiece('B', 'b'),
                'n': buildRetroPiece('N', 'b'), 'p': buildRetroPiece('P', 'b')
            };
        }

        // ── 5. CYBER THEME PIECES (Neon Sci-Fi Cyberpunk Mecha with Circuit Traces) ──
        if (themeName === 'cyber') {
            const buildCyberPiece = (type, color) => {
                const neonC = color === 'w' ? '#00f5ff' : '#ff007f';
                const coreC = color === 'w' ? '#041527' : '#1e0416';
                const glowC = color === 'w' ? 'rgba(0,245,255,0.95)' : 'rgba(255,0,127,0.95)';
                const accent = color === 'w' ? '#00ffaa' : '#ffea00';
                const defs = `<defs>
                    <filter id="cyb-sh-${color}" x="-30%" y="-30%" width="160%" height="160%">
                        <feDropShadow dx="0" dy="0" stdDeviation="2.4" flood-color="${glowC}" flood-opacity="0.95"/>
                    </filter>
                    <filter id="cyb-redeye-${color}" x="-80%" y="-80%" width="360%" height="360%">
                        <feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="#ff0000" flood-opacity="1"/>
                        <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#ff0000" flood-opacity="0.6"/>
                    </filter>
                    <linearGradient id="cyb-g-${color}" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="${color === 'w' ? '#0d2847' : '#3d082e'}"/>
                        <stop offset="100%" stop-color="${coreC}"/>
                    </linearGradient>
                </defs>`;
                const fill = `url(#cyb-g-${color})`;

                let body = '';
                switch (type) {
                    case 'K':
                        body = `
                            <path d="M 8 38 L 37 38 L 35 41 L 10 41 Z" fill="${neonC}"/>
                            <rect x="8" y="34" width="29" height="4" rx="1" fill="${fill}" stroke="${neonC}" stroke-width="1.4"/>
                            <!-- Cyber Armor Torso -->
                            <path d="M 12 34 L 14 22 L 18 20 L 17 12 L 28 12 L 27 20 L 31 22 L 33 34 Z" fill="${fill}" stroke="${neonC}" stroke-width="1.6"/>
                            <!-- Crown Prongs -->
                            <polygon points="13,12 11,6 18,10 22.5,4 27,10 34,6 32,12" fill="${fill}" stroke="${neonC}" stroke-width="1.4"/>
                            <!-- Center Cyber Reactor Core -->
                            <polygon points="22.5,18 26,23 22.5,28 19,23" fill="${accent}" stroke="${neonC}" stroke-width="1"/>
                            <!-- Circuit lines -->
                            <line x1="15" y1="26" x2="19" y2="26" stroke="${neonC}" stroke-width="1.2"/>
                            <line x1="26" y1="26" x2="30" y2="26" stroke="${neonC}" stroke-width="1.2"/>
                            <!-- Top Laser Antenna -->
                            <circle cx="22.5" cy="3.5" r="1.8" fill="${accent}"/>
                        `;
                        break;
                    case 'Q':
                        body = `
                            <path d="M 8 38 L 37 38 L 35 41 L 10 41 Z" fill="${neonC}"/>
                            <rect x="8" y="34" width="29" height="4" rx="1" fill="${fill}" stroke="${neonC}" stroke-width="1.4"/>
                            <path d="M 11 34 L 14 20 L 17 16 L 22.5 12 L 28 16 L 31 20 L 34 34 Z" fill="${fill}" stroke="${neonC}" stroke-width="1.6"/>
                            <!-- 5-Point Cyber Tiara -->
                            <polygon points="10,18 8,9 15,14 22.5,6 30,14 37,9 35,18" fill="${fill}" stroke="${neonC}" stroke-width="1.4"/>
                            <circle cx="8" cy="8" r="1.5" fill="${accent}"/>
                            <circle cx="15" cy="13" r="1.5" fill="${accent}"/>
                            <circle cx="22.5" cy="5" r="2" fill="${accent}"/>
                            <circle cx="30" cy="13" r="1.5" fill="${accent}"/>
                            <circle cx="37" cy="8" r="1.5" fill="${accent}"/>
                            <!-- Energy Diamond -->
                            <polygon points="22.5,19 25.5,24 22.5,29 19.5,24" fill="${accent}" stroke="${neonC}" stroke-width="1"/>
                        `;
                        break;
                    case 'R':
                        body = `
                            <path d="M 7 39 L 38 39 L 36 42 L 9 42 Z" fill="${neonC}"/>
                            <rect x="7" y="35" width="31" height="4" rx="1" fill="${fill}" stroke="${neonC}" stroke-width="1.5"/>
                            <!-- Fortress Outer Walls -->
                            <path d="M 11 35 L 11 18 L 34 18 L 34 35 Z" fill="${fill}" stroke="${neonC}" stroke-width="1.6"/>
                            <!-- Energy Shield Horizontal Band -->
                            <rect x="11" y="26" width="23" height="3" fill="none" stroke="${accent}" stroke-width="1.2"/>
                            <!-- Inner Core Reactor -->
                            <rect x="18" y="20" width="9" height="6" rx="1" fill="${fill}" stroke="${accent}" stroke-width="1.2"/>
                            <circle cx="22.5" cy="23" r="2" fill="${accent}"/>
                            <!-- Angular Battlements with stepped profile -->
                            <polygon points="8,18 8,6 13,6 13,10 15,10 15,6 20,6 20,10 22,10 22,6 23,6 23,10 25,10 25,6 30,6 30,10 32,10 32,6 37,6 37,18" fill="${fill}" stroke="${neonC}" stroke-width="1.5"/>
                            <!-- Cannon Barrel Slits -->
                            <line x1="14" y1="8" x2="14" y2="6" stroke="${accent}" stroke-width="2" stroke-linecap="square"/>
                            <line x1="22.5" y1="4" x2="22.5" y2="6" stroke="${accent}" stroke-width="2.5" stroke-linecap="square"/>
                            <line x1="31" y1="8" x2="31" y2="6" stroke="${accent}" stroke-width="2" stroke-linecap="square"/>
                            <!-- Laser Emitting Vertical Slits on Body -->
                            <line x1="14" y1="19" x2="14" y2="25" stroke="${accent}" stroke-width="1.5" stroke-linecap="round"/>
                            <line x1="31" y1="19" x2="31" y2="25" stroke="${accent}" stroke-width="1.5" stroke-linecap="round"/>
                            <line x1="14" y1="29" x2="14" y2="34" stroke="${neonC}" stroke-width="1.5" stroke-linecap="round"/>
                            <line x1="31" y1="29" x2="31" y2="34" stroke="${neonC}" stroke-width="1.5" stroke-linecap="round"/>
                        `;
                        break;
                    case 'B':
                        body = `
                            <path d="M 9 38 L 36 38 L 34 41 L 11 41 Z" fill="${neonC}"/>
                            <rect x="9" y="34" width="27" height="4" rx="1" fill="${fill}" stroke="${neonC}" stroke-width="1.4"/>
                            <!-- Wide Armored Pedestal -->
                            <path d="M 12 34 L 15 25 L 30 25 L 33 34 Z" fill="${fill}" stroke="${neonC}" stroke-width="1.5"/>
                            <!-- Cyber Power Ring at Collar -->
                            <rect x="12" y="23" width="21" height="3" rx="1" fill="${neonC}"/>
                            <!-- Streamlined Aerodynamic Mitre Helmet -->
                            <path d="M 15 23 L 19 12 L 22.5 5 L 26 12 L 30 23 Z" fill="${fill}" stroke="${neonC}" stroke-width="1.6"/>
                            <!-- Diagonal armor plates on helmet -->
                            <line x1="16" y1="21" x2="21" y2="10" stroke="${accent}" stroke-width="1.2"/>
                            <line x1="24" y1="10" x2="29" y2="21" stroke="${accent}" stroke-width="1.2"/>
                            <!-- Holographic Visor Panel (wide horizontal slit) -->
                            <rect x="17" y="15" width="11" height="3.5" rx="1" fill="${accent}" opacity="0.9"/>
                            <rect x="18.5" y="15.7" width="8" height="2" rx="0.5" fill="#ffffff" opacity="0.4"/>
                            <!-- Energy Finial Orb with star burst -->
                            <circle cx="22.5" cy="4" r="2.5" fill="${accent}"/>
                            <line x1="22.5" y1="1" x2="22.5" y2="7" stroke="${neonC}" stroke-width="1" stroke-linecap="round"/>
                            <line x1="19.5" y1="4" x2="25.5" y2="4" stroke="${neonC}" stroke-width="1" stroke-linecap="round"/>
                            <!-- Side energy vents -->
                            <rect x="13" y="27" width="3" height="5" rx="0.5" fill="${accent}" opacity="0.7"/>
                            <rect x="29" y="27" width="3" height="5" rx="0.5" fill="${accent}" opacity="0.7"/>
                        `;
                        break;
                    case 'N':
                        body = `
                            <path d="M 9 38 L 36 38 L 34 41 L 11 41 Z" fill="${neonC}"/>
                            <rect x="9" y="34" width="27" height="4" rx="1" fill="${fill}" stroke="${neonC}" stroke-width="1.4"/>
                            <!-- Angular Mecha-Steed Horse Head -->
                            <path d="M 13 34 L 13 22 L 15 15 L 18 8 L 22 5 L 25 10 L 30 13 L 36 17 L 35 24 L 28 25 L 27 27 L 23 27 L 25 34 Z" fill="${fill}" stroke="${neonC}" stroke-width="1.6"/>
                            <!-- Armored Mane Conduit Plates -->
                            <path d="M 13 19 L 18 16 M 13 25 L 19 22 M 14 30 L 21 27" stroke="${accent}" stroke-width="1.5"/>
                            <!-- Pointed Mecha Ear -->
                            <polygon points="20,8 22,3 24,8" fill="${accent}"/>
                            <!-- Glowing Cyber Optic Eye -->
                            <polygon points="25,14 29,14 27,17" fill="${accent}"/>
                            <!-- Muzzle Laser Vent -->
                            <line x1="31" y1="20" x2="35" y2="20" stroke="${neonC}" stroke-width="1.5"/>
                        `;
                        break;
                    case 'P':
                        body = `
                            <path d="M 11 38 L 34 38 L 32 41 L 13 41 Z" fill="${neonC}"/>
                            <rect x="11" y="34" width="23" height="4" rx="1" fill="${fill}" stroke="${neonC}" stroke-width="1.4"/>
                            <!-- Scout Drone Pedestal -->
                            <path d="M 15 34 L 17 22 L 28 22 L 30 34 Z" fill="${fill}" stroke="${neonC}" stroke-width="1.5"/>
                            <!-- Spherical Energy Core Head -->
                            <circle cx="22.5" cy="13.5" r="7.5" fill="${fill}" stroke="${neonC}" stroke-width="1.6"/>
                            <!-- Glowing HUD Visor Strip -->
                            <rect x="17" y="11.5" width="11" height="3.5" rx="1.5" fill="${accent}" opacity="0.85"/>
                            <!-- RED 4-pointed star glowing eye (center of visor) -->
                            <polygon points="22.5,9.5 23.3,12.8 26.5,13.3 23.3,14.2 22.5,17.5 21.7,14.2 18.5,13.3 21.7,12.8" fill="#ff1a1a" stroke="#ff0000" stroke-width="0.5"/>
                            <circle cx="22.5" cy="13.3" r="1.2" fill="#ff0000"/>
                            <circle cx="22.5" cy="13.3" r="0.5" fill="#ffffff" opacity="0.9"/>
                        `;
                        break;
                }
                if (type === 'P') {
                    // Split pawn into base body (neon glow) + star eye (red glow)
                    const starEye = `<polygon points="22.5,9.5 23.3,12.8 26.5,13.3 23.3,14.2 22.5,17.5 21.7,14.2 18.5,13.3 21.7,12.8" fill="#ff1a1a" stroke="#ff0000" stroke-width="0.5"/><circle cx="22.5" cy="13.3" r="1.2" fill="#ff0000"/><circle cx="22.5" cy="13.3" r="0.5" fill="#ffffff" opacity="0.9"/>`;
                    const baseBody = body.replace(starEye, '');
                    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">${defs}<g filter="url(#cyb-sh-${color})">${baseBody}</g><g filter="url(#cyb-redeye-${color})">${starEye}</g></svg>`;
                }
                return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">${defs}<g filter="url(#cyb-sh-${color})">${body}</g></svg>`;
            };

            return {
                'K': buildCyberPiece('K', 'w'), 'Q': buildCyberPiece('Q', 'w'),
                'R': buildCyberPiece('R', 'w'), 'B': buildCyberPiece('B', 'w'),
                'N': buildCyberPiece('N', 'w'), 'P': buildCyberPiece('P', 'w'),
                'k': buildCyberPiece('K', 'b'), 'q': buildCyberPiece('Q', 'b'),
                'r': buildCyberPiece('R', 'b'), 'b': buildCyberPiece('B', 'b'),
                'n': buildCyberPiece('N', 'b'), 'p': buildCyberPiece('P', 'b')
            };
        }

        // ── 5. CRIMSON THEME PIECES (Regal Imperial Staunton with Ruby Gems & Gold) ──
        const buildCrimsonPiece = (type, color) => {
            const fill = color === 'w' ? '#ffffff' : '#991b1b';
            const str = color === 'w' ? '#881337' : '#ffffff';
            const gem = color === 'w' ? '#e11d48' : '#fbbf24';
            const inS = color === 'w' ? '#881337' : '#ffffff';

            switch (type) {
                case 'K':
                    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="none" fill-rule="evenodd" stroke="${str}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 11.63V5M19 7.5h7" stroke="${gem}" stroke-width="2" stroke-linejoin="miter"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill="${fill}" stroke-linecap="butt"/><path d="M11.5 37c5.5 3.5 16.5 3.5 22 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-17 4V21c-3.5-7.5-13-10.5-17-4-3 6 6 10.5 6 10.5v7z" fill="${fill}"/><circle cx="22.5" cy="18" r="2.2" fill="${gem}"/><path d="M11.5 30c5.5-3 16.5-3 22 0M11.5 33.5c5.5-3 16.5-3 22 0M11.5 37c5.5-3 16.5-3 22 0" stroke="${inS}"/></g></svg>`;
                case 'Q':
                    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="${fill}" fill-rule="evenodd" stroke="${str}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14l2 12z"/><path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 2-1 .5-2.5 0 0 0-1.5-1.5-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z"/><circle cx="6" cy="12" r="2" fill="${gem}"/><circle cx="14" cy="9" r="2" fill="${gem}"/><circle cx="22.5" cy="8" r="2.5" fill="${gem}"/><circle cx="31" cy="9" r="2" fill="${gem}"/><circle cx="39" cy="12" r="2" fill="${gem}"/><path d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0" fill="none" stroke="${inS}"/></g></svg>`;
                case 'R':
                    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="${fill}" fill-rule="evenodd" stroke="${str}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5" stroke-linecap="butt"/><path d="M34 14l-3 3H14l-3-3"/><path d="M31 17v12.5H14V17" stroke-linecap="butt" stroke-linejoin="miter"/><path d="M31 29.5l1.5 2.5h-20l1.5-2.5"/><path d="M11 14h23"/><circle cx="22.5" cy="23" r="2.2" fill="${gem}"/><path d="M12 35.5h21M13 31.5h19M14 29.5h17M14 16.5h17M11 13.5h23" fill="none" stroke="${inS}" stroke-width="1"/></g></svg>`;
                case 'B':
                    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="none" fill-rule="evenodd" stroke="${str}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.35.49-2.32.47-3-.5 1.35-1.46 3-2 3-2z" fill="${fill}" stroke-linecap="butt"/><path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z" fill="${fill}"/><circle cx="22.5" cy="18" r="2" fill="${gem}"/><circle cx="25" cy="8" r="2.5" fill="${gem}"/><path d="M17.5 26h10M15 30h15M22.5 15.5v5M20 18h5" stroke="${inS}"/></g></svg>`;
                case 'N':
                    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="none" fill-rule="evenodd" stroke="${str}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="${fill}"/><path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0-.64 1.69-2 2-1 .23-1.64-1.25-2-2-1.5-3.5 2-8 3-10 1-2 1-3.5 1-3.5 1-1.5 3-2 3-2s-.5 1.5.5 2.5 3.5 1.5 4.5 2.5c2 2 4.5 1.5 5 1z" fill="${fill}"/><circle cx="9.5" cy="25.5" r="0.9" fill="${gem}"/></g></svg>`;
                case 'P':
                    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="${fill}" stroke="${str}" stroke-width="1.6" stroke-linecap="round"><path d="M22 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38-1.95 1.12-3.28 3.21-3.28 5.62 0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h25c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"/><circle cx="22" cy="13" r="2.2" fill="${gem}"/></g></svg>`;
            }
        };

        return {
            'K': buildCrimsonPiece('K', 'w'), 'Q': buildCrimsonPiece('Q', 'w'),
            'R': buildCrimsonPiece('R', 'w'), 'B': buildCrimsonPiece('B', 'w'),
            'N': buildCrimsonPiece('N', 'w'), 'P': buildCrimsonPiece('P', 'w'),
            'k': buildCrimsonPiece('K', 'b'), 'q': buildCrimsonPiece('Q', 'b'),
            'r': buildCrimsonPiece('R', 'b'), 'b': buildCrimsonPiece('B', 'b'),
            'n': buildCrimsonPiece('N', 'b'), 'p': buildCrimsonPiece('P', 'b')
        };
    }

    loadPieces(themeName = this.theme) {
        const svgPieces = this.getThemeSvgPieces(themeName);
        let loadedCount = 0;
        const total = Object.keys(svgPieces).length;

        for (const [key, svg] of Object.entries(svgPieces)) {
            const img = new Image();
            const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            img.onload = () => {
                loadedCount++;
                if (loadedCount === total) {
                    this.render();
                }
            };
            img.src = url;
            this.pieceImages[key] = img;
        }
    }

    setTheme(themeName) {
        if (this.themes[themeName]) {
            this.theme = themeName;
            this.loadPieces(themeName);
            this.render();
            // Start continuous animation loop for cyber theme (animated gradient borders)
            if (themeName === 'cyber') {
                if (!this._cyberAnimating) {
                    this._cyberAnimating = true;
                    const cyberLoop = () => {
                        if (!this._cyberAnimating || this.theme !== 'cyber') {
                            this._cyberAnimating = false;
                            return;
                        }
                        this.render();
                        requestAnimationFrame(cyberLoop);
                    };
                    requestAnimationFrame(cyberLoop);
                }
            } else {
                this._cyberAnimating = false;
            }
        }
    }

    flipBoard() {
        this.flipped = !this.flipped;
        this.render();
    }

    // Convert row, col to canvas pixel coordinates
    toPixel(r, c) {
        const displayCol = this.flipped ? 7 - c : c;
        const displayRow = this.flipped ? 7 - r : r;
        return {
            x: displayCol * this.squareSize,
            y: displayRow * this.squareSize
        };
    }

    // Convert canvas pixel coordinates to board row, col
    toBoard(x, y) {
        const c = Math.floor(x / this.squareSize);
        const r = Math.floor(y / this.squareSize);
        if (c < 0 || c > 7 || r < 0 || r > 7) return null;
        return {
            r: this.flipped ? 7 - r : r,
            c: this.flipped ? 7 - c : c
        };
    }

    resize(containerWidth) {
        // Leave room for padding on mobile
        const maxW = Math.min(containerWidth, 540);
        this.boardSize = Math.floor(maxW);
        this.squareSize = this.boardSize / 8;

        this.dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.boardSize * this.dpr;
        this.canvas.height = this.boardSize * this.dpr;
        this.canvas.style.width = `${this.boardSize}px`;
        this.canvas.style.height = `${this.boardSize}px`;

        this.render();
    }

    bindEvents() {
        // Mouse Events
        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.handlePointerDown(e.clientX - rect.left, e.clientY - rect.top);
        });
        window.addEventListener('mousemove', (e) => {
            if (this.draggingPiece) {
                const rect = this.canvas.getBoundingClientRect();
                this.handlePointerMove(e.clientX - rect.left, e.clientY - rect.top);
            }
        });
        window.addEventListener('mouseup', (e) => {
            if (this.draggingPiece) {
                const rect = this.canvas.getBoundingClientRect();
                this.handlePointerUp(e.clientX - rect.left, e.clientY - rect.top);
            }
        });

        // Touch Events (Mobile First with passive: false to prevent scrolling)
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.handlePointerDown(touch.clientX - rect.left, touch.clientY - rect.top);
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (this.draggingPiece) {
                const touch = e.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                this.handlePointerMove(touch.clientX - rect.left, touch.clientY - rect.top);
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (this.draggingPiece) {
                const touch = e.changedTouches[0];
                const rect = this.canvas.getBoundingClientRect();
                this.handlePointerUp(touch.clientX - rect.left, touch.clientY - rect.top);
            }
        }, { passive: false });

        this.canvas.addEventListener('touchcancel', () => {
            this.draggingPiece = null;
            this.render();
        });
    }

    handlePointerDown(x, y) {
        if (this.isBusy) return;
        if (this.isTurnAllowed && !this.isTurnAllowed()) return;

        const square = this.toBoard(x, y);
        if (!square) return;

        // If player previously clicked a piece and now clicked on a legal destination move
        if (this.selectedSquare) {
            const matchedMove = this.legalMoves.find(m => m.to.r === square.r && m.to.c === square.c);
            if (matchedMove) {
                this.executeMoveWithPromotionCheck(matchedMove);
                this.selectedSquare = null;
                this.legalMoves = [];
                return;
            }
        }

        // Gizli AI: Kullanıcı doğrudan önerilen hedefe (cyan daireye) tıklarsa/dokunursa hamleyi anında yap
        if (!this.selectedSquare && this.secretHint && square.r === this.secretHint.to.r && square.c === this.secretHint.to.c) {
            const moves = this.engine.getLegalMovesForSquare(this.secretHint.from.r, this.secretHint.from.c);
            const matchedMove = moves.find(m => m.to.r === square.r && m.to.c === square.c);
            if (matchedMove) {
                this.executeMoveWithPromotionCheck(matchedMove);
                this.selectedSquare = null;
                this.legalMoves = [];
                return;
            }
        }

        const piece = this.engine.board[square.r][square.c];
        if (piece && this.engine.getPieceColor(piece) === this.engine.turn) {
            this.selectedSquare = square;
            this.legalMoves = this.engine.getLegalMovesForSquare(square.r, square.c);

            this.draggingPiece = {
                piece,
                r: square.r,
                c: square.c,
                x,
                y,
                startX: x,
                startY: y
            };
        } else {
            this.selectedSquare = null;
            this.legalMoves = [];
        }

        this.render();
    }

    handlePointerMove(x, y) {
        if (this.isBusy || !this.draggingPiece) return;
        this.draggingPiece.x = x;
        this.draggingPiece.y = y;
        this.render();
    }

    handlePointerUp(x, y) {
        if (this.isBusy || !this.draggingPiece) {
            this.draggingPiece = null;
            return;
        }

        const targetSquare = this.toBoard(x, y);
        const dist = Math.hypot(this.draggingPiece.x - this.draggingPiece.startX, this.draggingPiece.y - this.draggingPiece.startY);

        // If it was a deliberate drag to a different square
        if (dist > 15 && targetSquare) {
            const matchedMove = this.legalMoves.find(m => m.to.r === targetSquare.r && m.to.c === targetSquare.c);
            if (matchedMove) {
                this.executeMoveWithPromotionCheck(matchedMove);
                this.selectedSquare = null;
                this.legalMoves = [];
            }
        }

        this.draggingPiece = null;
        this.render();
    }

    executeMoveWithPromotionCheck(move) {
        const piece = this.engine.board[move.from.r][move.from.c];
        const color = this.engine.getPieceColor(piece);
        const isPawn = piece && piece.toUpperCase() === 'P';
        const isPromotionRank = (color === 'w' && move.to.r === 0) || (color === 'b' && move.to.r === 7);

        if (isPawn && isPromotionRank) {
            // Need promotion choice! Trigger callback
            if (this.onPromotionNeeded) {
                this.onPromotionNeeded(move, color, (chosenPiece) => {
                    const finalMove = { ...move, promotion: chosenPiece };
                    this.onMoveCallback(finalMove);
                });
                return;
            }
        }

        this.onMoveCallback(move);
    }

    // Smooth piece sliding animation — callback is GUARANTEED to fire exactly once
    animateMove(move, callback) {
        const piece = this.engine.board[move.from.r][move.from.c];
        const startPix = this.toPixel(move.from.r, move.from.c);
        const endPix   = this.toPixel(move.to.r, move.to.c);

        // Guard: ensure callback fires only once even if rAF and fallback timer race
        let cbFired = false;
        const fireCallback = () => {
            if (cbFired) return;
            cbFired = true;
            this.animatingPiece = null;
            try { callback(); } catch (e) { console.error('[animateMove] callback error:', e); }
            this.render();
        };

        this.animatingPiece = {
            piece,
            fromR: move.from.r,
            fromC: move.from.c,
            toR:   move.to.r,
            toC:   move.to.c,
            startX:  startPix.x,
            startY:  startPix.y,
            targetX: endPix.x,
            targetY: endPix.y,
            startTime: performance.now(),
            duration: 160, // 160ms smooth slide
        };

        // Guaranteed fallback: if rAF never fires or gets throttled, still complete
        const fallbackTimer = setTimeout(fireCallback, 400);

        const step = (now) => {
            if (cbFired) return; // Already done via fallback
            if (!this.animatingPiece) { clearTimeout(fallbackTimer); return; }
            try {
                const elapsed  = now - this.animatingPiece.startTime;
                const progress = Math.min(elapsed / this.animatingPiece.duration, 1);
                const ease     = 1 - Math.pow(1 - progress, 3); // Ease out cubic

                this.animatingPiece.curX = this.animatingPiece.startX + (this.animatingPiece.targetX - this.animatingPiece.startX) * ease;
                this.animatingPiece.curY = this.animatingPiece.startY + (this.animatingPiece.targetY - this.animatingPiece.startY) * ease;

                this.render();

                if (progress < 1) {
                    requestAnimationFrame(step);
                } else {
                    clearTimeout(fallbackTimer);
                    fireCallback();
                }
            } catch (err) {
                console.error('[animateMove] step error:', err);
                clearTimeout(fallbackTimer);
                fireCallback();
            }
        };

        requestAnimationFrame(step);
    }

    render() {
        const ctx = this.ctx;
        const currentTheme = this.themes[this.theme];
        const sz = this.squareSize;

        ctx.save();
        ctx.scale(this.dpr, this.dpr);

        // 1. Draw Squares & Coordinates
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const displayCol = this.flipped ? 7 - c : c;
                const displayRow = this.flipped ? 7 - r : r;
                const isLight = (r + c) % 2 === 0;
                const px = displayCol * sz;
                const py = displayRow * sz;

                if (this.patterns && this.patterns[this.theme]) {
                    ctx.fillStyle = isLight ? this.patterns[this.theme].light : this.patterns[this.theme].dark;
                } else {
                    ctx.fillStyle = isLight ? currentTheme.light : currentTheme.dark;
                }
                ctx.fillRect(px, py, sz, sz);

                // Subtle tactile edge accents per theme
                if (this.theme === 'steel') {
                    // Brushed steel metallic bevel: top/left specular highlight, bottom/right bevel shadow
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = isLight ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.18)';
                    ctx.beginPath();
                    ctx.moveTo(px, py + sz);
                    ctx.lineTo(px, py);
                    ctx.lineTo(px + sz, py);
                    ctx.stroke();

                    ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.18)' : 'rgba(0, 0, 0, 0.45)';
                    ctx.beginPath();
                    ctx.moveTo(px + sz, py);
                    ctx.lineTo(px + sz, py + sz);
                    ctx.lineTo(px, py + sz);
                    ctx.stroke();
                } else if (this.theme === 'newspaper') {
                    // Vintage newsprint press tile outline
                    ctx.strokeStyle = isLight ? 'rgba(71, 85, 105, 0.16)' : 'rgba(15, 23, 42, 0.3)';
                    ctx.lineWidth = 0.8;
                    ctx.strokeRect(px + 0.5, py + 0.5, sz - 1, sz - 1);
                } else if (this.theme === 'wood') {
                    // Carved wooden board joint lines
                    ctx.strokeStyle = 'rgba(67, 20, 7, 0.22)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(px + 0.5, py + 0.5, sz - 1, sz - 1);
                } else if (this.theme === 'retro') {
                    // Glowing cyber neon micro-border
                    ctx.strokeStyle = isLight ? 'rgba(6, 182, 212, 0.22)' : 'rgba(236, 72, 153, 0.25)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(px + 0.5, py + 0.5, sz - 1, sz - 1);
                } else if (this.theme === 'cyber') {
                    // Animated color-shifting cyberpunk grid border
                    const t = (performance.now() / 2000) + (r * 0.4) + (c * 0.4);
                    const hue1 = (180 + Math.sin(t) * 60 + (r + c) * 22) % 360;
                    const hue2 = (hue1 + 120) % 360;
                    const grad = ctx.createLinearGradient(px, py, px + sz, py + sz);
                    grad.addColorStop(0, `hsla(${hue1}, 100%, 60%, 0.55)`);
                    grad.addColorStop(0.5, `hsla(${(hue1 + 60) % 360}, 100%, 70%, 0.3)`);
                    grad.addColorStop(1, `hsla(${hue2}, 100%, 60%, 0.55)`);
                    ctx.strokeStyle = grad;
                    ctx.lineWidth = 1.2;
                    ctx.strokeRect(px + 0.5, py + 0.5, sz - 1, sz - 1);
                    // Corner node dots
                    ctx.fillStyle = `hsla(${hue1}, 100%, 70%, 0.6)`;
                    ctx.fillRect(px, py, 2.5, 2.5);
                    ctx.fillRect(px + sz - 2.5, py, 2.5, 2.5);
                    ctx.fillRect(px, py + sz - 2.5, 2.5, 2.5);
                    ctx.fillRect(px + sz - 2.5, py + sz - 2.5, 2.5, 2.5);
                } else if (this.theme === 'crimson') {
                    // Regal polished lacquer outline
                    ctx.strokeStyle = isLight ? 'rgba(225, 29, 72, 0.1)' : 'rgba(0, 0, 0, 0.25)';
                    ctx.lineWidth = 0.8;
                    ctx.strokeRect(px + 0.5, py + 0.5, sz - 1, sz - 1);
                }

                // Coordinates (small subtle labels on edges)
                ctx.font = `600 ${Math.max(10, Math.floor(sz * 0.17))}px Outfit, sans-serif`;
                if (displayCol === 0) {
                    // Rank label (1-8)
                    ctx.fillStyle = isLight ? currentTheme.coordLight : currentTheme.coordDark;
                    ctx.fillText(`${8 - r}`, px + 4, py + Math.floor(sz * 0.22));
                }
                if (displayRow === 7) {
                    // File label (a-h)
                    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
                    ctx.fillStyle = isLight ? currentTheme.coordLight : currentTheme.coordDark;
                    ctx.fillText(files[c], px + sz - Math.floor(sz * 0.22), py + sz - 4);
                }
            }
        }

        // 2. Draw Last Move Highlight
        if (this.lastMove) {
            [this.lastMove.from, this.lastMove.to].forEach(sq => {
                if (sq) {
                    const p = this.toPixel(sq.r, sq.c);
                    ctx.fillStyle = currentTheme.lastMove;
                    ctx.fillRect(p.x, p.y, sz, sz);
                }
            });
        }

        // 3. Draw Selected Square Highlight
        if (this.selectedSquare) {
            const p = this.toPixel(this.selectedSquare.r, this.selectedSquare.c);
            ctx.fillStyle = currentTheme.selected;
            ctx.fillRect(p.x, p.y, sz, sz);
        }

        // 3.5 ✦ Gizli AI Hint — Hangi taşı oynatacağımızı gösteren kare vurgusu
        if (this.secretHint) {
            const pF = this.toPixel(this.secretHint.from.r, this.secretHint.from.c);
            ctx.fillStyle = 'rgba(0, 136, 255, 0.25)';
            ctx.fillRect(pF.x, pF.y, sz, sz);
            ctx.strokeStyle = '#0088ff';
            ctx.lineWidth = Math.max(2.5, sz * 0.05);
            ctx.strokeRect(pF.x + ctx.lineWidth / 2, pF.y + ctx.lineWidth / 2,
                           sz - ctx.lineWidth, sz - ctx.lineWidth);
        }        // 4. Draw King in Check Danger Glow
        if (this.engine.isKingInCheck(this.engine.turn)) {
            const kingPos = this.engine.findKing(this.engine.turn);
            if (kingPos) {
                const p = this.toPixel(kingPos.r, kingPos.c);
                const grad = ctx.createRadialGradient(
                    p.x + sz / 2, p.y + sz / 2, sz * 0.1,
                    p.x + sz / 2, p.y + sz / 2, sz * 0.65
                );
                grad.addColorStop(0, 'rgba(255, 40, 40, 0.85)');
                grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
                ctx.fillStyle = grad;
                ctx.fillRect(p.x, p.y, sz, sz);
            }
        }


        // 5. Draw Pieces on Board
        const board = this.engine.board;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                // If this piece is currently being dragged, don't draw it on square
                if (this.draggingPiece && this.draggingPiece.r === r && this.draggingPiece.c === c) {
                    continue;
                }
                // If this piece is currently animating, don't draw on square
                if (this.animatingPiece && this.animatingPiece.fromR === r && this.animatingPiece.fromC === c) {
                    continue;
                }

                const piece = board[r][c];
                if (piece && this.pieceImages[piece]) {
                    const p = this.toPixel(r, c);
                    const pad = sz * 0.08;
                    ctx.drawImage(this.pieceImages[piece], p.x + pad, p.y + pad, sz - pad * 2, sz - pad * 2);
                }
            }
        }

        // 6. Draw Legal Move Dots & Capture Target Rings
        // Deduplicate moves by destination square so promotion (4 moves, same target)
        // and other cases never draw the same square twice.
        if (this.legalMoves.length > 0) {
            const drawnSquares = new Set();
            for (const move of this.legalMoves) {
                const squareKey = `${move.to.r},${move.to.c}`;
                if (drawnSquares.has(squareKey)) continue;
                drawnSquares.add(squareKey);

                const p = this.toPixel(move.to.r, move.to.c);
                const cx = p.x + sz / 2;
                const cy = p.y + sz / 2;
                const hasTarget = !!board[move.to.r][move.to.c] || move.isEnPassant;

                if (hasTarget) {
                    // Capture Ring — outer bright ring
                    ctx.beginPath();
                    ctx.arc(cx, cy, sz * 0.44, 0, Math.PI * 2);
                    ctx.lineWidth = Math.max(4, sz * 0.09);
                    ctx.strokeStyle = currentTheme.hintCapture;
                    ctx.stroke();
                    // Inner glow highlight
                    ctx.beginPath();
                    ctx.arc(cx, cy, sz * 0.44 - Math.max(4, sz * 0.09) / 2, 0, Math.PI * 2);
                    ctx.lineWidth = 1.5;
                    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
                    ctx.stroke();
                } else {
                    // Move Dot — outer white halo for contrast on any square color
                    const dotR = sz * 0.2;
                    ctx.beginPath();
                    ctx.arc(cx, cy, dotR + 1.5, 0, Math.PI * 2);
                    ctx.fillStyle = currentTheme.hintDotGlow || 'rgba(255,255,255,0.4)';
                    ctx.fill();
                    // Inner colored dot
                    ctx.beginPath();
                    ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
                    ctx.fillStyle = currentTheme.hintDot;
                    ctx.fill();
                }
            }
        }

        // 6.5 ✦ Gizli AI Hint — Nereye oynayacağımızı gösteren Mavi Nokta (Diğer gri noktalarla birebir aynı, sadece mavi)
        if (this.secretHint) {
            const pT = this.toPixel(this.secretHint.to.r, this.secretHint.to.c);
            const cx = pT.x + sz / 2;
            const cy = pT.y + sz / 2;
            const hasTarget = !!board[this.secretHint.to.r][this.secretHint.to.c] || 
                              (this.engine.enPassant && this.secretHint.to.r === this.engine.enPassant.r && this.secretHint.to.c === this.engine.enPassant.c);

            if (hasTarget) {
                // Taş alma hamlesi: Diğer halkalarla aynı, sadece mavi
                ctx.beginPath();
                ctx.arc(cx, cy, sz * 0.44, 0, Math.PI * 2);
                ctx.lineWidth = Math.max(4, sz * 0.09);
                ctx.strokeStyle = '#0088ff';
                ctx.stroke();
                // İç hafif parlama
                ctx.beginPath();
                ctx.arc(cx, cy, sz * 0.44 - Math.max(4, sz * 0.09) / 2, 0, Math.PI * 2);
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.stroke();
            } else {
                // Normal hamle: Diğer gri noktalarla birebir aynı boyut ve yapıda, sadece mavi
                const dotR = sz * 0.2;
                ctx.beginPath();
                ctx.arc(cx, cy, dotR + 1.5, 0, Math.PI * 2);
                ctx.fillStyle = currentTheme.hintDotGlow || 'rgba(255, 255, 255, 0.4)';
                ctx.fill();

                // İç mavi nokta
                ctx.beginPath();
                ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
                ctx.fillStyle = '#0088ff';
                ctx.fill();
            }
        }

        // 7. Draw Animating Piece
        if (this.animatingPiece && this.pieceImages[this.animatingPiece.piece]) {
            const pad = sz * 0.08;
            ctx.drawImage(
                this.pieceImages[this.animatingPiece.piece],
                this.animatingPiece.curX + pad,
                this.animatingPiece.curY + pad,
                sz - pad * 2,
                sz - pad * 2
            );
        }

        // 8. Draw Dragging Piece (Floats over everything with drop shadow)
        if (this.draggingPiece && this.pieceImages[this.draggingPiece.piece]) {
            const pad = sz * 0.08;
            const w = sz * 1.15; // Slightly magnified for touch clarity
            const h = sz * 1.15;
            const drawX = this.draggingPiece.x - w / 2;
            const drawY = this.draggingPiece.y - h * 0.75; // Sits nicely above finger touch point

            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
            ctx.shadowBlur = 18;
            ctx.shadowOffsetY = 10;
            ctx.drawImage(this.pieceImages[this.draggingPiece.piece], drawX, drawY, w, h);
            ctx.restore();
        }

        ctx.restore();
    }
}

window.ChessCanvas = ChessCanvas;
