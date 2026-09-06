/**
 * Consolidated Visceral Gallery Renderer — Concetto Biologico
 * 
 * Centralized high-end rendering pipeline:
 * - 1:1 Pixel Coordinate Space with strict window.devicePixelRatio support
 * - Taut, warm alabaster/vellum canvas (#EDE6DC) with tactile micro-grain & soft vignette
 * - Dual cubic bezier gaping almond lenses with needle-thin tapers & 150ms elastic pull
 * - Trompe-l'œil depth: hematite (#120104) to arterial (#680A14) trench void, beveled specular lip (#FFF7EE), inner shadow
 * - 3 to 7 quivering collagen fibrils spanning the gap
 * - Wet high-contrast specular curves
 * - Viscous fluid mechanics: deep venous clotted red (#4A040C), crawling teardrops with surface tension glints, thin streaks, capillary halos
 */

import { AudioEngine } from '../audio/audioEngine';

export interface CollagenFibril {
  u: number;            // Parameter along the cut [0.15, 0.85]
  topAnchor: { x: number; y: number };
  botAnchor: { x: number; y: number };
  mid: { x: number; y: number };
  vel: { x: number; y: number };
  thickness: number;
  alpha: number;
  quiverPhase: number;
  quiverFreq: number;
}

export interface ViscousDrip {
  x: number;
  y: number;
  velX: number;
  velY: number;
  radius: number;
  length: number;
  age: number;
  maxAge: number;
  trail: { x: number; y: number }[];
}

export interface WoundSlice {
  id: string;
  createdAt: number;
  p0: { x: number; y: number };       // Start tip (needle point)
  p1: { x: number; y: number };       // End tip (needle point)
  cTop0: { x: number; y: number };    // Top bezier control point 1
  cTop1: { x: number; y: number };    // Top bezier control point 2
  cBot0: { x: number; y: number };    // Bottom bezier control point 1
  cBot1: { x: number; y: number };    // Bottom bezier control point 2
  maxHalfWidth: number;               // Scaled by slice drag velocity
  normal: { x: number; y: number };   // Unit normal pointing top
  tangent: { x: number; y: number };  // Unit tangent
  length: number;
  currentGape: number;
  fibrils: CollagenFibril[];
  dripsSpawned: boolean;
}

export class CanvasRenderer {
  public container: HTMLElement;
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;

  private audioEngine: AudioEngine;
  public width: number = window.innerWidth;
  public height: number = window.innerHeight;
  public dpr: number = window.devicePixelRatio || 1;

  // Active artwork state
  public wounds: WoundSlice[] = [];
  public drips: ViscousDrip[] = [];

  // Active slice tracking
  private isSlicing: boolean = false;
  private sliceStart: { x: number; y: number; t: number } | null = null;
  private sliceCurrent: { x: number; y: number } | null = null;
  private strokePoints: { x: number; y: number; t: number }[] = [];
  private maxVelocity: number = 0;

  // Offscreen tactile micro-grain texture
  private grainCanvas: HTMLCanvasElement;

  // Animation frame
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

    // Initialize grain canvas
    this.grainCanvas = document.createElement('canvas');
    this.initGrain();

