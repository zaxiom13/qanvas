/* ================================================================
   QANVAS5 — CANVAS PANEL
   Manages: p5 lifecycle, themed rendering, runtime frame playback,
            example fallback previews, input capture, and GIF export.
================================================================ */

'use strict';

/* global p5 */

let qCanvas = null;

class QanvasCanvas {
  constructor() {
    this.p5Instance = null;
    this.p = null;
    this.running = false;
    this.paused = false;
    this.frameCommands = [];
    this.showFps = false;
    this.fpsBuf = [];
    this.frameNum = 0;
    this.startTime = 0;
    this.demoPreset = 'default';
    this.demoState = this._createEmptyDemoState();

    this.input = {
      mouse: null,
      mouseButtons: { left: false, middle: false, right: false },
      scroll: [0, 0],
      key: '',
      keys: new Set(),
    };

    this.gifRecording = false;
    this.gifFrames = [];
    this.gifDuration = 0;
    this.gifStartFrame = 0;
    this.gifTargetFrames = 0;

    this._init();
  }

  _init() {
    const container = document.getElementById('canvas-container');
    const self = this;

    const sketch = (p) => {
      self.p = p;

      p.setup = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        const canvas = p.createCanvas(w, h);
        canvas.parent('canvas-container');
        canvas.style('display', 'block');
        self._drawSepiaBackground();
        p.noLoop();
        self._updateSizeLabel(w, h);
        p.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
      };

      p.draw = () => {
        if (!self.running || self.paused) return;
        self._processFrame();
      };

      p.windowResized = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        p.resizeCanvas(w, h);
        self._updateSizeLabel(w, h);
        if (!self.running) self._drawSepiaBackground();
      };

