/**
 * Hyper-Realistic Fluid Dynamics Engine:
 * - Capillary watercolor wicking into cold-press vellum paper/skin pores
 * - Dynamic blood pooling inside the wound cavity
 * - Viscous gravity dripping rivulets with realistic bead-and-trail mechanics
 * - Volumetric Beer-Lambert absorption: thin blood = glowing arterial ruby, thick blood = dark clotted burgundy
 * - Temporal oxidation from bright scarlet (#C60024) to clotted maroon (#30040A)
 */

import { Vec2 } from './physics';
import type { WoundCut } from './wound';

export interface BloodDrip {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  length: number;
  mass: number;
  age: number;
  maxAge: number;
  isStuck: boolean;
  parentWoundId: string;
  coagulation: number;
  trail: { x: number; y: number; r: number; alpha: number }[];
}

export class FluidEngine {
  public width: number;
  public height: number;
  public drips: BloodDrip[] = [];

  // Dedicated offscreen canvas for permanent capillary stain absorption into paper
  public stainCanvas: HTMLCanvasElement;
  public stainCtx: CanvasRenderingContext2D;

  // Dedicated offscreen canvas for dynamic liquid blood surface, rivulets, and pooling
  public fluidCanvas: HTMLCanvasElement;
  public fluidCtx: CanvasRenderingContext2D;

  // Paper grain for cold-press wicking
  private paperGrain: Float32Array;
  private grainDim: number = 256;

  // Timing
  private lastDripTime: number = 0;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;

    this.stainCanvas = document.createElement('canvas');
    this.stainCanvas.width = width;
    this.stainCanvas.height = height;
    this.stainCtx = this.stainCanvas.getContext('2d', { willReadFrequently: false })!;

    this.fluidCanvas = document.createElement('canvas');
    this.fluidCanvas.width = width;
    this.fluidCanvas.height = height;
    this.fluidCtx = this.fluidCanvas.getContext('2d', { willReadFrequently: false })!;

