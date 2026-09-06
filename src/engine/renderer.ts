/**
 * Consolidated Visceral Gallery Renderer — Concetto Biologico
 * 
 * Anatomically authentic visceral art installation (Lucio Fontana slash meets biological dermis):
 * - 1:1 Pixel Coordinate Space with strict window.devicePixelRatio support
 * - Living tactile base canvas: warm alabaster/vellum (#EDE6DC) with dermatoglyphics, micro-pores & mottled warmth
 * - Asymmetric micro-tearing: multi-frequency Langer's cleavage jitter, ragged notches, uneven gape ratio
 * - Stratified anatomical layers:
 *     1. Erythema / Bruising Halo: feathered subcutaneous micro-trauma (#3D101C to #85222E)
 *     2. Capillary Bleed (Dermal Wicking): spidering watercolor bleed into porous canvas fibers
 *     3. Retracted Epidermal Lip: 1px pale desiccated rim (#F5EEE4) with curled inner shadow
 *     4. Adipose Layer (Fat Globules): clustered glistening 3D yellowish-white lipid spheres (#EAD5A0)
 *     5. Dermis & Fascia Floor: fibrous, striated crimson-black void (#180205) with shadow clefts
 *     6. Meniscus Pooling & Coagulation: reflective dark pool (#360309 -> #1D0105) with aging semi-matte clot
 *     7. Wet Micro-Specular Glints: broken pinpoint flecks & Fresnel grazing reflections
 *     8. Quivering pearlescent collagen fibrils
 * - Viscous fluid mechanics: venous clotted drips with trails, capillary wicking & surface tension glints
 */

import { AudioEngine } from '../audio/audioEngine';

export interface CollagenFibril {
  u: number;
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

export interface LipidGlobule {
  u: number;
  side: 'top' | 'bot';
  distRatio: number; // offset relative to lip shelf
  radius: number;
  baseTone: string;
  shadowTone: string;
  specularAlpha: number;
}

export interface CapillaryWick {
  u: number;
  side: 'top' | 'bot';
  length: number;
  drift: number;
  width: number;
  alpha: number;
}

export interface FasciaStrand {
  u0: number;
  u1: number;
  crossOffset0: number;
  crossOffset1: number;
  color: string;
  width: number;
  alpha: number;
}

export interface SpecularFleck {
  u: number;
  sideOffset: number; // -1 to 1 across gape
  radius: number;
  baseAlpha: number;
  isLipid: boolean;
}

export interface ContourSample {
  u: number;
  envelope: number;
  lowFreq: number;
  midFreq: number;
  highFreq: number;
  notch: number;
}

export interface WoundSlice {
  id: string;
  createdAt: number;
  p0: { x: number; y: number };       // Razor needle entry point
  p1: { x: number; y: number };       // Exit point with drag micro-tear
  normal: { x: number; y: number };   // Unit normal
  tangent: { x: number; y: number };  // Unit tangent
  length: number;
  maxHalfWidth: number;               // Scaled by slice velocity
  currentGape: number;                // 150ms viscoelastic yawn [0.05 -> 1.0]

  // Anatomical asymmetry (Langer's lines drag)
  asymTop: number;
  asymBot: number;

  // Ragged micro-tearing contour samples
  topSamples: ContourSample[];
  botSamples: ContourSample[];

  // Anatomical strata
  adiposeGlobules: LipidGlobule[];
  capillaryWicks: CapillaryWick[];
  fasciaStrands: FasciaStrand[];
  fibrils: CollagenFibril[];
  specularFlecks: SpecularFleck[];

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

  // Offscreen pre-rendered living dermal canvas (vellum topography, pores & grain)
  private dermalCanvas: HTMLCanvasElement;
  private dermalCtx: CanvasRenderingContext2D;

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

    // Initialize offscreen dermal canvas
    this.dermalCanvas = document.createElement('canvas');
    this.dermalCtx = this.dermalCanvas.getContext('2d', { alpha: false })!;

    this.resize(window.innerWidth, window.innerHeight);
    this.startLoop();
  }