      p.mouseMoved = () => self._updateMouse(p);
      p.mouseDragged = () => {
        self._updateMouse(p);
        self._handleDemoDrag();
      };
      p.mousePressed = () => self._onMousePress(p);
      p.mouseReleased = () => self._onMouseRelease(p);
      p.mouseOut = () => self._onMouseOut();
      p.mouseWheel = (event) => self._onScroll(event);
      p.keyPressed = () => self._onKeyPress(p);
      p.keyReleased = () => self._onKeyRelease(p);
    };

    this.p5Instance = new p5(sketch);
  }

  run() {
    this.running = true;
    this.paused = false;
    this.frameNum = 0;
    this.startTime = performance.now();
    this.fpsBuf = [];
    this._resetDemoState();
    this.p5Instance.loop();
  }

  stop() {
    this.running = false;
    this.paused = false;
    this.frameCommands = [];
    this.p5Instance.noLoop();
    this._drawSepiaBackground();
  }

  pause() {
    this.paused = true;
    this.p5Instance.noLoop();
  }

  resume() {
    this.paused = false;
    this.p5Instance.loop();
  }

  reset() {
    this.frameNum = 0;
    this.startTime = performance.now();
    this.fpsBuf = [];
    this.frameCommands = [];
    this._resetDemoState();
    this._drawSepiaBackground();
    this.running = true;
    this.paused = false;
    if (!this.p5Instance.isLooping()) this.p5Instance.loop();
  }

  setShowFps(val) {
    this.showFps = val;
  }

  setDemoPreset(preset) {
    this.demoPreset = preset || 'default';
    this.frameCommands = [];
    this._resetDemoState();
    if (!this.running) {
      this._drawSepiaBackground();
    }
  }

  receiveFrame(jsonStr) {
    try {
      const commands = JSON.parse(jsonStr);
      if (Array.isArray(commands)) {
        this.frameCommands = commands;
      }
    } catch {
      this.frameCommands = [];
    }
  }

  startGifRecording(durationSecs) {
    this.gifRecording = true;
    this.gifFrames = [];
    this.gifStartFrame = this.frameNum;
    this.gifDuration = durationSecs;
    this.gifTargetFrames = Math.round(durationSecs * 60);

    appendConsole('info', `Recording ${durationSecs}s GIF…`);

    setTimeout(() => {
      this.gifRecording = false;
      this._exportGif();
    }, durationSecs * 1000);
  }

  _processFrame() {
    const p = this.p;
    const now = performance.now();
    const elapsed = now - this.startTime;
    const frameInfo = {
      frameNum: this.frameNum,
      time: elapsed,
      dt: this.frameNum === 0 ? 16 : Math.min(elapsed - (this._lastFrameTime || 0), 100),
    };

    this._lastFrameTime = elapsed;

    if (this.frameCommands.length) {
      this._drawCommandFrame(p);
    } else {
      this._renderDemoFrame(p, frameInfo);
    }

    this._trackFps(now);

    if (this.gifRecording) {
      this._captureGifFrame();
    }

    this.frameNum += 1;
  }

  _drawCommandFrame(p) {
    const bg = this._themeColorRgb('--bg-canvas', [244, 236, 216]);
    p.background(...bg);
    this._executeCommands(p);
  }

  _renderDemoFrame(p, frameInfo) {
    const palette = this._palette();

    switch (this.demoPreset) {
      case 'hello-circle':
        this._renderHelloCircle(p, frameInfo, palette);
        break;
      case 'color-grid':
        this._renderColorGrid(p, frameInfo, palette);
        break;
      case 'breathing-ring':
        this._renderBreathingRing(p, frameInfo, palette);
        break;
      case 'particle-fountain':
        this._renderParticleFountain(p, frameInfo, palette);
        break;
      case 'click-painter':
        this._renderClickPainter(p, frameInfo, palette);
        break;
      case 'drag-trail':
        this._renderDragTrail(p, frameInfo, palette);
        break;
      case 'spiral-galaxy':
        this._renderSpiralGalaxy(p, frameInfo, palette);
        break;
      case 'noise-flow':
        this._renderNoiseFlow(p, frameInfo, palette);
        break;
      default:
        this._renderDefaultDemo(p, frameInfo, palette);
        break;
    }

    if (this.showFps) {
      this._renderFpsBadge(p);
    }
  }

  _renderDefaultDemo(p, frameInfo, palette) {
    const { accent, bg, muted, terracotta } = palette;
    const cx = p.width / 2;
    const cy = p.height / 2;

    p.background(...bg);
    this._drawGrid(p, muted, 40);

    for (let i = 0; i < 5; i += 1) {
      const phase = (i / 5) * p.TWO_PI;
      const r = 24 + 16 * Math.sin(frameInfo.frameNum * 0.03 + phase);
      const ox = Math.cos(phase + frameInfo.frameNum * 0.01) * 72;
      const oy = Math.sin(phase + frameInfo.frameNum * 0.01) * 72;
      p.noStroke();
      p.fill(...accent, 165);
      p.circle(cx + ox, cy + oy, r * 2);
    }

    p.fill(...terracotta, 210);
    p.circle(cx, cy, 22 + 10 * Math.sin(frameInfo.frameNum * 0.05));
    this._drawFrameLabel(p, `frame ${frameInfo.frameNum}`);
  }

  _renderHelloCircle(p, frameInfo, palette) {
    const { accent, bg, muted } = palette;
    const fallback = [
      p.width / 2 + Math.cos(frameInfo.frameNum * 0.03) * 120,
      p.height / 2 + Math.sin(frameInfo.frameNum * 0.04) * 70,
    ];
    const point = this.input.mouse || fallback;

    p.background(...bg);
    this._drawGrid(p, muted, 36);
    p.noStroke();
    p.fill(...accent, 46);
    p.circle(point[0], point[1], 128);
    p.fill(...accent, 220);
    p.circle(point[0], point[1], 74);
    p.fill(255, 255, 255, 150);
    p.circle(point[0] - 10, point[1] - 12, 18);
    this._drawFrameLabel(p, 'hello circle');
  }

  _renderColorGrid(p, frameInfo, palette) {
    const { bg, accent, terracotta, teal } = palette;
    const cell = 36;

    p.background(...bg);
    p.noStroke();

    for (let x = 0; x < p.width + cell; x += cell) {
      for (let y = 0; y < p.height + cell; y += cell) {
        const mix = (Math.sin((x + frameInfo.frameNum * 4) * 0.02) + Math.cos((y - frameInfo.frameNum * 3) * 0.02)) * 0.5;
        const t = (mix + 1) * 0.5;
        const c1 = p.lerpColor(p.color(...accent, 220), p.color(...terracotta, 220), t);
        const c2 = p.lerpColor(c1, p.color(...teal, 220), (x + y) / (p.width + p.height));
        p.fill(c2);
        p.rect(x, y, cell - 2, cell - 2, 8);
      }
    }

    this._drawFrameLabel(p, 'color grid');
  }

  _renderBreathingRing(p, frameInfo, palette) {
    const { bg, accent, muted, terracotta } = palette;
    const radius = 96 + 30 * Math.sin(frameInfo.frameNum * 0.05);

    p.background(...bg);
    this._drawGrid(p, muted, 44);
    p.push();
    p.translate(p.width / 2, p.height / 2);
    p.noFill();
    p.stroke(...accent, 220);
    p.strokeWeight(7);
    p.circle(0, 0, radius * 2);
    p.stroke(...terracotta, 120);
    p.strokeWeight(2);
    p.circle(0, 0, (radius + 20) * 2);
    p.noStroke();
    p.fill(...accent, 28);
    p.circle(0, 0, radius * 2.9);
    p.pop();
    this._drawFrameLabel(p, 'breathing ring');
  }

  _renderParticleFountain(p, frameInfo, palette) {
    const { bg, accent, terracotta, muted } = palette;

    p.background(...bg);

    const sourceX = p.width / 2;
    const sourceY = p.height - 54;

    for (let i = 0; i < 4; i += 1) {
      this.demoState.particles.push({
        x: sourceX + p.random(-10, 10),
        y: sourceY,
        vx: p.random(-1.7, 1.7),
        vy: p.random(-7.8, -4.6),
        life: p.random(48, 76),
        size: p.random(4, 10),
        color: i % 2 === 0 ? accent : terracotta,
      });
    }

    this.demoState.particles = this.demoState.particles.filter((particle) => particle.life > 0 && particle.y < p.height + 30);

    p.noStroke();
    this.demoState.particles.forEach((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.18;
      particle.life -= 1;
      p.fill(...particle.color, Math.max(0, particle.life / 76) * 255);
      p.circle(particle.x, particle.y, particle.size);
    });

    p.stroke(...muted, 70);
    p.line(sourceX - 70, sourceY + 6, sourceX + 70, sourceY + 6);
    this._drawFrameLabel(p, 'particle fountain');
  }

  _renderClickPainter(p, frameInfo, palette) {
    const { bg, accent, terracotta, plum } = palette;

    p.background(...bg);
    p.noStroke();

    if (!this.demoState.paints.length) {
      p.fill(...accent, 80);
      p.textFont('JetBrains Mono, monospace');
      p.textSize(11);
      p.textAlign(p.CENTER, p.CENTER);
      p.text('click to paint', p.width / 2, p.height / 2);
      p.textAlign(p.LEFT, p.BASELINE);
    }

    this.demoState.paints.forEach((blob, index) => {
      const pulse = 1 + 0.04 * Math.sin(frameInfo.frameNum * 0.08 + index * 0.7);
      p.fill(...blob.color, 210);
      p.circle(blob.x, blob.y, blob.size * pulse);
    });

    this._drawFrameLabel(p, 'click painter');
    this.demoState.clickColors = [accent, terracotta, plum];
  }

  _renderDragTrail(p, frameInfo, palette) {
    const { bg, accent, teal, terracotta } = palette;

    p.background(...bg);

    if (this.input.mouseButtons.left && this.input.mouse) {
      this.demoState.trail.push({
        x: this.input.mouse[0],
        y: this.input.mouse[1],
        life: 56,
      });
    }

    this.demoState.trail = this.demoState.trail
      .map((point) => ({ ...point, life: point.life - 1 }))
      .filter((point) => point.life > 0)
      .slice(-90);

    p.noStroke();
    this.demoState.trail.forEach((point, index) => {
      const color = index % 3 === 0 ? accent : index % 3 === 1 ? teal : terracotta;
      p.fill(...color, (point.life / 56) * 210);
      p.circle(point.x, point.y, 8 + (point.life / 56) * 16);
    });

    if (!this.demoState.trail.length) {
      p.fill(...accent, 80);
      p.textFont('JetBrains Mono, monospace');
      p.textSize(11);
      p.textAlign(p.CENTER, p.CENTER);
      p.text('drag to draw a fading ribbon', p.width / 2, p.height / 2);
      p.textAlign(p.LEFT, p.BASELINE);
    }

    this._drawFrameLabel(p, 'drag trail');
  }

  _renderSpiralGalaxy(p, frameInfo, palette) {
    const { bg, accent, terracotta } = palette;

    p.background(...bg);
    p.push();
    p.translate(p.width / 2, p.height / 2);
    p.noStroke();

    for (let i = 0; i < 540; i += 1) {
      const angle = i * 0.28 + frameInfo.frameNum * 0.012;
      const radius = 2.1 * Math.exp(i * 0.0085);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const color = i % 5 === 0 ? terracotta : accent;
      const alpha = Math.max(30, 215 - i * 0.24);
      p.fill(...color, alpha);
      p.circle(x, y, 1.8 + (i % 6) * 0.18);
    }

    p.pop();
    this._drawFrameLabel(p, 'spiral galaxy');
  }

  _renderNoiseFlow(p, frameInfo, palette) {
    const { bg, accent, teal, muted } = palette;

    if (frameInfo.frameNum === 0) {
      p.background(...bg);
    } else {
      p.background(bg[0], bg[1], bg[2], 24);
    }

    if (!this.demoState.flowParticles.length) {
      this.demoState.flowParticles = Array.from({ length: 140 }, () => ({
        x: p.random(p.width),
        y: p.random(p.height),
      }));
    }

    p.strokeWeight(1.2);
    this.demoState.flowParticles.forEach((particle, index) => {
      const angle = p.noise(particle.x * 0.0035, particle.y * 0.0035, frameInfo.frameNum * 0.003) * p.TWO_PI * 4;
      const nextX = particle.x + Math.cos(angle) * 2.2;
      const nextY = particle.y + Math.sin(angle) * 2.2;
      const color = index % 4 === 0 ? teal : accent;
      p.stroke(...color, 80);
      p.line(particle.x, particle.y, nextX, nextY);
      particle.x = nextX;
      particle.y = nextY;

      if (particle.x < 0 || particle.x > p.width || particle.y < 0 || particle.y > p.height) {
        particle.x = p.random(p.width);
        particle.y = p.random(p.height);
      }
    });

    p.noStroke();
    p.fill(...muted, 120);
    p.circle(p.width - 28, 24, 4);
    this._drawFrameLabel(p, 'noise flow');
  }

  _drawGrid(p, rgb, step) {
    p.stroke(rgb[0], rgb[1], rgb[2], 52);
    p.strokeWeight(1);
    for (let x = 0; x < p.width; x += step) p.line(x, 0, x, p.height);
    for (let y = 0; y < p.height; y += step) p.line(0, y, p.width, y);
  }

  _drawFrameLabel(p, label) {
    const muted = this._themeColorRgb('--text-secondary', [122, 110, 98]);
    p.noStroke();
    p.fill(muted[0], muted[1], muted[2], 170);
    p.textFont('JetBrains Mono, monospace');
    p.textSize(10);
    p.text(label, 12, 18);
  }

  _palette() {
    return {
      bg: this._themeColorRgb('--bg-canvas', [244, 236, 216]),
      accent: this._themeColorRgb('--accent', [91, 111, 232]),
      terracotta: this._themeColorRgb('--brand-5', [196, 149, 110]),
      muted: this._themeColorRgb('--text-muted', [168, 155, 142]),
      plum: [140, 107, 201],
      teal: [78, 159, 146],
    };
  }

  _createEmptyDemoState() {
    return {
      particles: [],
      paints: [],
      trail: [],
      flowParticles: [],
      clickColors: [],
    };
  }

  _resetDemoState() {
    this.demoState = this._createEmptyDemoState();
  }

  _executeCommands(p) {
    for (const cmd of this.frameCommands) {
      this._execCmd(p, cmd);
    }
  }

  _execCmd(p, cmd) {
    switch (cmd.type) {
      case 'background':
        p.background(...this._parseColor(cmd.color));
        break;

      case 'circle': {
        const rows = this._tableRows(cmd);
        rows.forEach((row) => {
          this._applyStyle(p, row);
          const [x, y] = row.p || [0, 0];
          const r = row.r || 20;
          p.ellipse(x, y, r * 2, r * 2);
        });
        break;
      }

      case 'rect': {
        const rows = this._tableRows(cmd);
        rows.forEach((row) => {
          this._applyStyle(p, row);
          const [x, y] = row.p || [0, 0];
          const [w, h] = row.s || [40, 40];
          p.rect(x, y, w, h);
        });
        break;
      }

      case 'line': {
        const rows = this._tableRows(cmd);
        rows.forEach((row) => {
          const [x1, y1] = row.p || [0, 0];
          const [x2, y2] = row.p2 || [100, 100];
          const weight = row.weight || 1;
          const color = row.stroke ? this._parseColor(row.stroke) : [0];
          p.stroke(...color);
          p.strokeWeight(weight);
          p.line(x1, y1, x2, y2);
        });
        break;
      }

      case 'text': {
        const rows = this._tableRows(cmd);
        rows.forEach((row) => {
          this._applyStyle(p, row);
          const [x, y] = row.p || [0, 0];
          p.text(row.text || '', x, y);
        });
        break;
      }

      case 'push':
        p.push();
        break;
      case 'pop':
        p.pop();
        break;
      case 'translate':
        p.translate(cmd.x || 0, cmd.y || 0);
        break;
      case 'scale':
        p.scale(cmd.x || 1, cmd.y || cmd.x || 1);
        break;
      case 'rotate':
        p.rotate(cmd.angle || 0);
        break;
      case 'cursor':
        p.cursor(cmd.cursor || p.ARROW);
        break;
      default:
        break;
    }
  }

  _tableRows(cmd) {
    if (!cmd.table) return [cmd];
    const keys = Object.keys(cmd.table);
    const len = cmd.table[keys[0]]?.length || 0;
    const rows = [];
    for (let i = 0; i < len; i += 1) {
      const row = {};
      keys.forEach((key) => { row[key] = cmd.table[key][i]; });
      rows.push(row);
    }
    return rows;
  }

  _applyStyle(p, style) {
    const alpha = style.alpha !== undefined ? style.alpha * 255 : 255;

    if (style.fill !== undefined) {
      const fill = this._parseColor(style.fill);
      p.fill(...fill, alpha);
    } else {
      p.noFill();
    }

    if (style.stroke !== undefined) {
      const stroke = this._parseColor(style.stroke);
      p.stroke(...stroke);
    } else {
      p.noStroke();
    }

    if (style.weight !== undefined) {
      p.strokeWeight(style.weight);
    }
  }

  _parseColor(color) {
    if (Array.isArray(color)) return color;

    if (typeof color === 'number') {
      return [
        (color >> 16) & 0xFF,
        (color >> 8) & 0xFF,
        color & 0xFF,
      ];
    }

    if (typeof color === 'string') {
      return this._cssColorToRgb(color, [0, 0, 0]);
    }

    return [0, 0, 0];
  }

  _updateMouse(p) {
    const mx = p.mouseX;
    const my = p.mouseY;

    if (mx >= 0 && mx <= p.width && my >= 0 && my <= p.height) {
      this.input.mouse = [mx, my];
    }
  }

  _onMousePress(p) {
    this._updateMouse(p);
    if (p.mouseButton === p.LEFT) this.input.mouseButtons.left = true;
    if (p.mouseButton === p.CENTER) this.input.mouseButtons.middle = true;
    if (p.mouseButton === p.RIGHT) this.input.mouseButtons.right = true;

    if (this.demoPreset === 'click-painter' && this.input.mouse) {
      const colors = this.demoState.clickColors.length ? this.demoState.clickColors : this._palette().accent;
      const color = Array.isArray(colors[0]) ? colors[this.demoState.paints.length % colors.length] : colors;
      this.demoState.paints.push({
        x: this.input.mouse[0],
        y: this.input.mouse[1],
        size: 24 + (this.demoState.paints.length % 5) * 10,
        color,
      });
    }
  }

  _onMouseRelease(p) {
    if (p.mouseButton === p.LEFT) this.input.mouseButtons.left = false;
    if (p.mouseButton === p.CENTER) this.input.mouseButtons.middle = false;
    if (p.mouseButton === p.RIGHT) this.input.mouseButtons.right = false;
  }

  _onMouseOut() {
    this.input.mouse = null;
    this.input.mouseButtons = { left: false, middle: false, right: false };
    this.input.scroll = [0, 0];
  }

  _handleDemoDrag() {
    if (this.demoPreset !== 'drag-trail' || !this.input.mouse) return;
    this.demoState.trail.push({
      x: this.input.mouse[0],
      y: this.input.mouse[1],
      life: 56,
    });
  }

  _onScroll(event) {
    this.input.scroll = [event.deltaX, event.deltaY];
    setTimeout(() => { this.input.scroll = [0, 0]; }, 50);
  }

  _onKeyPress(p) {
    this.input.key = p.key;
    this.input.keys.add(p.key);
  }

  _onKeyRelease(p) {
    this.input.keys.delete(p.key);
    this.input.key = '';
  }

  _trackFps(now) {
    this.fpsBuf.push(now);
    if (this.fpsBuf.length > 60) this.fpsBuf.shift();
    if (this.fpsBuf.length >= 2) {
      const span = now - this.fpsBuf[0];
      const fps = Math.round(((this.fpsBuf.length - 1) / span) * 1000);
      if (window.__qanvasOnFps) window.__qanvasOnFps(fps);
    }
  }

  _renderFpsBadge(p) {
    if (this.fpsBuf.length < 2) return;

    const span = this.fpsBuf[this.fpsBuf.length - 1] - this.fpsBuf[0];
    const fps = Math.round(((this.fpsBuf.length - 1) / span) * 1000);

    p.push();
    p.fill(0, 0, 0, 130);
    p.noStroke();
    p.rect(p.width - 60, 6, 54, 20, 10);
    p.fill(255);
    p.textFont('JetBrains Mono, monospace');
    p.textSize(10);
    p.textAlign(p.CENTER, p.CENTER);
    p.text(`${fps} fps`, p.width - 33, 16);
    p.textAlign(p.LEFT, p.BASELINE);
    p.pop();
  }

  _captureGifFrame() {
    const canvas = this.p5Instance.canvas;
    this.gifFrames.push(canvas.toDataURL('image/png'));

    if (this.gifFrames.length >= this.gifTargetFrames) {
      this.gifRecording = false;
      this._exportGif();
    }
  }

  _exportGif() {
    appendConsole('info', `GIF: captured ${this.gifFrames.length} frames. (GIF encoding requires gif.js integration)`);

    if (this.gifFrames.length > 0) {
      const link = document.createElement('a');
      link.download = 'sketch-animation.png';
      link.href = this.gifFrames[0];
      link.click();
    }
  }

  _drawSepiaBackground() {
    if (!this.p) return;
    const bg = this._themeColorRgb('--bg-canvas', [244, 236, 216]);
    this.p.background(...bg);
  }

  _themeColorRgb(cssVar, fallback) {
    const root = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
    return this._cssColorToRgb(root || '', fallback);
  }

  _cssColorToRgb(value, fallback) {
    if (!value) return fallback;

    if (value.startsWith('#')) {
      const hex = value.slice(1);
      const normalized = hex.length === 3
        ? hex.split('').map((char) => char + char).join('')
        : hex;
      const int = parseInt(normalized, 16);
      if (!Number.isNaN(int)) {
        return [
          (int >> 16) & 0xFF,
          (int >> 8) & 0xFF,
          int & 0xFF,
        ];
      }
    }

    const probe = document.createElement('div');
    probe.style.color = value;
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color;
    document.body.removeChild(probe);
    const matches = color.match(/\d+/g);
    return matches ? matches.slice(0, 3).map(Number) : fallback;
  }

  _updateSizeLabel(w, h) {
    const label = document.getElementById('canvas-size-label');
    if (label) label.textContent = `${w} × ${h}`;
  }
}

function appendConsole(type, text) {
  if (window.__appendConsole) {
    window.__appendConsole(type, text);
  }
}

function initCanvas() {
  if (typeof p5 === 'undefined') {
    setTimeout(initCanvas, 50);
    return;
  }

  qCanvas = new QanvasCanvas();
  window.qCanvas = qCanvas;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCanvas);
} else {
  initCanvas();
}
