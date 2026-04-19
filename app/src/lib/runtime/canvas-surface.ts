const DEFAULT_BG = [244, 236, 216] as const;

type DrawCommand = Record<string, unknown>;

export class CanvasSurface {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private fpsHistory: number[] = [];
  private imageCache = new Map<string, HTMLImageElement>();

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    this.clear();
  }

  resize() {
    if (!this.canvas || !this.ctx) return;
    const rect = this.canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(rect.width * ratio));
    this.canvas.height = Math.max(1, Math.round(rect.height * ratio));
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  getSize() {
    if (!this.canvas) {
      return [1200, 800] as const;
    }

    const rect = this.canvas.getBoundingClientRect();
    return [Math.round(rect.width), Math.round(rect.height)] as const;
  }

  clear(background: unknown = DEFAULT_BG) {
    if (!this.ctx) return;
    const [width, height] = this.getSize();
    const [r, g, b] = parseColor(background, DEFAULT_BG);
    this.ctx.save();
    this.ctx.fillStyle = `rgb(${r} ${g} ${b})`;
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.restore();
  }

  draw(commands: DrawCommand[], options: { showFps: boolean; fps: number }) {
    if (!this.ctx) return;

    this.clear();
    for (const command of commands) {
      this.execute(command);
    }

    if (options.showFps) {
      this.drawFpsBadge(options.fps);
    }
  }

  exportPng(filename: string) {
    if (!this.canvas) return;
    const link = document.createElement('a');
    link.download = filename;
    link.href = this.canvas.toDataURL('image/png');
    link.click();
  }

  private execute(command: DrawCommand) {
    if (!this.ctx) return;
    const kind = String(command.kind ?? '');

    switch (kind) {
      case 'background':
        this.clear(command.fill);
        break;
      case 'circle':
        for (const row of readRows(command.data)) {
          this.withStyle(row, () => {
            const [x, y] = readPoint(row.p);
            const radius = Number(row.r ?? 20);
            this.ctx?.beginPath();
            this.ctx?.arc(x, y, radius, 0, Math.PI * 2);
            paintCurrentPath(this.ctx);
          });
        }
        break;
      case 'rect':
        for (const row of readRows(command.data)) {
          this.withStyle(row, () => {
            const [x, y] = readPoint(row.p);
            const [w, h] = readPoint(row.s, [40, 40]);
            this.ctx?.beginPath();
            this.ctx?.rect(x, y, w, h);
            paintCurrentPath(this.ctx);
          });
        }
        break;
      case 'pixel':
        for (const row of readRows(command.data)) {
          this.withStyle({ ...row, stroke: undefined }, () => {
            const [x, y] = readPoint(row.p);
            this.ctx?.fillRect(x, y, 1, 1);
          });
        }
        break;
      case 'line':
        for (const row of readRows(command.data)) {
          this.withStyle({ ...row, fill: undefined }, () => {
            const [x1, y1] = readPoint(row.p);
            const [x2, y2] = readPoint(row.p2, [100, 100]);
            this.ctx?.beginPath();
            this.ctx?.moveTo(x1, y1);
            this.ctx?.lineTo(x2, y2);
            this.ctx?.stroke();
          });
        }
        break;
      case 'text':
        for (const row of readRows(command.data)) {
          this.withStyle(row, () => {
            const [x, y] = readPoint(row.p);
            const text = String(row.text ?? '');
            const fill = parseColor(row.fill, [44, 37, 32]);
            if (!this.ctx) return;
            this.ctx.fillStyle = rgba(fill, row.alpha);
            this.ctx.font = '12px "JetBrains Mono", monospace';
            this.ctx.fillText(text, x, y);
          });
        }
        break;
      case 'image':
        for (const row of readRows(command.data)) {
          const src = String(row.src ?? '');
          if (!src || !this.ctx) continue;

          const image = this.loadImage(src);
          if (!image.complete || !image.naturalWidth) continue;

          const [x, y] = readPoint(row.p);
          const [w, h] = readPoint(row.s, [image.naturalWidth, image.naturalHeight]);
          this.ctx.save();
          this.ctx.globalAlpha = readAlpha(row.alpha);
          this.ctx.drawImage(image, x, y, w, h);
          this.ctx.restore();
        }
        break;
      case 'translate':
        this.ctx.translate(Number(command.x ?? 0), Number(command.y ?? 0));
        break;
      case 'scale':
        this.ctx.scale(Number(command.x ?? 1), Number(command.y ?? command.x ?? 1));
        break;
      case 'rotate':
        this.ctx.rotate(Number(command.angle ?? 0));
        break;
      case 'push':
        this.ctx.save();
        break;
      case 'pop':
        this.ctx.restore();
        break;
      case 'generic':
        for (const nested of readRows(command.data)) {
          this.execute(nested);
        }
        break;
      default:
        break;
    }
  }

  private withStyle(style: Record<string, unknown>, draw: () => void) {
    if (!this.ctx) return;
    this.ctx.save();

    if (style.fill !== undefined) {
      const fill = parseColor(style.fill, [44, 37, 32]);
      this.ctx.fillStyle = rgba(fill, style.alpha);
    } else {
      this.ctx.fillStyle = 'transparent';
    }

    if (style.stroke !== undefined) {
      const stroke = parseColor(style.stroke, [44, 37, 32]);
      this.ctx.strokeStyle = rgba(stroke, style.alpha);
    } else {
      this.ctx.strokeStyle = 'transparent';
    }

    this.ctx.lineWidth = Number(style.weight ?? 1);
    draw();
    this.ctx.restore();
  }

  private drawFpsBadge(fps: number) {
    if (!this.ctx) return;
    const [width] = this.getSize();
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    roundRect(this.ctx, width - 62, 6, 56, 20, 10);
    this.ctx.fill();
    this.ctx.fillStyle = 'white';
    this.ctx.font = '10px "JetBrains Mono", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(`${fps} fps`, width - 34, 16);
    this.ctx.restore();
  }

  updateFps(now: number) {
    this.fpsHistory.push(now);
    if (this.fpsHistory.length > 60) {
      this.fpsHistory.shift();
    }

    if (this.fpsHistory.length < 2) {
      return 0;
    }

    const span = this.fpsHistory[this.fpsHistory.length - 1] - this.fpsHistory[0];
    return span > 0 ? Math.round(((this.fpsHistory.length - 1) / span) * 1000) : 0;
  }

  private loadImage(src: string) {
    let image = this.imageCache.get(src);
    if (!image) {
      image = new Image();
      image.decoding = 'async';
      image.src = src;
      this.imageCache.set(src, image);
    }
    return image;
  }
}

