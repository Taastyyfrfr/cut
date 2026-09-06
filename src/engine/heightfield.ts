/**
 * Dynamic Heightfield & Organic Trench Physics
 * 
 * 1. 1:1 Canvas resolution with bilinear filtering to prevent jagged/crunchy stepping.
 * 2. Smooth organic cross-section profile:
 *    - Parabolic trench floor (-100% depth)
 *    - Raised curled outer lip (+5% height)
 *    - Lenticular almond taper to needle-thin endpoints
 * 3. Subtle connective tissue strands (2-4 fine fibers spanning narrow sections)
 * 4. Viscous fluid mechanics (crevice pooling & slow viscous gravity flow)
 */

import { Vec2 } from './physics';

export interface SlicePoint {
  x: number;
  y: number;
  t: number;
  pressure: number;
}

export interface ConnectiveStrand {
  pA: Vec2;
  pB: Vec2;
  mid: Vec2;
  vel: Vec2;
  thickness: number;
  alpha: number;
  quiverPhase: number;
  quiverFreq: number;
}

export class Heightfield {
  public width: number;
  public height: number;
  public simWidth: number;
  public simHeight: number;

  // Packed simulation buffer: Float32Array [R, G, B, A]
  // R: Height (trench down to -1.0, curled lip up to +0.05)
  // G: Fluid volume
  // B: Capillary stain
  // A: Connective strand mask
  public data: Float32Array;

  // Offscreen canvas and texture data for WebGL upload
  public textureCanvas: HTMLCanvasElement;
  public textureCtx: CanvasRenderingContext2D;
  public textureImageData: ImageData;

  // Active connective tissue strands (subtle, 2-4 fibers per cut)
  public strands: ConnectiveStrand[] = [];

  // Active stroke buffer
  private strokeBuffer: SlicePoint[] = [];

  constructor(width: number, height: number, dpr: number = 1.0) {
    this.width = width;
    this.height = height;

    // High resolution grid (matching physical viewport pixels, capped at 2048)
    const targetW = Math.round(width * Math.min(dpr, 1.5));
    const targetH = Math.round(height * Math.min(dpr, 1.5));
    const maxDim = 2048;

    if (targetW > maxDim || targetH > maxDim) {
      const scale = maxDim / Math.max(targetW, targetH);
      this.simWidth = Math.floor(targetW * scale);
      this.simHeight = Math.floor(targetH * scale);
    } else {
      this.simWidth = Math.max(targetW, 512);
      this.simHeight = Math.max(targetH, 512);
    }

    const pixelCount = this.simWidth * this.simHeight;
    this.data = new Float32Array(pixelCount * 4);

    this.textureCanvas = document.createElement('canvas');
    this.textureCanvas.width = this.simWidth;
    this.textureCanvas.height = this.simHeight;
    this.textureCtx = this.textureCanvas.getContext('2d', { willReadFrequently: false })!;
    this.textureImageData = this.textureCtx.createImageData(this.simWidth, this.simHeight);

    this.clear();
  }

  public resize(width: number, height: number, dpr: number = 1.0): void {
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;

    const targetW = Math.round(width * Math.min(dpr, 1.5));
    const targetH = Math.round(height * Math.min(dpr, 1.5));
    const maxDim = 2048;

    if (targetW > maxDim || targetH > maxDim) {
      const scale = maxDim / Math.max(targetW, targetH);
      this.simWidth = Math.floor(targetW * scale);
      this.simHeight = Math.floor(targetH * scale);
    } else {
      this.simWidth = Math.max(targetW, 512);
      this.simHeight = Math.max(targetH, 512);
    }

    const pixelCount = this.simWidth * this.simHeight;
    this.data = new Float32Array(pixelCount * 4);

    this.textureCanvas.width = this.simWidth;
    this.textureCanvas.height = this.simHeight;
    this.textureImageData = this.textureCtx.createImageData(this.simWidth, this.simHeight);

    this.clear();
  }

  public beginSlice(screenX: number, screenY: number, pressure: number = 1.0): void {
    const sx = (screenX / this.width) * this.simWidth;
    const sy = (screenY / this.height) * this.simHeight;
    this.strokeBuffer = [{ x: sx, y: sy, t: performance.now(), pressure }];
  }

