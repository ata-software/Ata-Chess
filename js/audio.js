// Procedural Sound Engine using Web Audio API
// No external audio files needed - runs 100% offline, zero latency

class ChessAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    playMove() {
        if (!this.enabled) return;
        this.init();
        const now = this.ctx.currentTime;
        
        // Warm woody click
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.09);
    }

    playCapture() {
        if (!this.enabled) return;
        this.init();
        const now = this.ctx.currentTime;

        // Punchy capture sound with thud and high click
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(450, now);
        osc1.frequency.exponentialRampToValueAtTime(60, now + 0.12);
        gain1.gain.setValueAtTime(0.6, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

        osc1.connect(gain1);
        gain1.connect(this.ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.13);

        // Noise snap
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(180, now);
        osc2.frequency.exponentialRampToValueAtTime(40, now + 0.06);
        gain2.gain.setValueAtTime(0.2, now);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

        osc2.connect(gain2);
        gain2.connect(this.ctx.destination);
        osc2.start(now);
        osc2.stop(now + 0.07);
    }

    playCheck() {
        if (!this.enabled) return;
        this.init();
        const now = this.ctx.currentTime;

        // Elegant warning chime
        [587.33, 880].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.05);

            gain.gain.setValueAtTime(0.35, now + i * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.35);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + i * 0.05);
            osc.stop(now + i * 0.05 + 0.36);
        });
    }

    playCastle() {
        if (!this.enabled) return;
        this.init();
        const now = this.ctx.currentTime;

        // Double swift slide-click
        [0, 0.09].forEach((delay, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(idx === 0 ? 280 : 360, now + delay);
            osc.frequency.exponentialRampToValueAtTime(100, now + delay + 0.07);

            gain.gain.setValueAtTime(0.35, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.07);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + delay);
            osc.stop(now + delay + 0.08);
        });
    }

    playVictory() {
        if (!this.enabled) return;
        this.init();
        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const startTime = now + idx * 0.12;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(0.4, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + 0.42);
        });
    }

    playDefeat() {
        if (!this.enabled) return;
        this.init();
        const now = this.ctx.currentTime;
        const notes = [440, 415.3, 392, 349.23]; // Descending minor

        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const startTime = now + idx * 0.14;

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(0.25, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + 0.37);
        });
    }

    playIllegal() {
        if (!this.enabled) return;
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.13);
    }
}

window.chessAudio = new ChessAudio();