  /**
   * Pre-render living tactile dermal canvas with organic topography:
   * - Warm, desaturated alabaster/vellum base (#EDE6DC)
   * - Subcutaneous warmth mottling (subtle capillary blush & cream patches)
   * - Dermatoglyphics: micro-furrows oriented along natural cleavage lines
   * - Dermal micro-pores with relief shading (shadow + offset highlight)
   * - Fine micro-grain noise overlay
   */
  private initDermalCanvas(): void {
    const w = this.width;
    const h = this.height;
    const dpr = this.dpr;

    this.dermalCanvas.width = Math.round(w * dpr);
    this.dermalCanvas.height = Math.round(h * dpr);

    const dctx = this.dermalCtx;
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.scale(dpr, dpr);

    // 1. Base Alabaster/Vellum (#EDE6DC)
    dctx.fillStyle = '#EDE6DC';
    dctx.fillRect(0, 0, w, h);

    // 2. Subcutaneous Warmth Mottling (living skin undertones)
    const mottleBlobs = [
      { x: w * 0.28, y: h * 0.35, r: Math.max(w, h) * 0.42, color: 'rgba(238, 228, 216, 0.45)' },
      { x: w * 0.72, y: h * 0.62, r: Math.max(w, h) * 0.48, color: 'rgba(232, 222, 210, 0.38)' },
      { x: w * 0.48, y: h * 0.78, r: Math.max(w, h) * 0.35, color: 'rgba(235, 218, 212, 0.25)' }, // faint capillary blush
      { x: w * 0.82, y: h * 0.22, r: Math.max(w, h) * 0.38, color: 'rgba(244, 238, 230, 0.4)' },
    ];

    for (const b of mottleBlobs) {
      const grad = dctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      grad.addColorStop(0, b.color);
      grad.addColorStop(1, 'rgba(237, 230, 220, 0)');
      dctx.fillStyle = grad;
      dctx.fillRect(0, 0, w, h);
    }

    // 3. Dermatoglyphics: Micro-furrow grain oriented at subtle angle (~28 deg)
    dctx.save();
    dctx.globalAlpha = 0.04;
    dctx.strokeStyle = '#968878';
    dctx.lineWidth = 0.75;
    const furrowSpacing = 7;
    const angle = 0.48; // ~27.5 degrees
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const diag = Math.hypot(w, h);

    for (let offset = -diag * 0.5; offset < diag * 1.5; offset += furrowSpacing) {
      dctx.beginPath();
      // Introduce subtle organic waviness into dermatoglyphic lines
      const steps = 15;
      for (let s = 0; s <= steps; s++) {
        const t = (s / steps) * diag;
        const wave = Math.sin(t * 0.02 + offset * 0.05) * 2.2;
        const px = w * 0.5 + cosA * (t - diag * 0.5) - sinA * (offset + wave);
        const py = h * 0.5 + sinA * (t - diag * 0.5) + cosA * (offset + wave);
        if (s === 0) dctx.moveTo(px, py);
        else dctx.lineTo(px, py);
      }
      dctx.stroke();
    }
    dctx.restore();

    // 4. Dermal Micro-Pores with light-relief (shadow dot + tiny highlight dot)
    dctx.save();
    const poreCount = Math.floor((w * h) / 380); // ~5,000 pores on 1080p
    for (let p = 0; p < poreCount; p++) {
      const px = Math.random() * w;
      const py = Math.random() * h;
      const pr = 0.45 + Math.random() * 0.65;

      // Pore micro-cavity shadow
      dctx.fillStyle = 'rgba(178, 162, 146, 0.28)';
      dctx.beginPath();
      dctx.arc(px, py, pr, 0, Math.PI * 2);
      dctx.fill();

      // Top-left relief highlight rim catching ambient gallery light
      dctx.fillStyle = 'rgba(255, 252, 245, 0.4)';
      dctx.beginPath();
      dctx.arc(px - 0.4, py - 0.4, pr * 0.6, 0, Math.PI * 2);
      dctx.fill();
    }
    dctx.restore();

    // 5. Tactile Micro-Grain Pixel Noise
    const grainSize = 256;
    const tempGrain = document.createElement('canvas');
    tempGrain.width = grainSize;
    tempGrain.height = grainSize;
    const gctx = tempGrain.getContext('2d')!;
    const imgData = gctx.createImageData(grainSize, grainSize);
    const data = imgData.data;

    for (let i = 0; i < grainSize * grainSize; i++) {
      const noise = (Math.random() - 0.5) * 32;
      const idx = i * 4;
      data[idx] = 128 + noise;
      data[idx + 1] = 128 + noise;
      data[idx + 2] = 128 + noise;
      data[idx + 3] = 22; // subtle opacity
    }
    gctx.putImageData(imgData, 0, 0);

    dctx.save();
    dctx.globalCompositeOperation = 'multiply';
    dctx.fillStyle = dctx.createPattern(tempGrain, 'repeat')!;
    dctx.fillRect(0, 0, w, h);
    dctx.restore();
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

    this.initDermalCanvas();
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
    const norm = { x: -tan.y, y: tan.x }; // Perpendicular normal pointing outward

    // Gaping width governed by slice velocity: 8px to 34px
    const speedFactor = Math.min(Math.max((this.maxVelocity - 100) / 700, 0.35), 1.85);
    const maxHalfWidth = Math.min(Math.max(7.0 + speedFactor * 13.0, 6.0), 34.0);

    // 1. Asymmetric Tapering & Retraction (Kill perfect almond shape)
    // One side of the incision gaps wider than the other depending on blade drag angle & speed
    const asymTop = 0.88 + Math.random() * 0.48; // e.g. 1.25x
    const asymBot = (2.1 - asymTop) * (0.85 + Math.random() * 0.3); // e.g. 0.80x

    // 2. Multi-Frequency Jitter & Ragged Notches along Langer's lines
    const sampleCount = 48;
    const topSamples: ContourSample[] = [];
    const botSamples: ContourSample[] = [];

    // Random micro-tear notches where fibrous bands snapped
    const notchLocations = [
      { u: 0.25 + Math.random() * 0.15, depth: (Math.random() - 0.4) * 3.8 },
      { u: 0.55 + Math.random() * 0.18, depth: (Math.random() - 0.4) * 4.2 },
      { u: 0.78 + Math.random() * 0.12, depth: (Math.random() - 0.4) * 3.2 },
    ];

    const seedTop = Math.random() * 50;
    const seedBot = Math.random() * 50;

    for (let i = 0; i <= sampleCount; i++) {
      const u = i / sampleCount;

      // Parabolic tension envelope: steep retraction in center, razor-needle tapers at tips
      const envelope = Math.pow(Math.sin(u * Math.PI), 0.72);

      // Top edge multi-frequency noise
      const lowTop = Math.sin(u * Math.PI * 4.0 + seedTop) * 0.16;
      const midTop = Math.sin(u * Math.PI * 14.0 + seedTop * 1.5) * 0.1;
      const highTop = (Math.random() - 0.5) * 0.14;

      // Bottom edge multi-frequency noise (uncorrelated)
      const lowBot = Math.sin(u * Math.PI * 3.5 + seedBot) * 0.15;
      const midBot = Math.sin(u * Math.PI * 16.0 + seedBot * 1.7) * 0.09;
      const highBot = (Math.random() - 0.5) * 0.14;

      // Calculate localized micro-notch tear
      let notchTop = 0;
      let notchBot = 0;
      for (const n of notchLocations) {
        const dist = Math.abs(u - n.u);
        if (dist < 0.07) {
          const w = Math.cos((dist / 0.07) * (Math.PI * 0.5));
          notchTop += n.depth * w;
          notchBot -= n.depth * 0.75 * w;
        }
      }

      topSamples.push({
        u,
        envelope,
        lowFreq: lowTop,
        midFreq: midTop,
        highFreq: highTop,
        notch: notchTop,
      });

      botSamples.push({
        u,
        envelope,
        lowFreq: lowBot,
        midFreq: midBot,
        highFreq: highBot,
        notch: notchBot,
      });
    }

    // 3. Adipose Layer: Clustered 3D Lipid Spheres (#EAD5A0 with soft shading)
    // Small, irregular clusters of glistening yellowish-white lipid spheres along inner walls
    const lipidCount = Math.floor(14 + Math.random() * 12);
    const adiposeGlobules: LipidGlobule[] = [];

    for (let k = 0; k < lipidCount; k++) {
      const u = 0.14 + Math.random() * 0.72;
      const side: 'top' | 'bot' = Math.random() > 0.48 ? 'top' : 'bot';
      const r = 2.4 + Math.random() * 3.2; // 2.4px to 5.6px fat pearls
      const distRatio = 0.65 + Math.random() * 0.32; // tucked right beneath skin lip

      adiposeGlobules.push({
        u,
        side,
        distRatio,
        radius: r,
        baseTone: '#EAD5A0',
        shadowTone: '#B58D4B',
        specularAlpha: 0.75 + Math.random() * 0.25,
      });
    }

    // 4. Capillary Bleed (Dermal Wicking): Spidering watercolor bleed into porous canvas
    const wickCount = Math.floor(22 + Math.random() * 16);
    const capillaryWicks: CapillaryWick[] = [];

    for (let w = 0; w < wickCount; w++) {
      capillaryWicks.push({
        u: 0.08 + Math.random() * 0.84,
        side: Math.random() > 0.5 ? 'top' : 'bot',
        length: 2.5 + Math.random() * 6.0, // 2.5 to 8.5px wicking into canvas fibers
        drift: (Math.random() - 0.5) * 4.0,
        width: 0.75 + Math.random() * 1.1,
        alpha: 0.28 + Math.random() * 0.32,
      });
    }

    // 5. Dermis & Fascia Floor: Stringy crimson-black tissue strands with shadow crevices
    const fasciaCount = Math.floor(8 + Math.random() * 7);
    const fasciaStrands: FasciaStrand[] = [];

    for (let f = 0; f < fasciaCount; f++) {
      const u0 = 0.15 + Math.random() * 0.3;
      const u1 = u0 + 0.25 + Math.random() * 0.4;
      fasciaStrands.push({
        u0,
        u1: Math.min(u1, 0.9),
        crossOffset0: (Math.random() - 0.5) * 0.6,
        crossOffset1: (Math.random() - 0.5) * 0.6,
        color: Math.random() > 0.4 ? '#180205' : '#2A0308',
        width: 1.0 + Math.random() * 2.2,
        alpha: 0.6 + Math.random() * 0.35,
      });
    }

    // 6. Quivering Pearlescent Collagen Fibrils
    const fibrilCount = Math.floor(3 + Math.random() * 4.5);
    const fibrils: CollagenFibril[] = [];

    for (let k = 0; k < fibrilCount; k++) {
      const u = 0.18 + (k / (fibrilCount - 1 || 1)) * 0.64 + (Math.random() - 0.5) * 0.06;
      const topPt = this.sampleContourPoint(p0, tan, norm, len, maxHalfWidth * asymTop, topSamples, u, 1.0, 1);
      const botPt = this.sampleContourPoint(p0, tan, norm, len, maxHalfWidth * asymBot, botSamples, u, 1.0, -1);
      const mid = {
        x: (topPt.x + botPt.x) * 0.5 + (Math.random() - 0.5) * 3.0,
        y: (topPt.y + botPt.y) * 0.5 + (Math.random() - 0.5) * 3.0,
      };

      fibrils.push({
        u,
        topAnchor: topPt,
        botAnchor: botPt,
        mid,
        vel: { x: (Math.random() - 0.5) * 30, y: (Math.random() - 0.5) * 30 },
        thickness: 0.75 + Math.random() * 0.55,
        alpha: 0.45 + Math.random() * 0.25,
        quiverPhase: Math.random() * Math.PI * 2,
        quiverFreq: 22.0 + Math.random() * 14.0,
      });
    }

    // 7. Wet Micro-Specular & Fresnel Glints (No single white lines!)
    // Clustered broken glints catching ambient light on wet visceral bumps
    const fleckCount = Math.floor(22 + Math.random() * 18);
    const specularFlecks: SpecularFleck[] = [];

    for (let s = 0; s < fleckCount; s++) {
      const u = 0.12 + Math.random() * 0.76;
      const isLipid = Math.random() > 0.45;
      // Clustered towards edges (grazing Fresnel angles)
      const sideOffset = (Math.random() > 0.5 ? 1 : -1) * (0.45 + Math.random() * 0.48);

      specularFlecks.push({
        u,
        sideOffset,
        radius: 0.6 + Math.random() * 1.3,
        baseAlpha: 0.7 + Math.random() * 0.3,
        isLipid,
      });
    }

    const wound: WoundSlice = {
      id: `wound_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: now,
      p0,
      p1,
      normal: norm,
      tangent: tan,
      length: len,
      maxHalfWidth,
      currentGape: 0.05, // starts narrow, yawns open over 150ms
      asymTop,
      asymBot,
      topSamples,
      botSamples,
      adiposeGlobules,
      capillaryWicks,
      fasciaStrands,
      fibrils,
      specularFlecks,
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

  /**
   * Sample dynamic point on jagged micro-torn contour at parameter u
   */
  private sampleContourPoint(
    p0: { x: number; y: number },
    tan: { x: number; y: number },
    norm: { x: number; y: number },
    len: number,
    halfWidth: number,
    samples: ContourSample[],
    u: number,
    gape: number,
    direction: 1 | -1
  ): { x: number; y: number } {
    const clampedU = Math.max(0, Math.min(1, u));
    const idxExact = clampedU * (samples.length - 1);
    const i0 = Math.floor(idxExact);
    const i1 = Math.min(i0 + 1, samples.length - 1);
    const frac = idxExact - i0;

    const s0 = samples[i0];
    const s1 = samples[i1];

    const env = s0.envelope * (1 - frac) + s1.envelope * frac;
    const low = s0.lowFreq * (1 - frac) + s1.lowFreq * frac;
    const mid = s0.midFreq * (1 - frac) + s1.midFreq * frac;
    const high = s0.highFreq * (1 - frac) + s1.highFreq * frac;
    const notch = s0.notch * (1 - frac) + s1.notch * frac;

    // Needle tip damping: clean sharp needle entry at tips
    const tipTaper = Math.min(clampedU / 0.06, (1 - clampedU) / 0.06, 1.0);
    const jitter = (low + mid + high) * tipTaper;
    const amplitude = (halfWidth * env * (1.0 + jitter) + notch * tipTaper) * gape;

    return {
      x: p0.x + tan.x * (clampedU * len) + norm.x * (direction * amplitude),
      y: p0.y + tan.y * (clampedU * len) + norm.y * (direction * amplitude),
    };
  }

  /**
   * Calculate point along cut axis with jagged normal offset
   */
  private getRaggedPoint(
    wound: WoundSlice,
    u: number,
    isTop: boolean,
    gape: number,
    extraOffset: number = 0
  ): { x: number; y: number } {
    const p0 = wound.p0;
    const tan = wound.tangent;
    const norm = wound.normal;
    const len = wound.length;
    const samples = isTop ? wound.topSamples : wound.botSamples;
    const asym = isTop ? wound.asymTop : wound.asymBot;
    const dir = isTop ? 1 : -1;

    const clampedU = Math.max(0, Math.min(1, u));
    const idxExact = clampedU * (samples.length - 1);
    const i0 = Math.floor(idxExact);
    const i1 = Math.min(i0 + 1, samples.length - 1);
    const frac = idxExact - i0;

    const s0 = samples[i0];
    const s1 = samples[i1];

    const env = s0.envelope * (1 - frac) + s1.envelope * frac;
    const low = s0.lowFreq * (1 - frac) + s1.lowFreq * frac;
    const mid = s0.midFreq * (1 - frac) + s1.midFreq * frac;
    const high = s0.highFreq * (1 - frac) + s1.highFreq * frac;
    const notch = s0.notch * (1 - frac) + s1.notch * frac;

    // Needle tips taper sharply to 0 amplitude
    const tipDamp = Math.min(clampedU / 0.05, (1 - clampedU) / 0.05, 1.0);
    const jitter = (low + mid + high) * tipDamp;
    const amplitude = (wound.maxHalfWidth * asym * env * (1.0 + jitter) + notch * tipDamp) * gape + extraOffset * tipDamp;

    return {
      x: p0.x + tan.x * (clampedU * len) + norm.x * (dir * amplitude),
      y: p0.y + tan.y * (clampedU * len) + norm.y * (dir * amplitude),
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

        const currentTop = this.getRaggedPoint(wound, f.u, true, wound.currentGape);
        const currentBot = this.getRaggedPoint(wound, f.u, false, wound.currentGape);
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

      // Spawn viscous drips along downward-facing ragged lip
      if (!wound.dripsSpawned && ageMs > 120) {
        wound.dripsSpawned = true;
        // Check downward-facing lip: if normal.y is positive, top is downward, else bottom is downward
        const isLowerLipBot = wound.normal.y < 0.15;
        const dripCount = Math.min(Math.floor(1 + Math.random() * 2.5), 3);

        for (let d = 0; d < dripCount; d++) {
          const uDrip = 0.28 + Math.random() * 0.44;
          const spawnPt = this.getRaggedPoint(wound, uDrip, !isLowerLipBot, wound.currentGape);

          this.drips.push({
            x: spawnPt.x,
            y: spawnPt.y,
            velX: (Math.random() - 0.5) * 3.0,
            velY: 9.0 + Math.random() * 14.0, // High initial drag, slow crawl
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

  // -------------------------------------------------------------
  // Master Render Pass
  // -------------------------------------------------------------

  public render(now: number): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // 1. Draw Living Dermal Canvas (warm alabaster + micro-dermatoglyphics + pores + grain)
    ctx.drawImage(this.dermalCanvas, 0, 0, w, h);

    // 2. Render each wound with Anatomical Stratification
    for (const wound of this.wounds) {
      this.renderWound(ctx, wound, now);
    }

    // 3. Render Viscous Fluid Teardrops, Streaks & Capillary Halo
    this.renderFluids(ctx);

    // 4. Active drag slice preview
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

    // 5. Perimeter Ambient Vignette (soft museum exhibition gallery lighting)
    const vigGrad = ctx.createRadialGradient(
      w * 0.5, h * 0.5, Math.min(w, h) * 0.35,
      w * 0.5, h * 0.5, Math.hypot(w * 0.5, h * 0.5)
    );
    vigGrad.addColorStop(0, 'rgba(18, 14, 12, 0)');
    vigGrad.addColorStop(0.75, 'rgba(18, 14, 12, 0.11)');
    vigGrad.addColorStop(1, 'rgba(18, 14, 12, 0.26)');

    ctx.save();
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /**
   * Render Layered Anatomical Wound:
   * 1. Erythema / Bruising Halo (subcutaneous micro-trauma)
   * 2. Capillary Bleed (dermal wicking into canvas fibers)
   * 3. Deep Cavity Void & Striated Fascia Floor (#180205)
   * 4. Meniscus Pooling with Visceral Coagulation Shift (#360309 -> #1D0105)
   * 5. Adipose Layer (glistening 3D lipid fat spheres #EAD5A0)
   * 6. Quivering Pearlescent Collagen Fibrils
   * 7. Broken Wet Micro-Specular Glints & Grazing Fresnel Highlights
   * 8. Retracted Epidermal Lip (1px pale rim #F5EEE4 + inner curled shadow)
   */
  private renderWound(ctx: CanvasRenderingContext2D, wound: WoundSlice, now: number): void {
    const gape = wound.currentGape;
    const ageSec = (now - wound.createdAt) / 1000;
    // Coagulation factor over 10 seconds: shifts blood from bright venous to dark clotted semi-matte
    const clotFactor = Math.min(ageSec / 10.0, 1.0);

    const steps = 40;

    // Construct jagged contour paths
    const topPts: { x: number; y: number }[] = [];
    const botPts: { x: number; y: number }[] = [];
    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      topPts.push(this.getRaggedPoint(wound, u, true, gape));
      botPts.push(this.getRaggedPoint(wound, u, false, gape));
    }

    // Main wound cavity polygon
    const cavityPath = new Path2D();
    cavityPath.moveTo(wound.p0.x, wound.p0.y);
    for (let i = 0; i <= steps; i++) {
      cavityPath.lineTo(topPts[i].x, topPts[i].y);
    }
    cavityPath.lineTo(wound.p1.x, wound.p1.y);
    for (let i = steps; i >= 0; i--) {
      cavityPath.lineTo(botPts[i].x, botPts[i].y);
    }
    cavityPath.closePath();

    // -------------------------------------------------------------
    // 1. ERYTHEMA / BRUISING HALO (Subcutaneous Micro-Trauma)
    // Deep violet #3D101C fading into capillary flush #85222E (10-18px radius)
    // -------------------------------------------------------------
    ctx.save();
    ctx.filter = 'blur(6px)';
    ctx.globalCompositeOperation = 'multiply';

    const haloPath = new Path2D();
    const haloTop: { x: number; y: number }[] = [];
    const haloBot: { x: number; y: number }[] = [];
    const haloRadius = 12.0;

    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      haloTop.push(this.getRaggedPoint(wound, u, true, gape, haloRadius));
      haloBot.push(this.getRaggedPoint(wound, u, false, gape, haloRadius));
    }

    haloPath.moveTo(wound.p0.x, wound.p0.y);
    for (const p of haloTop) haloPath.lineTo(p.x, p.y);
    haloPath.lineTo(wound.p1.x, wound.p1.y);
    for (let i = haloBot.length - 1; i >= 0; i--) haloPath.lineTo(haloBot[i].x, haloBot[i].y);
    haloPath.closePath();

    // Soft subcutaneous hematoma gradient
    ctx.fillStyle = 'rgba(61, 16, 28, 0.42)'; // #3D101C deep violet bruise
    ctx.fill(haloPath);

    // Inner capillary flush ring
    ctx.strokeStyle = 'rgba(133, 34, 46, 0.35)'; // #85222E capillary flush
    ctx.lineWidth = 8.0;
    ctx.stroke(cavityPath);
    ctx.restore();

    // -------------------------------------------------------------
    // 2. CAPILLARY BLEED (Dermal Wicking into Canvas Fibers)
    // Uneven, spidering watercolor bleed spreading outward into porous vellum
    // -------------------------------------------------------------
    ctx.save();
    ctx.strokeStyle = 'rgba(90, 8, 16, 0.36)'; // venous bleed
    ctx.lineCap = 'round';
    for (const wick of wound.capillaryWicks) {
      const isTop = wick.side === 'top';
      const edgePt = this.getRaggedPoint(wound, wick.u, isTop, gape);
      const dir = isTop ? 1 : -1;
      const endX = edgePt.x + wound.normal.x * (dir * wick.length * gape) + wound.tangent.x * wick.drift;
      const endY = edgePt.y + wound.normal.y * (dir * wick.length * gape) + wound.tangent.y * wick.drift;
      const midX = (edgePt.x + endX) * 0.5 + (Math.random() - 0.5) * 1.5;
      const midY = (edgePt.y + endY) * 0.5 + (Math.random() - 0.5) * 1.5;

      ctx.beginPath();
      ctx.moveTo(edgePt.x, edgePt.y);
      ctx.quadraticCurveTo(midX, midY, endX, endY);
      ctx.lineWidth = wick.width;
      ctx.globalAlpha = wick.alpha;
      ctx.stroke();
    }
    ctx.restore();

    // -------------------------------------------------------------
    // 3. CAVITY VOID & RETRACTED DERMAL WALL (Clip to inside cavity)
    // -------------------------------------------------------------
    ctx.save();
    ctx.clip(cavityPath);

    // A. Deep Void Trench Gradient
    const midTop = topPts[Math.floor(steps * 0.5)];
    const midBot = botPts[Math.floor(steps * 0.5)];
    const trenchGrad = ctx.createLinearGradient(midTop.x, midTop.y, midBot.x, midBot.y);

    // Colors shift dynamically from fresh venous red to aged clotted hematite
    const wallRed = clotFactor < 0.5 ? '#4D0610' : '#2A0208';
    const floorBlack = '#0A0002'; // Fontana deep spatial abyss
    const botWall = clotFactor < 0.5 ? '#36040A' : '#180104';

    trenchGrad.addColorStop(0, wallRed);
    trenchGrad.addColorStop(0.48, floorBlack);
    trenchGrad.addColorStop(1, botWall);

    ctx.fillStyle = trenchGrad;
    ctx.fill(cavityPath);

    // B. Dermis & Fascia Floor: Stringy, fibrous crimson-black tissue strands with shadow crevices
    for (const strand of wound.fasciaStrands) {
      const pA = this.getRaggedPoint(wound, strand.u0, true, gape * 0.5);
      const pB = this.getRaggedPoint(wound, strand.u1, false, gape * 0.5);
      const midX = (pA.x + pB.x) * 0.5 + wound.normal.x * strand.crossOffset0 * 5.0;
      const midY = (pA.y + pB.y) * 0.5 + wound.normal.y * strand.crossOffset0 * 5.0;

      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.quadraticCurveTo(midX, midY, pB.x, pB.y);
      ctx.strokeStyle = strand.color; // #180205 fibrous crimson-black
      ctx.lineWidth = strand.width * gape;
      ctx.globalAlpha = strand.alpha;
      ctx.stroke();

      // Pale fascia micro-fiber highlights
      ctx.strokeStyle = 'rgba(215, 175, 180, 0.18)';
      ctx.lineWidth = 0.65;
      ctx.stroke();
    }

    // Central deepest crevice line (Lucio Fontana cut void)
    ctx.beginPath();
    ctx.moveTo(wound.p0.x, wound.p0.y);
    ctx.lineTo(wound.p1.x, wound.p1.y);
    ctx.strokeStyle = '#050001';
    ctx.lineWidth = Math.max(wound.maxHalfWidth * gape * 0.28, 1.6);
    ctx.stroke();

    // -------------------------------------------------------------
    // 4. MENISCUS POOLING (Viscous Blood in Lowest Crevices)
    // Dark reflective pool (#360309) coagulating to semi-matte clotted burgundy (#1D0105)
    // -------------------------------------------------------------
    const poolGrad = ctx.createLinearGradient(wound.p0.x, wound.p0.y, wound.p1.x, wound.p1.y);
    const poolColor = clotFactor < 0.6 ? '#360309' : '#1D0105';
    poolGrad.addColorStop(0, 'rgba(30, 2, 6, 0.4)');
    poolGrad.addColorStop(0.5, poolColor);
    poolGrad.addColorStop(1, 'rgba(30, 2, 6, 0.4)');

    ctx.save();
    ctx.beginPath();
    // Pool fills bottom interior 45% of the wound gap
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const pt = this.getRaggedPoint(wound, u, false, gape * 0.7);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    for (let i = steps; i >= 0; i--) {
      ctx.lineTo(botPts[i].x, botPts[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = poolGrad;
    ctx.globalAlpha = 0.85;
    ctx.fill();

    // Meniscus liquid edge highlight (surface tension curve)
    if (clotFactor < 0.8) {
      ctx.strokeStyle = `rgba(255, 230, 235, ${0.45 * (1.0 - clotFactor * 0.7)})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.restore();

    // -------------------------------------------------------------
    // 5. ADIPOSE LAYER (Subcutaneous Lipid Fat Globules)
    // Glistening yellowish-white lipid spheres (#EAD5A0 with 3D spherical shading)
    // -------------------------------------------------------------
    for (const glob of wound.adiposeGlobules) {
      const isTop = glob.side === 'top';
      const edgePt = this.getRaggedPoint(wound, glob.u, isTop, gape * glob.distRatio);

      // 3D Spherical volume gradient
      const radGrad = ctx.createRadialGradient(
        edgePt.x - glob.radius * 0.35, edgePt.y - glob.radius * 0.35, glob.radius * 0.1,
        edgePt.x, edgePt.y, glob.radius
      );
      radGrad.addColorStop(0, '#FFF5D6');   // Creamy lipid crest
      radGrad.addColorStop(0.35, '#EAD5A0'); // Lipid sphere body (#EAD5A0)
      radGrad.addColorStop(0.75, '#B88D46'); // Amber subsurface shadow
      radGrad.addColorStop(1, '#4A0C14');    // Interstitial venous depth

      ctx.save();
      ctx.beginPath();
      ctx.arc(edgePt.x, edgePt.y, glob.radius * Math.min(gape * 1.2, 1.0), 0, Math.PI * 2);
      ctx.fillStyle = radGrad;
      ctx.fill();

      // Wet pinpoint specular highlight on fat globule crest
      if (clotFactor < 0.85) {
        ctx.fillStyle = `rgba(255, 255, 255, ${glob.specularAlpha * (1.0 - clotFactor * 0.5)})`;
        ctx.beginPath();
        ctx.arc(
          edgePt.x - glob.radius * 0.28,
          edgePt.y - glob.radius * 0.28,
          Math.max(glob.radius * 0.26, 0.65),
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      ctx.restore();
    }

    // -------------------------------------------------------------
    // 6. COLLAGEN FIBRILS (Quivering Pearlescent Strands)
    // -------------------------------------------------------------
    for (const f of wound.fibrils) {
      ctx.beginPath();
      ctx.moveTo(f.topAnchor.x, f.topAnchor.y);
      ctx.quadraticCurveTo(f.mid.x, f.mid.y, f.botAnchor.x, f.botAnchor.y);
      ctx.strokeStyle = `rgba(228, 210, 214, ${f.alpha})`;
      ctx.lineWidth = f.thickness;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // -------------------------------------------------------------
    // 7. WET MICRO-SPECULAR & FRESNEL GLINTS (No Single White Lines!)
    // Clustered broken glints & droplets catching ambient light on bumpy viscera
    // -------------------------------------------------------------
    const wetIntensity = Math.max(1.0 - clotFactor * 0.68, 0.22); // dims as blood coagulates
    for (const fleck of wound.specularFlecks) {
      const isTop = fleck.sideOffset > 0;
      const edgePt = this.getRaggedPoint(wound, fleck.u, isTop, gape * (0.8 + Math.abs(fleck.sideOffset) * 0.18));

      // Fresnel grazing reflectivity: brighter glints near the retracted edge
      const fresnelBoost = 1.0 + Math.abs(fleck.sideOffset) * 0.35;
      const alpha = fleck.baseAlpha * wetIntensity * fresnelBoost;

      ctx.save();
      // Soft bloom halo
      ctx.fillStyle = `rgba(255, 245, 238, ${alpha * 0.4})`;
      ctx.beginPath();
      ctx.arc(edgePt.x, edgePt.y, fleck.radius * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Sharp specular glint core
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(edgePt.x, edgePt.y, fleck.radius * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore(); // End cavity clip

    // -------------------------------------------------------------
    // 8. EPIDERMAL LIP & INNER OCCLUSION SHADOW (The Retracted Skin Edge)
    // Faint 1px pale/whitish desiccated rim (#F5EEE4) where top skin curls backward from tension
    // Paired with immediate inner drop shadow showing depth
    // -------------------------------------------------------------
    ctx.save();

    // Inner shadow under curled lip shelf
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      if (i === 0) ctx.moveTo(botPts[i].x, botPts[i].y);
      else ctx.lineTo(botPts[i].x, botPts[i].y);
    }
    ctx.strokeStyle = 'rgba(22, 2, 6, 0.6)'; // Deep inner shelf shadow
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Pale Desiccated Keratin Rim along top and bottom ragged lips
    ctx.lineWidth = 1.15;
    ctx.strokeStyle = 'rgba(245, 238, 228, 0.82)'; // #F5EEE4 retracted edge

    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      if (i === 0) ctx.moveTo(topPts[i].x, topPts[i].y);
      else ctx.lineTo(topPts[i].x, topPts[i].y);
    }
    ctx.stroke();

    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      if (i === 0) ctx.moveTo(botPts[i].x, botPts[i].y);
      else ctx.lineTo(botPts[i].x, botPts[i].y);
    }
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render viscous fluid mechanics:
   * - Deep venous clotted red (#4A040C)
   * - Capillary halo & wicking along trails
   * - Teardrop heads with surface-tension leading specular glints
   * - Progressive coagulation into semi-matte clotted burgundy over age
   */
  private renderFluids(ctx: CanvasRenderingContext2D): void {
    for (const drip of this.drips) {
      const dripAgeRatio = Math.min(drip.age / 12.0, 1.0);
      const isCoagulated = dripAgeRatio > 0.65;

      // 1. Capillary bleed halo along drip streak
      if (drip.trail.length > 1) {
        ctx.save();
        ctx.filter = 'blur(2px)';
        ctx.beginPath();
        ctx.moveTo(drip.trail[0].x, drip.trail[0].y);
        for (let i = 1; i < drip.trail.length; i++) {
          ctx.lineTo(drip.trail[i].x, drip.trail[i].y);
        }
        ctx.strokeStyle = 'rgba(100, 10, 22, 0.22)';
        ctx.lineWidth = drip.radius * 2.2;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();

        // 2. Glossy venous blood trail
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(drip.trail[0].x, drip.trail[0].y);
        for (let i = 1; i < drip.trail.length; i++) {
          ctx.lineTo(drip.trail[i].x, drip.trail[i].y);
        }
        const trailColor = isCoagulated ? 'rgba(32, 2, 6, 0.85)' : 'rgba(74, 4, 12, 0.8)';
        ctx.strokeStyle = trailColor; // #4A040C
        ctx.lineWidth = Math.max(drip.radius * 0.75, 1.4);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Broken micro-specular glint along fresh streak
        if (!isCoagulated) {
          ctx.strokeStyle = 'rgba(255, 235, 240, 0.35)';
          ctx.lineWidth = 0.65;
          ctx.stroke();
        }
        ctx.restore();
      }

      // 3. 3D Viscous Teardrop Bulb
      ctx.save();
      ctx.translate(drip.x, drip.y);

      const angle = Math.atan2(drip.velY, drip.velX);
      ctx.rotate(angle - Math.PI / 2);

      const grad = ctx.createRadialGradient(
        0, -drip.length * 0.15, 0,
        0, 0, drip.radius * 1.3
      );
      const headColor = isCoagulated ? '#300206' : '#6A0814';
      const bodyColor = isCoagulated ? '#1E0105' : '#4A040C';
      grad.addColorStop(0, headColor);
      grad.addColorStop(0.65, bodyColor);
      grad.addColorStop(1, '#100103');

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

      // 4. White leading specular glint on bulb (liquid surface tension)
      if (!isCoagulated) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.beginPath();
        ctx.arc(drip.radius * 0.28, -drip.radius * 0.35, Math.max(drip.radius * 0.25, 0.65), 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Semi-matte dull reflection for clotted blood
        ctx.fillStyle = 'rgba(220, 180, 185, 0.3)';
        ctx.beginPath();
        ctx.arc(drip.radius * 0.28, -drip.radius * 0.35, Math.max(drip.radius * 0.25, 0.65), 0, Math.PI * 2);
        ctx.fill();
      }

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