  /**
   * Add slice movement: carves organic trench with lenticular taper and raised curled lips
   */
  public addSlicePoint(screenX: number, screenY: number, pressure: number = 1.0): { velocity: number; normal: Vec2 } | null {
    if (this.strokeBuffer.length === 0) return null;

    const sx = (screenX / this.width) * this.simWidth;
    const sy = (screenY / this.height) * this.simHeight;
    const now = performance.now();

    const last = this.strokeBuffer[this.strokeBuffer.length - 1];
    const dx = sx - last.x;
    const dy = sy - last.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 2.5) return null;

    const dt = Math.max((now - last.t) / 1000, 0.001);
    const velocity = dist / dt;

    this.strokeBuffer.push({ x: sx, y: sy, t: now, pressure });

    const tanX = dx / dist;
    const tanY = dy / dist;
    const normX = -tanY;
    const normY = tanX;

    // Smooth velocity modulation: widest at peak velocity, needle-thin at edges
    const speedFactor = Math.min(Math.max((velocity - 60) / 650, 0.3), 1.6);
    const halfWidth = Math.min(Math.max((5.0 + speedFactor * 10.0) * pressure, 3.0), 22.0);
    const depth = Math.min(0.8 + speedFactor * 0.2, 1.0);

    // Carve trench segment
    this.carveSmoothTrench(last.x, last.y, sx, sy, normX, normY, halfWidth, depth, pressure);

