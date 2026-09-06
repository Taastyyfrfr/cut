/**
 * High-Performance Visceral Canvas 2D Renderer — Concetto Biologico
 * 
 * Optimized Canvas 2D Pipeline:
 * - Zero per-pixel manipulation (no getImageData / putImageData)
 * - Single offscreen noise texture generated once at initialization
 * - Clean requestAnimationFrame draw loop filling base alabaster skin tone (#EDE6DC)
 * - Closed Bézier cut paths with depth linear gradient (black center to deep crimson edges)
 * - Inner drop shadow along upper lip via ctx.shadowBlur & ctx.shadowColor
 * - 1-pixel low-opacity white specular stroke along top edge
 * - Lightweight drip particle array with high-drag friction, overlapping ellipses & surface tension arc
 * - Low-opacity multiply noise blending at loop end
 * - Strict devicePixelRatio scaling with window resize listener
 */

import { AudioEngine } from '../audio/audioEngine';

export interface Point {
  x: number;
  y: number;
}

export interface CutPath {
  id: string;
  start: Point;
  middle: Point;
  end: Point;
  width: number;
  normal: Point;
  tangent: Point;
  length: number;
  createdAt: number;
  currentGape: number;
  dripsSpawned: boolean;
}

export interface DripParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radiusX: number;
  radiusY: number;
  age: number;
  maxAge: number;
  trail: { x: number; y: number; r: number }[];
}

export class CanvasRenderer {
  public container: HTMLElement;
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;

  private audioEngine: AudioEngine;
  public width: number = window.innerWidth;
  public height: number = window.innerHeight;
  public dpr: number = window.devicePixelRatio || 1;

  // Stored cuts and lightweight drip particle array
  public cuts: CutPath[] = [];
  public drips: DripParticle[] = [];

  // Active slice input tracking
  private isSlicing: boolean = false;
  private sliceStart: (Point & { t: number }) | null = null;
  private sliceCurrent: Point | null = null;
  private strokePoints: (Point & { t: number })[] = [];
  private maxVelocity: number = 0;

  // Pre-rendered offscreen noise texture
  private noiseCanvas: HTMLCanvasElement | null = null;
  private noisePattern: CanvasPattern | null = null;

  // Animation frame loop
  private animId: number = 0;
  private lastTime: number = performance.now();

  constructor(container: HTMLElement, audioEngine: AudioEngine) {
    this.container = container;
    this.audioEngine = audioEngine;

    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d', { alpha: false })!;

    // 1. Generate granular skin noise texture once during initialization
    this.initNoiseTexture();

    // 2. Adjust canvas dimensions based on devicePixelRatio
    this.resize(window.innerWidth, window.innerHeight);

    // 3. Bind window resize listener to maintain sharp scaling
    window.addEventListener('resize', this.handleWindowResize);

    // 4. Start optimized animation loop
    this.startLoop();
  }

  private handleWindowResize = (): void => {
    this.resize(window.innerWidth, window.innerHeight);
  };

