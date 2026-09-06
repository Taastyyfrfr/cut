/**
 * Viscous Fluid Mechanics Engine (Unified with Wound Geometry)
 * 
 * 1. Zero detached circular particles or spray.
 * 2. Emission strictly along the lower lip of horizontal cuts and the deep trench bed.
 * 3. Smooth, viscous teardrop drips that crawl downward with high drag/viscosity.
 * 4. Thin glossy streak left behind each teardrop, anchored to the cut lip.
 * 5. Strict Palette: Deep arterial crimson (#8B0C1A) to clotted burgundy (#58050E). Never #FF0000.
 */

import { Vec2 } from './physics';
import type { WoundCut } from './wound';

export interface ViscousDrip {
  pos: Vec2;
  originPos: Vec2;
  vel: Vec2;
  radius: number;
  length: number;
  mass: number;
  age: number;
  maxAge: number;
  coagulation: number;
  streakPoints: { x: number; y: number }[];
}

export class FluidEngine {
  public width: number;
  public height: number;
  public drips: ViscousDrip[] = [];

  // Dedicated offscreen canvas for liquid blood surface, rivulets, and glossy streaks
  public fluidCanvas: HTMLCanvasElement;
  public fluidCtx: CanvasRenderingContext2D;

  private lastDripTime: number = 0;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;