    this.paperGrain = new Float32Array(this.grainDim * this.grainDim);
    this.generatePaperGrain();
  }

  public resize(width: number, height: number): void {
    if (this.width === width && this.height === height) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.width;
    tempCanvas.height = this.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.drawImage(this.stainCanvas, 0, 0);
    }

    this.width = width;
    this.height = height;
    this.stainCanvas.width = width;
    this.stainCanvas.height = height;
    this.fluidCanvas.width = width;
    this.fluidCanvas.height = height;

    if (tempCtx) {
      this.stainCtx.drawImage(tempCanvas, 0, 0, width, height);
    }
  }

  private generatePaperGrain(): void {
    for (let y = 0; y < this.grainDim; y++) {
      for (let x = 0; x < this.grainDim; x++) {
        const nx = x / this.grainDim;
        const ny = y / this.grainDim;
        const f1 = Math.sin(nx * 40.0 + Math.cos(ny * 32.0)) * 0.5 + 0.5;
        const f2 = Math.cos(nx * 85.0 - ny * 70.0) * 0.5 + 0.5;
        const f3 = (Math.random() - 0.5) * 0.25;
        this.paperGrain[y * this.grainDim + x] = f1 * 0.5 + f2 * 0.35 + f3 * 0.15;
      }
    }
  }

  private sampleGrain(x: number, y: number): number {
    const gx = Math.floor(Math.abs(x) % this.grainDim);
    const gy = Math.floor(Math.abs(y) % this.grainDim);
    return this.paperGrain[gy * this.grainDim + gx];
  }

  /**
   * Immediately spawn capillary bleed along newly cut blade points
   */
  public emitActiveCutBleed(x: number, y: number, normal: Vec2, pressure: number = 1.0): void {
    // Stain canvas: capillary wicking outward from the incision
    const grain = this.sampleGrain(x, y);
    const stainRadius = (4.0 + Math.random() * 8.0 * pressure) * (0.8 + grain * 0.5);

    this.stampCapillaryStain(
      x + (Math.random() - 0.5) * 3.0,
      y + (Math.random() - 0.5) * 3.0,
      stainRadius,
      0.75,
      0.0 // fresh arterial
    );

    // Occasionally spawn micro blood droplet on the cut edge
    if (Math.random() < 0.28) {
      const dripSide = normal.y > 0 ? 1 : -1;
      this.drips.push({
        pos: new Vec2(x + normal.x * dripSide * 3.0, y + normal.y * dripSide * 3.0),
        vel: new Vec2((Math.random() - 0.5) * 8.0, 18.0 + Math.random() * 35.0),
        radius: 2.2 + Math.random() * 2.8,
        length: 3.5,
        mass: 1.0 + Math.random() * 1.5,
        age: 0,
        maxAge: 14.0 + Math.random() * 16.0,
        isStuck: false,
        parentWoundId: 'active',
        coagulation: 0.0,
        trail: [],
      });
    }
  }

  /**
   * Continuous seepage from wound edges and bottom lip pooling
   */
  public emitWoundSeepage(wounds: WoundCut[], currentTime: number, onDripSound?: () => void): void {
    const canSpawnDrip = currentTime - this.lastDripTime > 90; // smooth drip rate limit

    for (const wound of wounds) {
      if (wound.nodes.length < 2) continue;
      const bleedRate = wound.bleedSourceRemaining;
      if (bleedRate < 0.02) continue;

      const coag = wound.coagulationProgress;

      // Check nodes along wound
      for (let i = 1; i < wound.nodes.length - 1; i += 2) {
        const node = wound.nodes[i];
        if (node.currentWidthL < 1.5) continue;

        // Higher bleeding probability for fresh wounds
        if (Math.random() < 0.18 * bleedRate) {
          // Bottom lip position
          const isBottomL = node.normal.y > 0;
          const lipPos = isBottomL ? node.getLeftPos() : node.getRightPos();

          // Stain capillary wicking into vellum
          const grain = this.sampleGrain(lipPos.x, lipPos.y);
          const stainR = (3.5 + Math.random() * 7.0 * bleedRate) * (0.8 + grain * 0.4);
          this.stampCapillaryStain(lipPos.x, lipPos.y, stainR, 0.45 * bleedRate, coag);

          // Gravity drip trigger: high probability if lower lip points downward
          const downwardSlope = Math.max(node.normal.y, 0.1);
          if (canSpawnDrip && Math.random() < 0.12 * bleedRate * downwardSlope && this.drips.length < 65) {
            this.drips.push({
              pos: lipPos.clone(),
              vel: new Vec2((Math.random() - 0.5) * 6.0, 20.0 + Math.random() * 40.0),
              radius: 2.2 + Math.random() * 3.5,
              length: 3.5,
              mass: 1.0 + Math.random() * 1.8,
              age: 0,
              maxAge: 16.0 + Math.random() * 14.0,
              isStuck: false,
              parentWoundId: wound.id,
              coagulation: coag,
              trail: [],
            });

            this.lastDripTime = currentTime;
            if (onDripSound && Math.random() < 0.45) {
              onDripSound();
            }
          }
        }
      }
    }
  }

  /**
   * Stamp permanent capillary watercolor absorption into paper/vellum canvas
   */
  private stampCapillaryStain(x: number, y: number, radius: number, intensity: number, coagulation: number): void {
    const ctx = this.stainCtx;

    // Arterial scarlet (#C60024) to clotted burgundy (#30040A)
    const r = Math.floor(198 - coagulation * 150);
    const g = Math.floor(0 + coagulation * 4);
    const b = Math.floor(36 - coagulation * 26);

    const rad = Math.max(radius, 1.5);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.55 * intensity})`);
    grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${0.32 * intensity})`);
    grad.addColorStop(0.85, `rgba(${r}, ${g}, ${b}, ${0.12 * intensity})`);
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

    ctx.save();
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Update drips, trails, gravity acceleration, and wound pooling
   */
  public update(dt: number, wounds: WoundCut[]): void {
    const subDt = Math.min(dt, 0.033);
    const gravity = 95.0; // downward acceleration

    for (let i = this.drips.length - 1; i >= 0; i--) {
      const drip = this.drips[i];
      drip.age += subDt;

      // Advance coagulation over time
      drip.coagulation = Math.min(drip.coagulation + subDt * 0.02, 1.0);

      if (drip.isStuck || drip.age > drip.maxAge) {
        if (drip.age > drip.maxAge + 6.0) {
          this.drips.splice(i, 1);
        }
        continue;
      }

      // Viscosity increases as blood coagulates
      const viscosity = Math.max(0.85 - drip.coagulation * 0.6, 0.2);

      // Downward gravity acceleration
      drip.vel.y += gravity * subDt * drip.mass;
      // Slight organic wandering along skin tension lines
      drip.vel.x += (Math.sin(drip.pos.y * 0.035) * 5.0 - drip.vel.x * 1.8) * subDt;

      drip.pos.x += drip.vel.x * subDt * viscosity;
      drip.pos.y += drip.vel.y * subDt * viscosity;

      // Elongate droplet head as it speeds up
      drip.length = Math.min(drip.radius + drip.vel.y * 0.14, drip.radius * 4.5);

      // Add trail point
      drip.trail.push({
        x: drip.pos.x,
        y: drip.pos.y,
        r: drip.radius * 0.7,
        alpha: Math.max(0.4, 1.0 - drip.age / drip.maxAge),
      });

      // Once trail gets long, stamp old points into permanent stain canvas
      if (drip.trail.length > 40) {
        const oldPt = drip.trail.shift()!;
        this.stampCapillaryStain(oldPt.x, oldPt.y, oldPt.r * 1.4, 0.45, drip.coagulation);
      }

      // Check collision / pooling with lower lip of OTHER wounds
      for (const wound of wounds) {
        if (wound.id === drip.parentWoundId && drip.age < 0.6) continue;

        for (const node of wound.nodes) {
          const dist = drip.pos.distanceTo(node.spinePos);
          if (dist < node.currentWidthL + drip.radius) {
            // Hit lower shelf: pool inside this cut
            drip.vel.y *= 0.12;
            drip.vel.x += node.tangent.x * 25.0; // slide along wound lip
            drip.radius = Math.min(drip.radius + 0.4, 7.5);

            this.stampCapillaryStain(drip.pos.x, drip.pos.y, drip.radius * 1.5, 0.6, drip.coagulation);

            if (Math.random() < 0.15) {
              drip.isStuck = true;
            }
            break;
          }
        }
      }

      // Offscreen cleanup
      if (drip.pos.y > this.height + 50) {
        this.drips.splice(i, 1);
      }
    }
  }

  /**
   * Render hyper-realistic glossy liquid blood layer (pools, rivulets, specular teardrops)
   */
  public renderGlossyFluids(lightX: number, lightY: number, wounds: WoundCut[]): void {
    const ctx = this.fluidCtx;
    ctx.clearRect(0, 0, this.width, this.height);

    // -------------------------------------------------------------
    // 1. Blood Pooling inside the Wound Cavities
    // -------------------------------------------------------------
    ctx.save();
    for (const wound of wounds) {
      if (wound.nodes.length < 2) continue;
      const coag = wound.coagulationProgress;

      // Arterial ruby (#C60024) to clotted burgundy (#30040A)
      const r = Math.floor(198 - coag * 150);
      const g = Math.floor(0 + coag * 4);
      const b = Math.floor(36 - coag * 26);

      // Draw pooled liquid blood bed along the bottom of the gaping cut
      ctx.beginPath();
      const p0 = wound.nodes[0].spinePos;
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < wound.nodes.length; i++) {
        const p = wound.nodes[i].spinePos;
        ctx.lineTo(p.x, p.y);
      }

      // Width of blood pool inside the cut
      const avgHalf = wound.nodes.reduce((acc, n) => acc + (n.currentWidthL + n.currentWidthR) * 0.5, 0) / wound.nodes.length;
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.95)`;
      ctx.lineWidth = Math.max(avgHalf * 0.65, 3.5);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Meniscus highlight along top edge of blood pool
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y - 1.0);
      for (let i = 1; i < wound.nodes.length; i++) {
        const p = wound.nodes[i].spinePos;
        ctx.lineTo(p.x, p.y - 1.0);
      }
      ctx.strokeStyle = `rgba(255, 180, 190, 0.4)`;
      ctx.lineWidth = Math.max(avgHalf * 0.18, 1.2);
      ctx.stroke();
    }
    ctx.restore();

    // -------------------------------------------------------------
    // 2. Viscous Dripping Rivulets & Teardrops
    // -------------------------------------------------------------
    for (const drip of this.drips) {
      const coag = drip.coagulation;

      // Arterial scarlet (#C60024) to venous clotted burgundy (#30040A)
      const red = Math.floor(198 - coag * 150);
      const green = Math.floor(0 + coag * 4);
      const blue = Math.floor(36 - coag * 26);

      // A. Draw continuous wet rivulet trail
      if (drip.trail.length > 1) {
        ctx.save();
        // Dark outer meniscus
        ctx.beginPath();
        ctx.moveTo(drip.trail[0].x, drip.trail[0].y);
        for (let t = 1; t < drip.trail.length; t++) {
          ctx.lineTo(drip.trail[t].x, drip.trail[t].y);
        }
        ctx.strokeStyle = `rgba(${Math.max(red - 40, 15)}, ${green}, ${Math.max(blue - 15, 5)}, 0.88)`;
        ctx.lineWidth = drip.radius * 1.1;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Glowing translucent arterial core
        ctx.beginPath();
        ctx.moveTo(drip.trail[0].x, drip.trail[0].y);
        for (let t = 1; t < drip.trail.length; t++) {
          ctx.lineTo(drip.trail[t].x, drip.trail[t].y);
        }
        ctx.strokeStyle = `rgba(${red}, ${green}, ${blue}, 0.95)`;
        ctx.lineWidth = drip.radius * 0.65;
        ctx.stroke();

        // Raised glossy central specular streak
        ctx.beginPath();
        ctx.moveTo(drip.trail[0].x - 0.5, drip.trail[0].y);
        for (let t = 1; t < drip.trail.length; t++) {
          ctx.lineTo(drip.trail[t].x - 0.5, drip.trail[t].y);
        }
        ctx.strokeStyle = 'rgba(255, 235, 240, 0.45)';
        ctx.lineWidth = Math.max(drip.radius * 0.22, 0.8);
        ctx.stroke();
        ctx.restore();
      }

      // B. Draw heavy viscous teardrop head
      ctx.save();
      ctx.translate(drip.pos.x, drip.pos.y);

      const angle = Math.atan2(drip.vel.y, drip.vel.x);
      ctx.rotate(angle - Math.PI / 2);

      // 3D Volumetric bulb gradient
      const grad = ctx.createRadialGradient(
        -drip.radius * 0.2,
        -drip.length * 0.2,
        drip.radius * 0.1,
        0,
        0,
        drip.radius * 1.4
      );
      // Arterial core -> deep shadow base
      grad.addColorStop(0, `rgb(${Math.min(red + 35, 255)}, ${green + 15}, ${blue + 10})`);
      grad.addColorStop(0.5, `rgb(${red}, ${green}, ${blue})`);
      grad.addColorStop(0.85, `rgb(${Math.max(red - 55, 15)}, 0, 8)`);
      grad.addColorStop(1, 'rgb(12, 1, 3)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      // Curved biological teardrop
      ctx.moveTo(0, drip.length * 0.85);
      ctx.bezierCurveTo(
        drip.radius * 1.35,
        drip.length * 0.45,
        drip.radius * 1.25,
        -drip.radius * 0.8,
        0,
        -drip.radius * 1.25
      );
      ctx.bezierCurveTo(
        -drip.radius * 1.25,
        -drip.radius * 0.8,
        -drip.radius * 1.35,
        drip.length * 0.45,
        0,
        drip.length * 0.85
      );
      ctx.fill();

      // C. Razor-sharp 3D specular highlight tracking spotlight
      const lx = lightX - drip.pos.x;
      const ly = lightY - drip.pos.y;
      const lDist = Math.max(Math.sqrt(lx * lx + ly * ly), 1.0);
      const specX = (lx / lDist) * (drip.radius * 0.35);
      const specY = (ly / lDist) * (drip.radius * 0.35);

      const specGrad = ctx.createRadialGradient(
        specX,
        specY,
        0,
        specX,
        specY,
        drip.radius * 0.65
      );
      specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
      specGrad.addColorStop(0.3, 'rgba(255, 220, 230, 0.65)');
      specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = specGrad;
      ctx.beginPath();
      ctx.arc(specX, specY, drip.radius * 0.65, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  /**
   * Clear all fluid and stain data
   */
  public clear(): void {
    this.drips = [];
    this.stainCtx.clearRect(0, 0, this.width, this.height);
    this.fluidCtx.clearRect(0, 0, this.width, this.height);
  }
}