    this.resize(window.innerWidth, window.innerHeight);
    this.startLoop();
  }

  /**
   * Pre-render procedural micro-grain overlay for tactile vellum canvas
   */
  private initGrain(): void {
    const dim = 256;
    this.grainCanvas.width = dim;
    this.grainCanvas.height = dim;
    const gctx = this.grainCanvas.getContext('2d')!;
    const imgData = gctx.createImageData(dim, dim);
    const data = imgData.data;

    for (let i = 0; i < dim * dim; i++) {
      const noise = (Math.random() - 0.5) * 28;
      const idx = i * 4;
      data[idx] = 128 + noise;
      data[idx + 1] = 128 + noise;
      data[idx + 2] = 128 + noise;
      data[idx + 3] = 22; // subtle opacity
    }

    gctx.putImageData(imgData, 0, 0);
  }

  public resize(w: number, h: number): void {
    this.width = w;
    this.height = h;
    this.dpr = window.devicePixelRatio || 1;

    // Strict high-DPI scaling: physical buffer matches dpr 1:1, coordinate space matches client pixels
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
  }

  // -------------------------------------------------------------
  // Pointer Slice Handling
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

  public onPointerUp(): WoundSlice | null {
    if (!this.isSlicing || !this.sliceStart || !this.sliceCurrent) {
      this.isSlicing = false;
      return null;
    }

    this.isSlicing = false;
    this.audioEngine.stopSlice();

    const p0 = { x: this.sliceStart.x, y: this.sliceStart.y };
    const p1 = { x: this.sliceCurrent.x, y: this.sliceCurrent.y };
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy);

    // Filter tiny clicks
    if (len < 12.0) {
      this.sliceStart = null;
      this.sliceCurrent = null;
      this.strokePoints = [];
      return null;
    }

    const now = performance.now();
    const tan = { x: dx / len, y: dy / len };
    const norm = { x: -tan.y, y: tan.x }; // perpendicular normal

    // Gaping width governed by slice velocity: 8px to 32px
    const speedFactor = Math.min(Math.max((this.maxVelocity - 100) / 750, 0.35), 1.8);
    const maxHalfWidth = Math.min(Math.max(6.0 + speedFactor * 12.0, 5.0), 32.0);

    // Dual cubic bezier control points for gaping almond lens
    // Control points pull outward along normal, tapering to needle tips at p0 and p1
    const cTop0 = {
      x: p0.x + tan.x * (len * 0.35) + norm.x * maxHalfWidth,
      y: p0.y + tan.y * (len * 0.35) + norm.y * maxHalfWidth,
    };
    const cTop1 = {
      x: p0.x + tan.x * (len * 0.65) + norm.x * maxHalfWidth,
      y: p0.y + tan.y * (len * 0.65) + norm.y * maxHalfWidth,
    };
    const cBot0 = {
      x: p0.x + tan.x * (len * 0.35) - norm.x * maxHalfWidth,
      y: p0.y + tan.y * (len * 0.35) - norm.y * maxHalfWidth,
    };
    const cBot1 = {
      x: p0.x + tan.x * (len * 0.65) - norm.x * maxHalfWidth,
      y: p0.y + tan.y * (len * 0.65) - norm.y * maxHalfWidth,
    };

    // Spawn 3 to 7 fine semi-translucent collagen fibrils spanning the cut gap
    const fibrilCount = Math.floor(3 + Math.random() * 4.5);
    const fibrils: CollagenFibril[] = [];

    for (let k = 0; k < fibrilCount; k++) {
      const u = 0.18 + (k / (fibrilCount - 1 || 1)) * 0.64 + (Math.random() - 0.5) * 0.08;
      const topA = this.sampleBezier(p0, cTop0, cTop1, p1, u);
      const botA = this.sampleBezier(p0, cBot0, cBot1, p1, u);
      const mid = {
        x: (topA.x + botA.x) * 0.5 + (Math.random() - 0.5) * 3.0,
        y: (topA.y + botA.y) * 0.5 + (Math.random() - 0.5) * 3.0,
      };

      fibrils.push({
        u,
        topAnchor: topA,
        botAnchor: botA,
        mid,
        vel: { x: (Math.random() - 0.5) * 30, y: (Math.random() - 0.5) * 30 },
        thickness: 0.8 + Math.random() * 0.5,
        alpha: 0.45 + Math.random() * 0.25,
        quiverPhase: Math.random() * Math.PI * 2,
        quiverFreq: 22.0 + Math.random() * 14.0,
      });
    }

    const wound: WoundSlice = {
      id: `wound_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: now,
      p0,
      p1,
      cTop0,
      cTop1,
      cBot0,
      cBot1,
      maxHalfWidth,
      currentGape: 0.05, // starts narrow, yawns open over 150ms
      normal: norm,
      tangent: tan,
      length: len,
      fibrils,
      dripsSpawned: false,
    };

    this.wounds.push(wound);
    this.audioEngine.playTensionRelease(Math.min(len / 250, 1.4));

    this.sliceStart = null;
    this.sliceCurrent = null;
    this.strokePoints = [];

    return wound;
  }

  // -------------------------------------------------------------
  // Math & Geometry Helpers
  // -------------------------------------------------------------

  private sampleBezier(
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
    t: number
  ): { x: number; y: number } {
    const inv = 1 - t;
    const inv2 = inv * inv;
    const inv3 = inv2 * inv;
    const t2 = t * t;
    const t3 = t2 * t;

    return {
      x: inv3 * p0.x + 3 * inv2 * t * p1.x + 3 * inv * t2 * p2.x + t3 * p3.x,
      y: inv3 * p0.y + 3 * inv2 * t * p1.y + 3 * inv * t2 * p2.y + t3 * p3.y,
    };
  }

  // -------------------------------------------------------------
  // Simulation Loop
  // -------------------------------------------------------------

  private startLoop(): void {
    const frame = (now: number) => {
      const dt = Math.min((now - this.lastTime) / 1000, 0.04);
      this.lastTime = now;

      this.update(dt, now);
      this.render(now);

      this.animId = requestAnimationFrame(frame);
    };
    this.animId = requestAnimationFrame(frame);
  }

  private update(dt: number, now: number): void {
    // 1. Elastic pull: incision starts narrow and yawns open over 150ms
    for (const wound of this.wounds) {
      const ageMs = now - wound.createdAt;
      if (ageMs < 150) {
        const k = ageMs / 150;
        // Viscoelastic overshoot curve
        wound.currentGape = Math.min(1.0 - Math.cos((k * Math.PI) / 2) + Math.sin(k * Math.PI) * 0.12, 1.0);
      } else {
        wound.currentGape = 1.0;
      }

      // Update quivering fibrils
      for (const f of wound.fibrils) {
        f.quiverPhase += f.quiverFreq * dt;
        // Recalculate anchors based on current gape
        const currentTop = this.sampleBezier(
          wound.p0,
          this.scaleControl(wound.p0, wound.cTop0, wound.currentGape),
          this.scaleControl(wound.p1, wound.cTop1, wound.currentGape),
          wound.p1,
          f.u
        );
        const currentBot = this.sampleBezier(
          wound.p0,
          this.scaleControl(wound.p0, wound.cBot0, wound.currentGape),
          this.scaleControl(wound.p1, wound.cBot1, wound.currentGape),
          wound.p1,
          f.u
        );
        f.topAnchor = currentTop;
        f.botAnchor = currentBot;

        const targetMidX = (currentTop.x + currentBot.x) * 0.5;
        const targetMidY = (currentTop.y + currentBot.y) * 0.5;

        // Damped spring oscillation
        const fx = -50.0 * (f.mid.x - targetMidX) - 12.0 * f.vel.x;
        const fy = -50.0 * (f.mid.y - targetMidY) - 12.0 * f.vel.y;

        f.vel.x += fx * dt;
        f.vel.y += fy * dt;
        f.mid.x += f.vel.x * dt;
        f.mid.y += f.vel.y * dt;
      }

      // Spawn viscous drips along lower lip of horizontal / angled cuts
      if (!wound.dripsSpawned && ageMs > 120) {
        wound.dripsSpawned = true;
        // Check downward-facing lip: if normal.y is positive, top is downward, else bottom is downward
        const isLowerLipBot = wound.normal.y < 0.15;
        const dripCount = Math.min(Math.floor(1 + Math.random() * 2.5), 3);

        for (let d = 0; d < dripCount; d++) {
          const uDrip = 0.3 + Math.random() * 0.4;
          const spawnPt = isLowerLipBot
            ? this.sampleBezier(wound.p0, wound.cBot0, wound.cBot1, wound.p1, uDrip)
            : this.sampleBezier(wound.p0, wound.cTop0, wound.cTop1, wound.p1, uDrip);

          this.drips.push({
            x: spawnPt.x,
            y: spawnPt.y,
            velX: (Math.random() - 0.5) * 3.0,
            velY: 10.0 + Math.random() * 15.0, // High initial drag, slow crawl
            radius: 2.2 + Math.random() * 1.6,
            length: 3.5,
            age: 0,
            maxAge: 25.0,
            trail: [{ x: spawnPt.x, y: spawnPt.y }],
          });

          this.audioEngine.playFluidDrip();
        }
      }
    }

    // 2. Viscous drip dynamics: crawl downward with high drag
    const gravity = 40.0;
    const drag = 0.88;

    for (let i = this.drips.length - 1; i >= 0; i--) {
      const drip = this.drips[i];
      drip.age += dt;

      if (drip.age > drip.maxAge) {
        this.drips.splice(i, 1);
        continue;
      }

      // Viscous crawl: slow downward acceleration with high drag
      drip.velY += gravity * dt;
      drip.velX *= drag;
      drip.velY *= drag;

      drip.x += drip.velX * dt;
      drip.y += drip.velY * dt;

      // Elongate teardrop head as it crawls
      drip.length = Math.min(drip.radius + drip.velY * 0.08, drip.radius * 3.2);

      // Record streak path
      const last = drip.trail[drip.trail.length - 1];
      if (Math.hypot(drip.x - last.x, drip.y - last.y) >= 2.5) {
        drip.trail.push({ x: drip.x, y: drip.y });
        if (drip.trail.length > 90) {
          drip.trail.shift();
        }
      }

      if (drip.y > this.height + 40) {
        this.drips.splice(i, 1);
      }
    }
  }

  private scaleControl(anchor: { x: number; y: number }, ctrl: { x: number; y: number }, gape: number): { x: number; y: number } {
    return {
      x: anchor.x + (ctrl.x - anchor.x) * gape,
      y: anchor.y + (ctrl.y - anchor.y) * gape,
    };
  }

  // -------------------------------------------------------------
  // Master Render Pass
  // -------------------------------------------------------------

  public render(_now: number): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // 1. Canvas Surface Base: Warm, desaturated alabaster/vellum (#EDE6DC)
    ctx.fillStyle = '#EDE6DC';
    ctx.fillRect(0, 0, w, h);

    // 2. Micro-grain canvas texture pattern
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = ctx.createPattern(this.grainCanvas, 'repeat')!;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // 3. Render each wound with Trompe-l'œil Layered Anatomy
    for (const wound of this.wounds) {
      this.renderWound(ctx, wound);
    }

    // 4. Render Viscous Fluid Teardrops & Thin Glossy Streaks
    this.renderFluids(ctx);

    // 5. Active drag slice preview
    if (this.isSlicing && this.sliceStart && this.sliceCurrent) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(this.sliceStart.x, this.sliceStart.y);
      ctx.lineTo(this.sliceCurrent.x, this.sliceCurrent.y);
      ctx.strokeStyle = 'rgba(104, 10, 20, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }

    // 6. Perimeter Ambient Vignette (soft darkening towards screen edges)
    const vigGrad = ctx.createRadialGradient(
      w * 0.5, h * 0.5, Math.min(w, h) * 0.35,
      w * 0.5, h * 0.5, Math.hypot(w * 0.5, h * 0.5)
    );
    vigGrad.addColorStop(0, 'rgba(18, 14, 12, 0)');
    vigGrad.addColorStop(0.75, 'rgba(18, 14, 12, 0.12)');
    vigGrad.addColorStop(1, 'rgba(18, 14, 12, 0.28)');

    ctx.save();
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /**
   * Render layered anatomical trompe-l'œil wound:
   * Capillary halo -> Inner shadow -> Trench void -> Collagen fibrils -> Specular gloss curves -> Beveled lip edge
   */
  private renderWound(ctx: CanvasRenderingContext2D, wound: WoundSlice): void {
    const gape = wound.currentGape;
    const p0 = wound.p0;
    const p1 = wound.p1;
    const cTop0 = this.scaleControl(p0, wound.cTop0, gape);
    const cTop1 = this.scaleControl(p1, wound.cTop1, gape);
    const cBot0 = this.scaleControl(p0, wound.cBot0, gape);
    const cBot1 = this.scaleControl(p1, wound.cBot1, gape);

    // Define lens path (top lip forward, bottom lip backward)
    const lensPath = new Path2D();
    lensPath.moveTo(p0.x, p0.y);
    lensPath.bezierCurveTo(cTop0.x, cTop0.y, cTop1.x, cTop1.y, p1.x, p1.y);
    lensPath.bezierCurveTo(cBot1.x, cBot1.y, cBot0.x, cBot0.y, p0.x, p0.y);
    lensPath.closePath();

    // -------------------------------------------------------------
    // A. Capillary Bleed Halo: faint soft-edged red diffuse halo (3-6px blur, opacity 0.25)
    // -------------------------------------------------------------
    ctx.save();
    ctx.filter = 'blur(4px)';
    ctx.strokeStyle = 'rgba(104, 10, 20, 0.25)'; // #680A14 at 0.25 opacity
    ctx.lineWidth = Math.max(wound.maxHalfWidth * gape * 1.4, 6.0);
    ctx.lineJoin = 'round';
    ctx.stroke(lensPath);
    ctx.restore();

    // -------------------------------------------------------------
    // B. Beveled Lip Lower Edge: soft inner occlusion shadow dropping interior below canvas
    // -------------------------------------------------------------
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.bezierCurveTo(cBot0.x, cBot0.y, cBot1.x, cBot1.y, p1.x, p1.y);
    ctx.strokeStyle = 'rgba(20, 2, 5, 0.55)'; // Deep inner shadow
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();

    // -------------------------------------------------------------
    // C. Trench Void: Near-black hematite (#120104) to arterial crimson (#680A14)
    // -------------------------------------------------------------
    ctx.save();
    ctx.clip(lensPath);

    // Deep linear gradient along normal vector
    const grad = ctx.createLinearGradient(
      (cTop0.x + cTop1.x) * 0.5, (cTop0.y + cTop1.y) * 0.5,
      (cBot0.x + cBot1.x) * 0.5, (cBot0.y + cBot1.y) * 0.5
    );
    grad.addColorStop(0, '#680A14');    // Arterial crimson near upper lip
    grad.addColorStop(0.48, '#120104'); // Clotted near-black hematite in deepest void
    grad.addColorStop(1, '#4A040C');    // Deep venous burgundy near lower lip

    ctx.fillStyle = grad;
    ctx.fill(lensPath);

    // Deepest central abyss line (Fontana spatial void)
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.strokeStyle = '#0A0002';
    ctx.lineWidth = Math.max(wound.maxHalfWidth * gape * 0.35, 1.8);
    ctx.lineCap = 'round';
    ctx.stroke();

    // -------------------------------------------------------------
    // D. Collagen Fibrils: 3 to 7 fine, semi-translucent fibrous threads spanning the gap
    // -------------------------------------------------------------
    for (const f of wound.fibrils) {
      ctx.beginPath();
      ctx.moveTo(f.topAnchor.x, f.topAnchor.y);
      ctx.quadraticCurveTo(f.mid.x, f.mid.y, f.botAnchor.x, f.botAnchor.y);
      ctx.strokeStyle = `rgba(225, 205, 210, ${f.alpha})`; // Pearlescent fibrous pink-ivory
      ctx.lineWidth = f.thickness;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // -------------------------------------------------------------
    // E. Wet Specular Highlights: tight, high-contrast white reflection curves
    // -------------------------------------------------------------
    // Upper inner wet gloss reflection curve
    ctx.beginPath();
    const specTop0 = this.sampleBezier(p0, cTop0, cTop1, p1, 0.25);
    const specTop1 = this.sampleBezier(p0, cTop0, cTop1, p1, 0.75);
    const specMidTop = this.sampleBezier(p0, cTop0, cTop1, p1, 0.5);
    ctx.moveTo(specTop0.x - wound.normal.x * 1.2, specTop0.y - wound.normal.y * 1.2);
    ctx.quadraticCurveTo(
      specMidTop.x - wound.normal.x * 1.5,
      specMidTop.y - wound.normal.y * 1.5,
      specTop1.x - wound.normal.x * 1.2,
      specTop1.y - wound.normal.y * 1.2
    );
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.restore(); // end clip

    // -------------------------------------------------------------
    // F. Beveled Lip Upper Edge: razor-thin bright specular edge stroke (#FFF7EE, opacity ~0.85)
    // Simulates taut skin catching overhead ambient light
    // -------------------------------------------------------------
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.bezierCurveTo(cTop0.x, cTop0.y, cTop1.x, cTop1.y, p1.x, p1.y);
    ctx.strokeStyle = 'rgba(255, 247, 238, 0.85)'; // #FFF7EE at 0.85 opacity
    ctx.lineWidth = 1.0;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Render viscous drips: deep venous clotted red (#4A040C), white leading specular glints, thin streaks
   */
  private renderFluids(ctx: CanvasRenderingContext2D): void {
    for (const drip of this.drips) {
      // 1. Thin glossy streak behind the drip
      if (drip.trail.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(drip.trail[0].x, drip.trail[0].y);
        for (let i = 1; i < drip.trail.length; i++) {
          ctx.lineTo(drip.trail[i].x, drip.trail[i].y);
        }
        ctx.strokeStyle = 'rgba(74, 4, 12, 0.75)'; // #4A040C
        ctx.lineWidth = Math.max(drip.radius * 0.7, 1.4);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Thin raised specular highlight on streak
        ctx.strokeStyle = 'rgba(255, 240, 245, 0.35)';
        ctx.lineWidth = 0.65;
        ctx.stroke();
        ctx.restore();
      }

      // 2. Viscous teardrop bulb
      ctx.save();
      ctx.translate(drip.x, drip.y);

      const angle = Math.atan2(drip.velY, drip.velX);
      ctx.rotate(angle - Math.PI / 2);

      // 3D Teardrop bulb gradient
      const grad = ctx.createRadialGradient(
        0, -drip.length * 0.15, 0,
        0, 0, drip.radius * 1.3
      );
      grad.addColorStop(0, '#700814');
      grad.addColorStop(0.65, '#4A040C'); // Deep venous clotted red (#4A040C)
      grad.addColorStop(1, '#200206');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, drip.length * 0.85);
      ctx.bezierCurveTo(
        drip.radius * 1.3, drip.length * 0.4,
        drip.radius * 1.2, -drip.radius * 0.8,
        0, -drip.radius * 1.1
      );
      ctx.bezierCurveTo(
        -drip.radius * 1.2, -drip.radius * 0.8,
        -drip.radius * 1.3, drip.length * 0.4,
        0, drip.length * 0.85
      );
      ctx.fill();

      // 3. Tiny white specular glint on leading bulb (liquid surface tension)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
      ctx.arc(drip.radius * 0.28, -drip.radius * 0.35, Math.max(drip.radius * 0.24, 0.65), 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // -------------------------------------------------------------
  // Public Controls
  // -------------------------------------------------------------

  public clear(): void {
    this.wounds = [];
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
  }
}