    this.fluidCanvas = document.createElement('canvas');
    this.fluidCanvas.width = width;
    this.fluidCanvas.height = height;
    this.fluidCtx = this.fluidCanvas.getContext('2d', { willReadFrequently: false })!;
  }

  public resize(width: number, height: number): void {
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;
    this.fluidCanvas.width = width;
    this.fluidCanvas.height = height;
  }

  /**
   * Spawn viscous drips strictly along the lower lip of cuts and deep trench beds
   */
  public emitWoundSeepage(wounds: WoundCut[], currentTime: number, onDripSound?: () => void): void {
    if (currentTime - this.lastDripTime < 180) return; // Strict slow seepage cadence

    for (const wound of wounds) {
      if (wound.nodes.length < 3) continue;
      const bleedRate = wound.bleedSourceRemaining;
      if (bleedRate < 0.05) continue;

      // Find lowest downward-facing lip nodes
      for (let i = 1; i < wound.nodes.length - 1; i++) {
        const node = wound.nodes[i];
        // Must have downward normal (lower lip of cut)
        if (node.normal.y <= 0.35) continue;
        if (node.currentWidthL < 3.0) continue;

        // Strict controlled probability
        if (Math.random() < 0.08 * bleedRate && this.drips.length < 24) {
          const lipPos = node.getLeftPos(); // downward-facing lower lip

          this.drips.push({
            pos: lipPos.clone(),
            originPos: lipPos.clone(),
            vel: new Vec2(node.tangent.x * 3.0, 10.0 + Math.random() * 15.0), // high initial drag
            radius: 2.4 + Math.random() * 1.8,
            length: 4.0,
            mass: 0.8 + Math.random() * 0.6,
            age: 0,
            maxAge: 22.0,
            coagulation: wound.coagulationProgress,
            streakPoints: [{ x: lipPos.x, y: lipPos.y }],
          });

          this.lastDripTime = currentTime;
          if (onDripSound && Math.random() < 0.35) {
            onDripSound();
          }
          break; // One drip per wound per check
        }
      }
    }
  }

  /**
   * Step viscous drip movement: high drag, slow crawl, continuous glossy streak
   */
  public update(dt: number): void {
    const subDt = Math.min(dt, 0.033);
    const gravity = 45.0; // Low gravity acceleration for high viscosity
    const drag = 0.88;    // Heavy drag

    for (let i = this.drips.length - 1; i >= 0; i--) {
      const drip = this.drips[i];
      drip.age += subDt;

      if (drip.age > drip.maxAge) {
        this.drips.splice(i, 1);
        continue;
      }

      // Advance coagulation: blood darkens and thickens over time
      drip.coagulation = Math.min(drip.coagulation + subDt * 0.015, 1.0);
      const viscosityFactor = Math.max(1.0 - drip.coagulation * 0.45, 0.35);

      // Downward viscous acceleration
      drip.vel.y += gravity * subDt * drip.mass;
      drip.vel.x *= drag;
      drip.vel.y *= (drag * viscosityFactor);

      drip.pos.x += drip.vel.x * subDt;
      drip.pos.y += drip.vel.y * subDt;

      // Elongate teardrop head based on crawl speed
      drip.length = Math.min(drip.radius + drip.vel.y * 0.08, drip.radius * 3.5);

      // Record streak path anchored to cut lip
      const lastPt = drip.streakPoints[drip.streakPoints.length - 1];
      const dist = drip.pos.distanceTo(new Vec2(lastPt.x, lastPt.y));
      if (dist >= 3.0) {
        drip.streakPoints.push({ x: drip.pos.x, y: drip.pos.y });
        if (drip.streakPoints.length > 80) {
          drip.streakPoints.shift();
        }
      }

      // Bottom screen check
      if (drip.pos.y > this.height + 40) {
        this.drips.splice(i, 1);
      }
    }
  }

  /**
   * Render viscous teardrop drips & thin glossy streaks
   * Strict palette: deep arterial (#8B0C1A) to clotted burgundy (#58050E)
   */
  public render(lightX: number, lightY: number): void {
    const ctx = this.fluidCtx;
    ctx.clearRect(0, 0, this.width, this.height);

    for (const drip of this.drips) {
      const coag = drip.coagulation;

      // Arterial (#8B0C1A = rgb(139, 12, 26)) -> Clotted (#58050E = rgb(88, 5, 14))
      const r = Math.floor(139 - coag * 51);
      const g = Math.floor(12 - coag * 7);
      const b = Math.floor(26 - coag * 12);

      // 1. Thin glossy streak behind the teardrop
      if (drip.streakPoints.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(drip.streakPoints[0].x, drip.streakPoints[0].y);
        for (let s = 1; s < drip.streakPoints.length; s++) {
          ctx.lineTo(drip.streakPoints[s].x, drip.streakPoints[s].y);
        }

        // Thin viscous trail (1.5px to 2.5px)
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.82)`;
        ctx.lineWidth = Math.max(drip.radius * 0.65, 1.4);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Delicate raised specular sheen streak
        ctx.beginPath();
        ctx.moveTo(drip.streakPoints[0].x, drip.streakPoints[0].y);
        for (let s = 1; s < drip.streakPoints.length; s++) {
          ctx.lineTo(drip.streakPoints[s].x, drip.streakPoints[s].y);
        }
        ctx.strokeStyle = 'rgba(255, 235, 240, 0.4)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();
      }

      // 2. Smooth viscous teardrop head
      ctx.save();
      ctx.translate(drip.pos.x, drip.pos.y);

      const angle = Math.atan2(drip.vel.y, drip.vel.x);
      ctx.rotate(angle - Math.PI / 2);

      // Radial gradient for 3D bulbous volume
      const grad = ctx.createRadialGradient(
        0,
        -drip.length * 0.2,
        0,
        0,
        0,
        drip.radius * 1.3
      );
      grad.addColorStop(0, `rgb(${Math.min(r + 20, 160)}, ${g + 5}, ${b + 10})`);
      grad.addColorStop(0.65, `rgb(${r}, ${g}, ${b})`);
      grad.addColorStop(1, `rgb(${Math.max(r - 40, 45)}, 2, 8)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      // Teardrop contour
      ctx.moveTo(0, drip.length * 0.8);
      ctx.bezierCurveTo(
        drip.radius * 1.25,
        drip.length * 0.35,
        drip.radius * 1.15,
        -drip.radius * 0.8,
        0,
        -drip.radius * 1.1
      );
      ctx.bezierCurveTo(
        -drip.radius * 1.15,
        -drip.radius * 0.8,
        -drip.radius * 1.25,
        drip.length * 0.35,
        0,
        drip.length * 0.8
      );
      ctx.fill();

      // 3. Sharp specular highlight reflecting directional light
      const lx = lightX - drip.pos.x;
      const ly = lightY - drip.pos.y;
      const lDist = Math.max(Math.sqrt(lx * lx + ly * ly), 1.0);
      const specX = (lx / lDist) * (drip.radius * 0.3);
      const specY = (ly / lDist) * (drip.radius * 0.3);

      const specGrad = ctx.createRadialGradient(
        specX,
        specY,
        0,
        specX,
        specY,
        drip.radius * 0.55
      );
      specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      specGrad.addColorStop(0.4, 'rgba(255, 215, 225, 0.6)');
      specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = specGrad;
      ctx.beginPath();
      ctx.arc(specX, specY, drip.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  public clear(): void {
    this.drips = [];
    this.fluidCtx.clearRect(0, 0, this.width, this.height);
  }
}