  /**
   * Generates the granular skin noise texture once into an offscreen canvas.
   * Completely avoids getImageData and putImageData by using native Canvas 2D drawing.
   */
  private initNoiseTexture(): void {
    const size = 256;
    this.noiseCanvas = document.createElement('canvas');
    this.noiseCanvas.width = size;
    this.noiseCanvas.height = size;
    const nctx = this.noiseCanvas.getContext('2d')!;

    // Base neutral tone
    nctx.fillStyle = '#787878';
    nctx.fillRect(0, 0, size, size);

    // Procedural grain speckles
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const shade = Math.floor(Math.random() * 90);
      nctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 0.16)`;
      nctx.fillRect(x, y, 1.2, 1.2);
    }
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      nctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      nctx.fillRect(x, y, 1.0, 1.0);
    }

    this.noisePattern = this.ctx.createPattern(this.noiseCanvas, 'repeat');
  }

  /**
   * Resizes buffer according to devicePixelRatio to prevent blurry scaling.
   */
  public resize(w: number, h: number): void {
    this.width = w;
    this.height = h;
    this.dpr = window.devicePixelRatio || 1;

    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);

    if (this.noiseCanvas) {
      this.noisePattern = this.ctx.createPattern(this.noiseCanvas, 'repeat');
    }
  }

  // -------------------------------------------------------------
  // Pointer Slice Input
  // -------------------------------------------------------------

  public onPointerDown(x: number, y: number, _pressure: number = 1.0): void {
    this.isSlicing = true;
    const now = performance.now();
    this.sliceStart = { x, y, t: now };
    this.sliceCurrent = { x, y };
    this.strokePoints = [{ x, y, t: now }];
    this.maxVelocity = 0;
  }

  public onPointerMove(x: number, y: number, pressure: number = 1.0): { velocity: number; angle: number } | null {
    if (!this.isSlicing || !this.sliceStart) {
      return null;
    }

    const now = performance.now();
    const last = this.strokePoints[this.strokePoints.length - 1];
    const dx = x - last.x;
    const dy = y - last.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 2.0) return null;

    const dt = Math.max((now - last.t) / 1000, 0.001);
    const velocity = dist / dt;
    this.maxVelocity = Math.max(this.maxVelocity, velocity);

    this.sliceCurrent = { x, y };
    this.strokePoints.push({ x, y, t: now });

    const angle = Math.atan2(dy, dx);
    this.audioEngine.updateSlice(velocity, pressure);

    return { velocity, angle };
  }

  public onPointerUp(): CutPath | null {
    if (!this.isSlicing || !this.sliceStart || !this.sliceCurrent) {
      this.isSlicing = false;
      return null;
    }

    this.isSlicing = false;
    this.audioEngine.stopSlice();

    const start = { x: this.sliceStart.x, y: this.sliceStart.y };
    const end = { x: this.sliceCurrent.x, y: this.sliceCurrent.y };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy);

    // Ignore tiny accidental taps
    if (len < 14.0) {
      this.sliceStart = null;
      this.sliceCurrent = null;
      this.strokePoints = [];
      return null;
    }

    // Determine middle coordinate of the path
    let middle: Point;
    if (this.strokePoints.length > 2) {
      const midIdx = Math.floor(this.strokePoints.length / 2);
      middle = { x: this.strokePoints[midIdx].x, y: this.strokePoints[midIdx].y };
    } else {
      middle = { x: (start.x + end.x) * 0.5, y: (start.y + end.y) * 0.5 };
    }

    const tan = { x: dx / len, y: dy / len };
    const norm = { x: -tan.y, y: tan.x };

    // Width scales with slice velocity: 8px to 28px
    const speedFactor = Math.min(Math.max((this.maxVelocity - 100) / 750, 0.3), 1.8);
    const width = Math.min(Math.max(6.0 + speedFactor * 12.0, 6.0), 28.0);

    const cut: CutPath = {
      id: `cut_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      start,
      middle,
      end,
      width,
      normal: norm,
      tangent: tan,
      length: len,
      createdAt: performance.now(),
      currentGape: 0.1,
      dripsSpawned: false,
    };

    this.cuts.push(cut);
    this.audioEngine.playTensionRelease(Math.min(len / 250, 1.4));

    // Spawn drips along the lower boundary of the cut
    this.spawnDripsForCut(cut);

    this.sliceStart = null;
    this.sliceCurrent = null;
    this.strokePoints = [];

    return cut;
  }

  /**
   * Spawns lightweight drip particles along the lower boundary of a cut curve.
   */
  private spawnDripsForCut(cut: CutPath): void {
    const dripCount = Math.min(Math.floor(2 + Math.random() * 3.5), 5);
    // Lower lip is in direction of downward gravity or negative normal
    const isBotLower = cut.normal.y < 0.15;

    for (let i = 0; i < dripCount; i++) {
      const t = 0.25 + (i / (dripCount || 1)) * 0.5 + (Math.random() - 0.5) * 0.1;
      const clampedT = Math.max(0.15, Math.min(0.85, t));

      // Point on the lower boundary curve
      const cLower = {
        x: cut.middle.x + (isBotLower ? -cut.normal.x : cut.normal.x) * cut.width,
        y: cut.middle.y + (isBotLower ? -cut.normal.y : cut.normal.y) * cut.width,
      };

      const inv = 1 - clampedT;
      const px = inv * inv * cut.start.x + 2 * inv * clampedT * cLower.x + clampedT * clampedT * cut.end.x;
      const py = inv * inv * cut.start.y + 2 * inv * clampedT * cLower.y + clampedT * clampedT * cut.end.y;

      const r = 2.5 + Math.random() * 2.0;

      this.drips.push({
        x: px,
        y: py,
        vx: (Math.random() - 0.5) * 2.0,
        vy: 12.0 + Math.random() * 18.0,
        radiusX: r,
        radiusY: r * 1.2,
        age: 0,
        maxAge: 20.0,
        trail: [{ x: px, y: py, r }],
      });

      this.audioEngine.playFluidDrip();
    }
  }

  // -------------------------------------------------------------
  // Simulation Loop
  // -------------------------------------------------------------

  private startLoop(): void {
    const frame = (now: number) => {
      const dt = Math.min((now - this.lastTime) / 1000, 0.04);
      this.lastTime = now;

      this.update(dt, now);
      this.render();

      this.animId = requestAnimationFrame(frame);
    };
    this.animId = requestAnimationFrame(frame);
  }

  private update(dt: number, now: number): void {
    // 1. Elastic pull: cut opens over 150ms
    for (const cut of this.cuts) {
      const ageMs = now - cut.createdAt;
      if (ageMs < 150) {
        const k = ageMs / 150;
        cut.currentGape = Math.min(1.0 - Math.cos((k * Math.PI) / 2) + Math.sin(k * Math.PI) * 0.1, 1.0);
      } else {
        cut.currentGape = 1.0;
      }
    }

    // 2. High-drag vertical friction physics for drips
    const gravity = 35.0;
    const friction = 0.89; // high-drag friction

    for (let i = this.drips.length - 1; i >= 0; i--) {
      const drip = this.drips[i];
      drip.age += dt;

      if (drip.age > drip.maxAge) {
        this.drips.splice(i, 1);
        continue;
      }

      drip.vy += gravity * dt;
      drip.vx *= friction;
      drip.vy *= friction;

      drip.x += drip.vx * dt;
      drip.y += drip.vy * dt;

      // Elongate vertical radius based on downward speed
      drip.radiusY = Math.min(drip.radiusX + drip.vy * 0.09, drip.radiusX * 2.8);

      // Record overlapping trail positions
      const last = drip.trail[drip.trail.length - 1];
      if (Math.hypot(drip.x - last.x, drip.y - last.y) >= 2.5) {
        drip.trail.push({ x: drip.x, y: drip.y, r: drip.radiusX });
        if (drip.trail.length > 40) {
          drip.trail.shift();
        }
      }

      if (drip.y > this.height + 40) {
        this.drips.splice(i, 1);
      }
    }
  }

  // -------------------------------------------------------------
  // Master Render Pass
  // -------------------------------------------------------------

  public render(): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // 1. Clear the main canvas and fill with base alabaster skin tone (#EDE6DC)
    ctx.fillStyle = '#EDE6DC';
    ctx.fillRect(0, 0, w, h);

    // 2. Render cuts as closed Bézier curves filled with gradient & upper shadow
    for (const cut of this.cuts) {
      this.renderCut(ctx, cut);
    }

    // 3. Render bleeding drips as overlapping dark red ellipses with surface tension arcs
    this.renderDrips(ctx);

    // 4. Active slice drag line preview
    if (this.isSlicing && this.sliceStart && this.sliceCurrent) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(this.sliceStart.x, this.sliceStart.y);
      ctx.lineTo(this.sliceCurrent.x, this.sliceCurrent.y);
      ctx.strokeStyle = 'rgba(104, 10, 20, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }

    // 5. Blend pre-rendered noise texture over entire canvas with multiply at low opacity
    if (this.noisePattern) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = this.noisePattern;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // 6. Perimeter ambient gallery vignette
    const vigGrad = ctx.createRadialGradient(
      w * 0.5, h * 0.5, Math.min(w, h) * 0.35,
      w * 0.5, h * 0.5, Math.hypot(w * 0.5, h * 0.5)
    );
    vigGrad.addColorStop(0, 'rgba(18, 14, 12, 0)');
    vigGrad.addColorStop(0.75, 'rgba(18, 14, 12, 0.10)');
    vigGrad.addColorStop(1, 'rgba(18, 14, 12, 0.25)');

    ctx.save();
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /**
   * Renders a cut:
   * - Closed Bézier curve filled with linear gradient (black at center to deep crimson at edges)
   * - Dark inner drop shadow along the upper lip of the curve using ctx.shadowBlur & ctx.shadowColor
   * - 1-pixel white stroke with low opacity along the top edge for specular skin highlight
   */
  private renderCut(ctx: CanvasRenderingContext2D, cut: CutPath): void {
    const halfWidth = cut.width * cut.currentGape;

    // Control points for upper and lower Bézier curves
    const cTop = {
      x: cut.middle.x + cut.normal.x * halfWidth,
      y: cut.middle.y + cut.normal.y * halfWidth,
    };
    const cBot = {
      x: cut.middle.x - cut.normal.x * halfWidth,
      y: cut.middle.y - cut.normal.y * halfWidth,
    };

    // Linear gradient transitioning from black at center to deep crimson at edges
    const grad = ctx.createLinearGradient(cTop.x, cTop.y, cBot.x, cBot.y);
    grad.addColorStop(0.0, '#5C0812'); // Deep crimson at upper edge
    grad.addColorStop(0.5, '#0A0002'); // Black at center void
    grad.addColorStop(1.0, '#4A040C'); // Deep crimson at lower edge

    ctx.save();

    // Dark inner drop shadow along the upper lip of the curve
    ctx.shadowColor = 'rgba(10, 1, 3, 0.72)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = cut.normal.x * 2.0;
    ctx.shadowOffsetY = Math.max(cut.normal.y * 2.0, 1.5);

    // Draw closed Bézier curve
    ctx.beginPath();
    ctx.moveTo(cut.start.x, cut.start.y);
    ctx.quadraticCurveTo(cTop.x, cTop.y, cut.end.x, cut.end.y);
    ctx.quadraticCurveTo(cBot.x, cBot.y, cut.start.x, cut.start.y);
    ctx.closePath();

    ctx.fillStyle = grad;
    ctx.fill();

    ctx.restore();

    // 1-pixel white stroke with low opacity along top edge for specular skin highlight
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cut.start.x, cut.start.y);
    ctx.quadraticCurveTo(cTop.x, cTop.y, cut.end.x, cut.end.y);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.0;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Renders bleeding drips:
   * - Overlapping dark red ellipses along particle trail & head
   * - Small sharp white arc at bottom of each drip for surface tension highlight
   */
  private renderDrips(ctx: CanvasRenderingContext2D): void {
    for (const drip of this.drips) {
      // 1. Dark red overlapping ellipses
      ctx.save();
      ctx.fillStyle = '#42030A';

      // Overlapping trail ellipses
      for (const pt of drip.trail) {
        ctx.beginPath();
        ctx.ellipse(pt.x, pt.y, pt.r * 0.75, pt.r * 1.1, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Active drip head ellipse
      ctx.beginPath();
      ctx.ellipse(drip.x, drip.y, drip.radiusX, drip.radiusY, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Small, sharp white arc at bottom of drip (surface tension highlight)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.82)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(
        drip.x,
        drip.y + drip.radiusY * 0.3,
        drip.radiusX * 0.55,
        Math.PI * 0.15,
        Math.PI * 0.85
      );
      ctx.stroke();

      ctx.restore();
    }
  }

  // -------------------------------------------------------------
  // Public Controls
  // -------------------------------------------------------------

  public clear(): void {
    this.cuts = [];
    this.drips = [];
    this.isSlicing = false;
    this.sliceStart = null;
    this.sliceCurrent = null;
    this.strokePoints = [];
    this.audioEngine.playRegeneration();
  }

  public exportCapture(filename?: string): void {
    const dataUrl = this.canvas.toDataURL('image/png');
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = filename || `concetto-biologico_${timestamp}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  public destroy(): void {
    cancelAnimationFrame(this.animId);
    window.removeEventListener('resize', this.handleWindowResize);
  }
}
