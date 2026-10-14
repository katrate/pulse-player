/**
 * PULSE AUDIO // Web Audio API Engine & 60fps Visualizer
 */

class AudioVisualizer {
  constructor() {
    this.audioCtx = null;
    this.sourceNode = null;
    this.analyser = null;
    this.bassFilter = null;
    this.midFilter = null;
    this.trebleFilter = null;
    this.dataArray = null;
    this.bufferLength = 0;

    this.canvas = document.getElementById('audioVisualizerCanvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.ambientCanvas = document.getElementById('ambientCanvas');
    this.ambientCtx = this.ambientCanvas ? this.ambientCanvas.getContext('2d') : null;

    this.mode = 'bars'; // 'bars' | 'circle' | 'particles'
    this.isRunning = false;
    this.peakBars = [];

    // Particle system for Nebula mode
    this.particles = [];
    this.numParticles = 60;
    this.discElement = document.getElementById('stageDisc');
    this.discContainer = document.getElementById('stageDiscContainer');

    this.initCanvasResize();
  }

  init(audioElement) {
    if (this.audioCtx) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();

      // Analyser node
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.82;
      this.bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(this.bufferLength);

      // 3-Band Equalizer filters
      this.bassFilter = this.audioCtx.createBiquadFilter();
      this.bassFilter.type = 'lowshelf';
      this.bassFilter.frequency.value = 100;
      this.bassFilter.gain.value = 0;

      this.midFilter = this.audioCtx.createBiquadFilter();
      this.midFilter.type = 'peaking';
      this.midFilter.frequency.value = 1000;
      this.midFilter.Q.value = 1.0;
      this.midFilter.gain.value = 0;

      this.trebleFilter = this.audioCtx.createBiquadFilter();
      this.trebleFilter.type = 'highshelf';
      this.trebleFilter.frequency.value = 8000;
      this.trebleFilter.gain.value = 0;

      // Connect graph: AudioElement -> Bass -> Mid -> Treble -> Analyser -> Destination
      this.sourceNode = this.audioCtx.createMediaElementSource(audioElement);
      this.sourceNode.connect(this.bassFilter);
      this.bassFilter.connect(this.midFilter);
      this.midFilter.connect(this.trebleFilter);
      this.trebleFilter.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);

      this.initParticles();
      this.start();
    } catch (e) {
      console.warn("Web Audio API initialization deferred or blocked by browser autoplay:", e);
    }
  }

  resume() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  setEq(bass, mid, treble) {
    if (!this.audioCtx) return;
    if (this.bassFilter) this.bassFilter.gain.value = bass;
    if (this.midFilter) this.midFilter.gain.value = mid;
    if (this.trebleFilter) this.trebleFilter.gain.value = treble;
  }

  setMode(mode) {
    this.mode = mode;
    if (this.discContainer) {
      this.discContainer.style.display = (mode === 'circle') ? 'block' : 'none';
    }
  }

  initCanvasResize() {
    const resize = () => {
      if (this.canvas) {
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = this.canvas.parentElement.clientHeight;
      }
      if (this.ambientCanvas) {
        this.ambientCanvas.width = window.innerWidth;
        this.ambientCanvas.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', resize);
    setTimeout(resize, 100);
  }

  initParticles() {
    this.particles = [];
    const w = this.canvas ? this.canvas.width : 500;
    const h = this.canvas ? this.canvas.height : 500;
    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push({
        x: w / 2 + (Math.random() - 0.5) * 80,
        y: h / 2 + (Math.random() - 0.5) * 80,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        radius: Math.random() * 3 + 1,
        color: i % 2 === 0 ? '#00f5d4' : '#7928ca',
        alpha: Math.random() * 0.7 + 0.3
      });
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    const loop = () => {
      if (this.isRunning) {
        this.render();
        requestAnimationFrame(loop);
      }
    };
    requestAnimationFrame(loop);
  }

  render() {
    if (!this.ctx || !this.analyser) return;

    this.analyser.getByteFrequencyData(this.dataArray);

    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);

    // Calculate energy levels
    let bassEnergy = 0;
    for (let i = 0; i < 12; i++) {
      bassEnergy += this.dataArray[i];
    }
    bassEnergy = bassEnergy / 12 / 255; // 0 to 1

    if (this.mode === 'bars') {
      this.renderBars(w, h);
    } else if (this.mode === 'circle') {
      this.renderCircle(w, h, bassEnergy);
    } else if (this.mode === 'particles') {
      this.renderParticles(w, h, bassEnergy);
    }

    this.renderAmbient(bassEnergy);
  }

  renderBars(w, h) {
    const bars = 48;
    const barWidth = (w / bars) * 0.7;
    const gap = (w / bars) * 0.3;
    const step = Math.floor(this.bufferLength / bars);

    for (let i = 0; i < bars; i++) {
      const val = this.dataArray[i * step] || 0;
      const barHeight = Math.max(4, (val / 255) * (h * 0.75));
      const x = i * (barWidth + gap) + gap / 2;
      const y = h - barHeight;

      // Peak cap calculation
      if (!this.peakBars[i]) this.peakBars[i] = { y: y, speed: 0 };
      if (y < this.peakBars[i].y) {
        this.peakBars[i].y = y;
        this.peakBars[i].speed = 0;
      } else {
        this.peakBars[i].speed += 0.3;
        this.peakBars[i].y += this.peakBars[i].speed;
        if (this.peakBars[i].y > h) this.peakBars[i].y = h;
      }

      // Gradient bar fill
      const grad = this.ctx.createLinearGradient(0, y, 0, h);
      grad.addColorStop(0, '#00f5d4');
      grad.addColorStop(0.5, '#7928ca');
      grad.addColorStop(1, '#090a0f');

      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
      this.ctx.fill();

      // Peak dot
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(x, this.peakBars[i].y - 3, barWidth, 2);
    }
  }

  renderCircle(w, h, bassEnergy) {
    const centerX = w / 2;
    const centerY = h / 2;
    const baseRadius = 100 + bassEnergy * 25;
    const points = 64;
    const step = Math.floor(this.bufferLength / points);

    this.ctx.save();
    this.ctx.translate(centerX, centerY);

    // Glowing outer ring
    this.ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const idx = (i % points) * step;
      const val = this.dataArray[idx] || 0;
      const r = baseRadius + (val / 255) * 55;
      const angle = (i / points) * Math.PI * 2;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.closePath();
    this.ctx.strokeStyle = '#00f5d4';
    this.ctx.lineWidth = 3;
    this.ctx.shadowColor = '#00f5d4';
    this.ctx.shadowBlur = 18;
    this.ctx.stroke();

    // Pulse disc scale
    if (this.discElement) {
      const scale = 1 + bassEnergy * 0.12;
      this.discElement.style.transform = `scale(${scale})`;
    }

    this.ctx.restore();
  }

  renderParticles(w, h, bassEnergy) {
    const cx = w / 2;
    const cy = h / 2;

    this.particles.forEach((p, idx) => {
      // Audio reaction push
      const angle = Math.atan2(p.y - cy, p.x - cx);
      const push = bassEnergy * 5;
      p.x += Math.cos(angle) * push + p.vx;
      p.y += Math.sin(angle) * push + p.vy;

      // Wrap boundaries
      if (p.x < 0 || p.x > w || p.y < 0 || p.y > h) {
        p.x = cx + (Math.random() - 0.5) * 100;
        p.y = cy + (Math.random() - 0.5) * 100;
      }

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius * (1 + bassEnergy * 1.5), 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 10;
      this.ctx.fill();

      // Connect close particles with delicate neon strings
      for (let j = idx + 1; j < this.particles.length; j++) {
        const p2 = this.particles[j];
        const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
        if (dist < 65) {
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.strokeStyle = `rgba(0, 245, 212, ${1 - dist / 65})`;
          this.ctx.lineWidth = 0.8;
          this.ctx.stroke();
        }
      }
    });
  }

  renderAmbient(bassEnergy) {
    if (!this.ambientCtx || !this.ambientCanvas) return;
    const aw = this.ambientCanvas.width;
    const ah = this.ambientCanvas.height;

    this.ambientCtx.clearRect(0, 0, aw, ah);
    const rad = 250 + bassEnergy * 180;

    const g1 = this.ambientCtx.createRadialGradient(aw * 0.75, ah * 0.3, 20, aw * 0.75, ah * 0.3, rad);
    g1.addColorStop(0, `rgba(121, 40, 202, ${0.15 + bassEnergy * 0.2})`);
    g1.addColorStop(1, 'transparent');

    this.ambientCtx.fillStyle = g1;
    this.ambientCtx.fillRect(0, 0, aw, ah);

    const g2 = this.ambientCtx.createRadialGradient(aw * 0.25, ah * 0.7, 20, aw * 0.25, ah * 0.7, rad * 0.8);
    g2.addColorStop(0, `rgba(0, 245, 212, ${0.12 + bassEnergy * 0.18})`);
    g2.addColorStop(1, 'transparent');

    this.ambientCtx.fillStyle = g2;
    this.ambientCtx.fillRect(0, 0, aw, ah);
  }
}

window.AudioVisualizer = AudioVisualizer;