    return {
      velocity,
      normal: new Vec2(normX, normY),
    };
  }

  public endSlice(): void {
    if (this.strokeBuffer.length >= 2) {
      // Spawn 2 to 4 subtle connective strands across narrow sections
      this.generateSubtleStrands();
    }
    this.strokeBuffer = [];
  }

  /**
   * Carves a continuous smooth organic trench profile:
   * - Smooth parabolic trench (-100% depth)
   * - Raised slightly curled outer lip (+5% height)
   * - Smooth zero slope transitions
   */
  private carveSmoothTrench(
    x0: number, y0: number,
    x1: number, y1: number,
    normX: number, normY: number,
    halfWidth: number,
    depth: number,
    pressure: number
  ): void {
    const sw = this.simWidth;
    const sh = this.simHeight;

    const dx = x1 - x0;
    const dy = y1 - y0;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(Math.ceil(segLen / 1.0), 1);

    const influenceRadius = halfWidth * 1.5;

    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      const cx = x0 + dx * u;
      const cy = y0 + dy * u;

      const minX = Math.max(0, Math.floor(cx - influenceRadius));
      const maxX = Math.min(sw - 1, Math.ceil(cx + influenceRadius));
      const minY = Math.max(0, Math.floor(cy - influenceRadius));
      const maxY = Math.min(sh - 1, Math.ceil(cy + influenceRadius));

      for (let py = minY; py <= maxY; py++) {
        for (let px = minX; px <= maxX; px++) {
          const rx = px - cx;
          const ry = py - cy;

          // Distance along segment normal
          const distNorm = Math.abs(rx * normX + ry * normY);
          // Distance along segment tangent
          const distTang = Math.abs(rx * (-normY) + ry * normX);

          if (distTang > 1.8) continue;
          if (distNorm > influenceRadius) continue;

          const idx = (py * sw + px) * 4;
          const dRel = distNorm / halfWidth;

          // -----------------------------------------------------------
          // Organic Continuous Profile:
          // 0.0 <= dRel <= 1.0: Parabolic trench down to -100% depth
          // 1.0 < dRel <= 1.45: Raised curled outer lip (+5% height)
          // -----------------------------------------------------------
          let targetH = 0.0;

          if (dRel <= 1.0) {
            // Parabolic trench: -depth * (1.0 - dRel^2)
            targetH = -depth * (1.0 - dRel * dRel);
          } else if (dRel <= 1.45) {
            // Raised curled outer lip: +5% height (+0.05)
            const lipPhase = (dRel - 1.0) / 0.45;
            targetH = 0.05 * Math.sin(lipPhase * Math.PI) * depth;
          }

          // Smoothly carve into heightfield (deepest depth wins)
          if (targetH < 0.0) {
            this.data[idx] = Math.min(this.data[idx], targetH);
          } else if (this.data[idx] >= 0.0) {
            this.data[idx] = Math.max(this.data[idx], targetH);
          }

          // Pool blood inside the trench bed
          if (dRel < 0.75) {
            const bloodVol = (1.0 - (dRel / 0.75)) * 0.75 * pressure;
            this.data[idx + 1] = Math.min(this.data[idx + 1] + bloodVol * 0.35, 1.0);
          }

          // Subtle capillary wicking into porous vellum fibers along lip
          if (dRel > 0.85 && dRel < 1.4) {
            const stainAmount = (1.0 - Math.abs(dRel - 1.12) / 0.28) * 0.4 * pressure;
            this.data[idx + 2] = Math.min(this.data[idx + 2] + stainAmount, 0.85);
          }
        }
      }
    }
  }

  /**
   * Exactly 2 to 4 subtle, semi-translucent fibrous connective strands spanning narrow sections
   */
  private generateSubtleStrands(): void {
    const pts = this.strokeBuffer;
    if (pts.length < 4) return;

    // Exactly 2 to 4 strands
    const strandCount = Math.floor(2 + Math.random() * 2.5);

    for (let k = 0; k < strandCount; k++) {
      // Pick narrow sections near start or end
      const isStart = Math.random() > 0.5;
      const idx = isStart
        ? Math.floor(1 + Math.random() * Math.min(pts.length * 0.35, 8))
        : Math.floor(Math.max(pts.length * 0.65, pts.length - 8) + Math.random() * 4);

      const clampedIdx = Math.min(Math.max(idx, 1), pts.length - 2);
      const pt = pts[clampedIdx];
      const next = pts[clampedIdx + 1];

      const dx = next.x - pt.x;
      const dy = next.y - pt.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 0.001) continue;

      const normX = -dy / len;
      const normY = dx / len;

      const halfGap = 5.0 + Math.random() * 6.0;
      const pA = new Vec2(pt.x - normX * halfGap, pt.y - normY * halfGap);
      const pB = new Vec2(pt.x + normX * halfGap, pt.y + normY * halfGap);
      const mid = new Vec2(
        (pA.x + pB.x) * 0.5 + (Math.random() - 0.5) * 2.5,
        (pA.y + pB.y) * 0.5 + (Math.random() - 0.5) * 2.5
      );

      this.strands.push({
        pA,
        pB,
        mid,
        vel: new Vec2((Math.random() - 0.5) * 25.0, (Math.random() - 0.5) * 25.0),
        thickness: 0.8 + Math.random() * 0.4,
        alpha: 0.45 + Math.random() * 0.25, // Subtle semi-translucent
        quiverPhase: Math.random() * Math.PI * 2,
        quiverFreq: 24.0 + Math.random() * 12.0,
      });
    }

    this.rasterizeSubtleStrands();
  }

  private rasterizeSubtleStrands(): void {
    const sw = this.simWidth;
    const sh = this.simHeight;

    for (const strand of this.strands) {
      const steps = 28;
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const inv = 1.0 - u;
        const x = inv * inv * strand.pA.x + 2.0 * inv * u * strand.mid.x + u * u * strand.pB.x;
        const y = inv * inv * strand.pA.y + 2.0 * inv * u * strand.mid.y + u * u * strand.pB.y;

        const px = Math.floor(x);
        const py = Math.floor(y);
        if (px >= 0 && px < sw && py >= 0 && py < sh) {
          const idx = (py * sw + px) * 4;
          this.data[idx + 3] = Math.min(this.data[idx + 3] + strand.alpha * 0.65, 0.9);
        }
      }
    }
  }

  /**
   * Viscous fluid mechanics step
   */
  public updateFluidPhysics(dt: number): void {
    const subDt = Math.min(dt, 0.033);
    const sw = this.simWidth;
    const sh = this.simHeight;

    // Quiver strands
    for (const strand of this.strands) {
      strand.quiverPhase += strand.quiverFreq * subDt;
      const targetMidX = (strand.pA.x + strand.pB.x) * 0.5;
      const targetMidY = (strand.pA.y + strand.pB.y) * 0.5;

      const fx = -45.0 * (strand.mid.x - targetMidX) - 10.0 * strand.vel.x;
      const fy = -45.0 * (strand.mid.y - targetMidY) - 10.0 * strand.vel.y;

      strand.vel.x += fx * subDt;
      strand.vel.y += fy * subDt;
      strand.mid.x += strand.vel.x * subDt;
      strand.mid.y += strand.vel.y * subDt;
    }

    // Viscous fluid trickling & capillary percolation
    const gravityRate = 8.0 * subDt; // High drag / viscous crawl
    const wickRate = 0.5 * subDt;

    for (let y = sh - 2; y >= 1; y--) {
      const rowIdx = y * sw;
      for (let x = 1; x < sw - 1; x++) {
        const idx = (rowIdx + x) * 4;
        const blood = this.data[idx + 1];
        if (blood < 0.015) continue;

        const h = this.data[idx];

        // Crevice pooling: if in deep trench, it pools.
        // If overflowing the lip (h > -0.1), viscous flow crawls down (+Y)
        if (h > -0.15) {
          const belowIdx = ((y + 1) * sw + x) * 4;
          const flow = Math.min(blood * gravityRate * 0.5, 0.08);
          this.data[idx + 1] -= flow;
          this.data[belowIdx + 1] = Math.min(this.data[belowIdx + 1] + flow, 1.0);
        }

        // Capillary wicking
        if (Math.random() < 0.12) {
          const leftIdx = (rowIdx + (x - 1)) * 4;
          const rightIdx = (rowIdx + (x + 1)) * 4;
          this.data[leftIdx + 2] = Math.min(this.data[leftIdx + 2] + wickRate, 0.75);
          this.data[rightIdx + 2] = Math.min(this.data[rightIdx + 2] + wickRate, 0.75);
        }
      }
    }
  }

  /**
   * Stamp viscous teardrop fluid volume into heightfield
   */
  public addFluidPoint(screenX: number, screenY: number, radius: number, volume: number): void {
    const cx = Math.floor((screenX / this.width) * this.simWidth);
    const cy = Math.floor((screenY / this.height) * this.simHeight);
    const r = Math.max(Math.ceil((radius / this.width) * this.simWidth), 1);
    const sw = this.simWidth;
    const sh = this.simHeight;

    const minX = Math.max(0, cx - r);
    const maxX = Math.min(sw - 1, cx + r);
    const minY = Math.max(0, cy - r);
    const maxY = Math.min(sh - 1, cy + r);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dSq = dx * dx + dy * dy;
        if (dSq <= r * r) {
          const falloff = 1.0 - Math.sqrt(dSq) / r;
          const idx = (y * sw + x) * 4;
          this.data[idx + 1] = Math.min(this.data[idx + 1] + volume * falloff * 0.45, 1.0);
        }
      }
    }
  }

  /**
   * Stamp thin glossy streak into heightfield
   */
  public addStreakPoint(screenX: number, screenY: number, radius: number, intensity: number): void {
    const cx = Math.floor((screenX / this.width) * this.simWidth);
    const cy = Math.floor((screenY / this.height) * this.simHeight);
    const r = Math.max(Math.ceil((radius / this.width) * this.simWidth), 1);
    const sw = this.simWidth;
    const sh = this.simHeight;

    const minX = Math.max(0, cx - r);
    const maxX = Math.min(sw - 1, cx + r);
    const minY = Math.max(0, cy - r);
    const maxY = Math.min(sh - 1, cy + r);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const idx = (y * sw + x) * 4;
        this.data[idx + 2] = Math.min(this.data[idx + 2] + intensity * 0.35, 0.9);
      }
    }
  }

  /**
   * Upload simulation data to texture canvas
   */
  public updateTexture(): void {
    const pixels = this.textureImageData.data;
    const len = this.simWidth * this.simHeight;

    for (let i = 0; i < len; i++) {
      const srcIdx = i * 4;
      const dstIdx = i * 4;

      // Height: [-1.0, 1.0] -> [0, 255]
      const h = this.data[srcIdx];
      const hByte = Math.min(Math.max(Math.floor((h + 1.0) * 127.5), 0), 255);

      const fByte = Math.min(Math.max(Math.floor(this.data[srcIdx + 1] * 255.0), 0), 255);
      const sByte = Math.min(Math.max(Math.floor(this.data[srcIdx + 2] * 255.0), 0), 255);
      const aByte = Math.min(Math.max(Math.floor(this.data[srcIdx + 3] * 255.0), 0), 255);

      pixels[dstIdx] = hByte;
      pixels[dstIdx + 1] = fByte;
      pixels[dstIdx + 2] = sByte;
      pixels[dstIdx + 3] = aByte;
    }

    this.textureCtx.putImageData(this.textureImageData, 0, 0);
  }

  public clear(): void {
    this.strands = [];
    this.strokeBuffer = [];
    this.data.fill(0);
    this.updateTexture();
  }
}
