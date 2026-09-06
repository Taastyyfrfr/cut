/**
 * Dynamic Heightfield & Viscous Fluid Simulation Grid
 * 
 * Manages a high-resolution simulation grid:
 * Channel 0 (R): Surface Height & Trench Depth (baseline 0, curled lip +0.25, cut trench -1.0)
 * Channel 1 (G): Fluid Volume & Pooled Blood Depth
 * Channel 2 (B): Capillary Wicking / Porous Fiber Staining
 * Channel 3 (A): Connective Tissue / Collagen Strands Density
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
  // R: Height (trench < 0, lip > 0)
  // G: Liquid blood volume
  // B: Capillary stain
  // A: Connective strand mask
  public data: Float32Array;

  // Offscreen canvas and texture data for WebGL upload
  public textureCanvas: HTMLCanvasElement;
  public textureCtx: CanvasRenderingContext2D;
  public textureImageData: ImageData;

  // Active connective tissue strands
  public strands: ConnectiveStrand[] = [];

  // Procedural baseline micro-pores & skin creases
  private noiseGrid: Float32Array;

  // Active incision smoothing buffer
  private strokeBuffer: SlicePoint[] = [];
  private totalStrokeLength: number = 0;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;

    // Simulation resolution (balanced for 60fps high-fidelity simulation)
    // 1024 or 768 aspect ratio matching window
    const maxDim = 1024;
    const aspect = width / height;
    if (aspect >= 1) {
      this.simWidth = maxDim;
      this.simHeight = Math.floor(maxDim / aspect);
    } else {
      this.simWidth = Math.floor(maxDim * aspect);
      this.simHeight = maxDim;
    }

    const pixelCount = this.simWidth * this.simHeight;
    this.data = new Float32Array(pixelCount * 4);
    this.noiseGrid = new Float32Array(pixelCount);

    this.textureCanvas = document.createElement('canvas');
    this.textureCanvas.width = this.simWidth;
    this.textureCanvas.height = this.simHeight;
    this.textureCtx = this.textureCanvas.getContext('2d', { willReadFrequently: false })!;
    this.textureImageData = this.textureCtx.createImageData(this.simWidth, this.simHeight);

    this.initSurfaceNoise();
  }

  /**
   * Procedural micro-perturbed height baseline (perlin/simplex dermatoglyphics & skin pores)
   */
  private initSurfaceNoise(): void {
    const sw = this.simWidth;
    const sh = this.simHeight;

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const nx = x / sw;
        const ny = y / sh;

        // Fine dermatoglyphic skin creases & pores
        const f1 = Math.sin(nx * 120.0 + Math.cos(ny * 90.0) * 2.0) * 0.5 + 0.5;
        const f2 = Math.cos(nx * 280.0 - ny * 240.0) * 0.5 + 0.5;
        const pore = Math.sin(nx * 600.0) * Math.cos(ny * 600.0);

        const val = (f1 * 0.5 + f2 * 0.35 + pore * 0.15) * 0.04;
        this.noiseGrid[y * sw + x] = val;

        const idx = (y * sw + x) * 4;
        this.data[idx] = val; // Baseline skin height
        this.data[idx + 1] = 0; // Blood
        this.data[idx + 2] = 0; // Stain
        this.data[idx + 3] = 0; // Strands
      }
    }
  }

  public resize(width: number, height: number): void {
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;
    // Recreate grid
    const maxDim = 1024;
    const aspect = width / height;
    if (aspect >= 1) {
      this.simWidth = maxDim;
      this.simHeight = Math.floor(maxDim / aspect);
    } else {
      this.simWidth = Math.floor(maxDim * aspect);
      this.simHeight = maxDim;
    }

    const pixelCount = this.simWidth * this.simHeight;
    this.data = new Float32Array(pixelCount * 4);
    this.noiseGrid = new Float32Array(pixelCount);

    this.textureCanvas.width = this.simWidth;
    this.textureCanvas.height = this.simHeight;
    this.textureImageData = this.textureCtx.createImageData(this.simWidth, this.simHeight);

    this.initSurfaceNoise();
  }

  public beginSlice(screenX: number, screenY: number, pressure: number = 1.0): void {
    const sx = (screenX / this.width) * this.simWidth;
    const sy = (screenY / this.height) * this.simHeight;
    this.strokeBuffer = [{ x: sx, y: sy, t: performance.now(), pressure }];
    this.totalStrokeLength = 0;
  }

  /**
   * Carve incision trench into heightmap using continuous non-uniform spline
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

    if (dist < 2.0) return null;

    const dt = Math.max((now - last.t) / 1000, 0.001);
    const velocity = dist / dt;

    this.strokeBuffer.push({ x: sx, y: sy, t: now, pressure });
    this.totalStrokeLength += dist;

    // Segment normal
    const tanX = dx / dist;
    const tanY = dy / dist;
    const normX = -tanY;
    const normY = tanX;

    // Modulate width: dynamic velocity-based incision envelope
    // Peak drag velocity creates widest wound, needle-thin start and ends
    const speedFactor = Math.min(Math.max((velocity - 80) / 700, 0.3), 1.8);
    const halfWidth = Math.min(Math.max((4.0 + speedFactor * 10.0) * pressure, 2.5), 24.0);
    const trenchDepth = Math.min(0.75 + speedFactor * 0.25, 1.0);

    // Carve trench along segment from last to current point
    this.carveSegmentTrench(last.x, last.y, sx, sy, normX, normY, halfWidth, trenchDepth, pressure);

    return {
      velocity,
      normal: new Vec2(normX, normY),
    };
  }

  /**
   * Finalize slice on pointer up: needle-thin parabolic taper at the endpoints
   */
  public endSlice(): void {
    if (this.strokeBuffer.length >= 2) {
      // Generate fibrous connective tissue strands bridging the gap
      this.generateConnectiveStrands();
    }
    this.strokeBuffer = [];
    this.totalStrokeLength = 0;
  }

  /**
   * Carve trench with steep walls, curled lips, and contact ambient occlusion
   */
  private carveSegmentTrench(
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
    const steps = Math.max(Math.ceil(segLen / 1.5), 1);

    const influenceRadius = halfWidth * 1.85;

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

          // Distance along normal vector
          const distNorm = Math.abs(rx * normX + ry * normY);
          // Distance along tangent vector
          const distTang = Math.abs(rx * (-normY) + ry * normX);

          if (distTang > 2.5) continue;
          if (distNorm > influenceRadius) continue;

          const idx = (py * sw + px) * 4;
          const baseH = this.noiseGrid[py * sw + px];

          // -------------------------------------------------------------
          // Organic Profile Function:
          // Center: deep trench (height drops down to -depth)
          // Edge (distNorm ~ halfWidth): curled lip rises to +0.22
          // Beyond lip: decays back to baseline
          // -------------------------------------------------------------
          const dRel = distNorm / halfWidth;
          let targetH = baseH;

          if (dRel < 1.0) {
            // Inside trench: parabolic/cubic steep drop
            const trenchShape = Math.pow(1.0 - dRel * dRel, 0.85);
            targetH = -depth * trenchShape;
          } else if (dRel < 1.6) {
            // Curled epidermal lip: displaced tissue curls upward
            const lipRel = (dRel - 1.0) / 0.6;
            const lipHeight = Math.sin(lipRel * Math.PI) * 0.22 * depth;
            targetH = baseH + lipHeight;
          }

          // Apply minimum height (carve deeper)
          this.data[idx] = Math.min(this.data[idx], targetH);

          // Inject liquid blood inside the trench
          if (dRel < 0.85) {
            const bloodVol = (1.0 - (dRel / 0.85)) * 0.85 * pressure;
            this.data[idx + 1] = Math.min(this.data[idx + 1] + bloodVol * 0.45, 1.0);
          }

          // Capillary wicking into cold-press vellum fibers along lip
          if (dRel > 0.8 && dRel < 1.7) {
            const stainAmount = (1.0 - Math.abs(dRel - 1.25) / 0.45) * 0.55 * pressure;
            this.data[idx + 2] = Math.min(this.data[idx + 2] + stainAmount, 1.0);
          }
        }
      }
    }
  }

  /**
   * Procedural fibrous, stringy connective tissue spanning across the gaping trench
   */
  private generateConnectiveStrands(): void {
    const pts = this.strokeBuffer;
    if (pts.length < 3) return;

    const count = Math.min(Math.max(Math.floor(pts.length * 0.35), 4), 32);

    for (let i = 0; i < count; i++) {
      const idx = Math.floor(1 + Math.random() * (pts.length - 2));
      const pt = pts[idx];
      const next = pts[idx + 1];

      const dx = next.x - pt.x;
      const dy = next.y - pt.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 0.001) continue;

      const normX = -dy / len;
      const normY = dx / len;

      const gap = 8.0 + Math.random() * 14.0;
      const pA = new Vec2(pt.x - normX * gap, pt.y - normY * gap);
      const pB = new Vec2(pt.x + normX * gap, pt.y + normY * gap);
      const mid = new Vec2(
        (pA.x + pB.x) * 0.5 + (Math.random() - 0.5) * 4.0,
        (pA.y + pB.y) * 0.5 + (Math.random() - 0.5) * 4.0
      );

      this.strands.push({
        pA,
        pB,
        mid,
        vel: new Vec2((Math.random() - 0.5) * 40.0, (Math.random() - 0.5) * 40.0),
        thickness: 0.7 + Math.random() * 1.4,
        alpha: 0.85 + Math.random() * 0.15,
        quiverPhase: Math.random() * Math.PI * 2,
        quiverFreq: 22.0 + Math.random() * 16.0,
      });
    }

    // Rasterize strands into channel A of heightfield
    this.rasterizeStrands();
  }

  private rasterizeStrands(): void {
    const sw = this.simWidth;
    const sh = this.simHeight;

    for (const strand of this.strands) {
      // Sample quadratic Bezier curve
      const steps = 24;
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const inv = 1.0 - u;
        const x = inv * inv * strand.pA.x + 2.0 * inv * u * strand.mid.x + u * u * strand.pB.x;
        const y = inv * inv * strand.pA.y + 2.0 * inv * u * strand.mid.y + u * u * strand.pB.y;

        const px = Math.floor(x);
        const py = Math.floor(y);
        if (px >= 0 && px < sw && py >= 0 && py < sh) {
          const idx = (py * sw + px) * 4;
          this.data[idx + 3] = Math.min(this.data[idx + 3] + strand.alpha * 0.8, 1.0);
        }
      }
    }
  }

  /**
   * Viscous fluid mechanics step:
   * - Pools inside cut crevice
   * - Retains surface tension (Laplacian diffusion)
   * - Flows downward under gravity when overflowing
   * - Capillary wicking into canvas fibers with irregular feathered edges
   */
  public updateFluidPhysics(dt: number): void {
    const subDt = Math.min(dt, 0.033);
    const sw = this.simWidth;
    const sh = this.simHeight;

    // Update quivering strands
    for (const strand of this.strands) {
      strand.quiverPhase += strand.quiverFreq * subDt;
      const targetMidX = (strand.pA.x + strand.pB.x) * 0.5;
      const targetMidY = (strand.pA.y + strand.pB.y) * 0.5;

      const fx = -50.0 * (strand.mid.x - targetMidX) - 10.0 * strand.vel.x;
      const fy = -50.0 * (strand.mid.y - targetMidY) - 10.0 * strand.vel.y;

      strand.vel.x += fx * subDt;
      strand.vel.y += fy * subDt;
      strand.mid.x += strand.vel.x * subDt;
      strand.mid.y += strand.vel.y * subDt;
    }

    // Viscous fluid advection & capillary wicking (staggered sampling for performance)
    const gravityRate = 12.0 * subDt;
    const wickRate = 0.8 * subDt;

    for (let y = sh - 2; y >= 1; y--) {
      const rowIdx = y * sw;
      for (let x = 1; x < sw - 1; x++) {
        const idx = (rowIdx + x) * 4;
        const blood = this.data[idx + 1];
        if (blood < 0.01) continue;

        const h = this.data[idx];

        // If fluid is in a deep crevice (h < -0.15), it stays pooled due to surface tension!
        // If fluid exceeds crevice or is on a downward slope, gravity trickles it down (+Y)
        if (h > -0.25) {
          const belowIdx = ((y + 1) * sw + x) * 4;
          const flow = Math.min(blood * gravityRate * 0.65, 0.15);
          this.data[idx + 1] -= flow;
          this.data[belowIdx + 1] = Math.min(this.data[belowIdx + 1] + flow, 1.0);

          // Trail stain
          this.data[idx + 2] = Math.min(this.data[idx + 2] + flow * 0.4, 0.95);
        }

        // Capillary lateral wicking into surrounding porous canvas fibers
        if (Math.random() < 0.15) {
          const leftIdx = (rowIdx + (x - 1)) * 4;
          const rightIdx = (rowIdx + (x + 1)) * 4;
          this.data[leftIdx + 2] = Math.min(this.data[leftIdx + 2] + wickRate, 0.85);
          this.data[rightIdx + 2] = Math.min(this.data[rightIdx + 2] + wickRate, 0.85);
        }
      }
    }
  }

  /**
   * Pack simulation data into RGBA texture for WebGL sampling
   * R: Height mapped to [0, 255] (trench -1.0 -> 0, baseline 0 -> 128, curled lip +0.25 -> 175)
   * G: Fluid volume [0, 255]
   * B: Capillary stain [0, 255]
   * A: Connective tissue strands [0, 255]
   */
  public updateTexture(): void {
    const pixels = this.textureImageData.data;
    const len = this.simWidth * this.simHeight;

    for (let i = 0; i < len; i++) {
      const srcIdx = i * 4;
      const dstIdx = i * 4;

      // Height: map from [-1.0, 1.0] to [0, 255]
      // -1.0 -> 0, 0.0 -> 128, +1.0 -> 255
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
    this.totalStrokeLength = 0;
    this.initSurfaceNoise();
    this.updateTexture();
  }
}