function paintCurrentPath(ctx: CanvasRenderingContext2D | null) {
  if (!ctx) return;
  if (ctx.fillStyle !== 'transparent') ctx.fill();
  if (ctx.strokeStyle !== 'transparent') ctx.stroke();
}

function readRows(value: unknown) {
  if (Array.isArray(value)) {
    return value as Record<string, unknown>[];
  }

  if (value && typeof value === 'object') {
    return [value as Record<string, unknown>];
  }

  return [];
}

function readPoint(value: unknown, fallback: [number, number] = [0, 0]): [number, number] {
  if (Array.isArray(value) && value.length >= 2) {
    return [Number(value[0]), Number(value[1])];
  }

  return fallback;
}

function rgba(color: [number, number, number], alphaValue: unknown) {
  const alpha = readAlpha(alphaValue);
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

function readAlpha(alphaValue: unknown) {
  const alpha = alphaValue === undefined ? 1 : Number(alphaValue);
  return Number.isFinite(alpha) ? alpha : 1;
}

function parseColor(value: unknown, fallback: readonly [number, number, number]): [number, number, number] {
  if (Array.isArray(value)) {
    if (value.length === 3 && value.every((entry) => typeof entry === 'number')) {
      return [Number(value[0]), Number(value[1]), Number(value[2])];
    }

    if (value.length === 3 && value.every((entry) => typeof entry === 'string')) {
      return value.map((entry) => Number.parseInt(String(entry), 16)) as [number, number, number];
    }
  }

  if (typeof value === 'number') {
    return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
  }

  if (typeof value === 'string' && value.startsWith('#')) {
    const hex = value.slice(1);
    const normalized = hex.length === 3 ? hex.split('').map((char) => `${char}${char}`).join('') : hex;
    const parsed = Number.parseInt(normalized, 16);
    if (!Number.isNaN(parsed)) {
      return [(parsed >> 16) & 0xff, (parsed >> 8) & 0xff, parsed & 0xff];
    }
  }

  return [...fallback];
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
