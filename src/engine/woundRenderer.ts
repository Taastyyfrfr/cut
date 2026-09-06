/**
 * Wound Texture Renderer (Synchronized with Heightfield & Visceral Palette)
 * 
 * 1. Organic almond/lenticular profiles with needle-thin start and end points.
 * 2. Strictly deep arterial crimson (#8B0C1A) to clotted burgundy (#58050E).
 * 3. Subtle, semi-translucent fibrous connective strands (2-4 fine bezier threads).
 * 4. Soft subcutaneous lipid lobules with ambient occlusion drop shadows.
 */

import type { WoundCut } from './wound';

export class WoundTextureRenderer {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public width: number;
  public height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false })!;
  }

  public resize(width: number, height: number): void {
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /**
   * Render organic almond/lens profiles synchronized with the heightfield trench
   */
  public render(wounds: WoundCut[]): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    if (wounds.length === 0) return;

    // -------------------------------------------------------------
    // 1. Organic Almond/Lens Profile (Deep Dermis & Crevice)
    // -------------------------------------------------------------
    ctx.save();
    for (const wound of wounds) {
      const nodes = wound.nodes;
      if (nodes.length < 3) continue;

      // Almond contour path: left nodes forward, right nodes backward
      ctx.beginPath();
      const pL0 = nodes[0].getLeftPos();
      ctx.moveTo(pL0.x, pL0.y);

      for (let i = 1; i < nodes.length; i++) {
        const p = nodes[i].getLeftPos();
        ctx.lineTo(p.x, p.y);
      }
      for (let i = nodes.length - 1; i >= 0; i--) {
        const p = nodes[i].getRightPos();
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();

      // Deep arterial base: #8B0C1A transitioning to clotted #58050E
      ctx.fillStyle = '#6E0812';
      ctx.fill();

      // Curled lip inner shadow (depth bevel along cut perimeter)
      ctx.strokeStyle = '#380308';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Deep central abyss slit along central spine
      ctx.beginPath();
      ctx.moveTo(nodes[0].spinePos.x, nodes[0].spinePos.y);
      for (let i = 1; i < nodes.length; i++) {
        ctx.lineTo(nodes[i].spinePos.x, nodes[i].spinePos.y);
      }
      ctx.strokeStyle = '#220508'; // Clotted near-black burgundy
      const avgGap = nodes.reduce((acc, n) => acc + (n.currentWidthL + n.currentWidthR) * 0.5, 0) / nodes.length;
      ctx.lineWidth = Math.max(avgGap * 0.4, 2.0);
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();

    // -------------------------------------------------------------
    // 2. Subcutaneous Layer: 3D Soft Lipid Lobules
    // -------------------------------------------------------------
    ctx.save();
    for (const wound of wounds) {
      for (const lipid of wound.lipids) {
        const r = lipid.radius;
        if (r <= 0.5) continue;

        // Subtle shadow beneath lipid globule
        ctx.fillStyle = 'rgba(25, 3, 6, 0.45)';
        ctx.beginPath();
        ctx.arc(lipid.center.x + 0.8, lipid.center.y + 1.2, r, 0, Math.PI * 2);
        ctx.fill();

        // 3D Spherical lipid gradient (tallow ivory #E2CFAB)
        const grad = ctx.createRadialGradient(
          lipid.center.x - r * 0.35,
          lipid.center.y - r * 0.35,
          r * 0.1,
          lipid.center.x,
          lipid.center.y,
          r
        );
        grad.addColorStop(0, '#FFF6E0');
        grad.addColorStop(0.4, '#E5D0A8');
        grad.addColorStop(0.85, '#BFA36E');
        grad.addColorStop(1, '#664E2A');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(lipid.center.x, lipid.center.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Sharp moist specular glint
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.beginPath();
        ctx.arc(lipid.center.x - r * 0.3, lipid.center.y - r * 0.3, Math.max(r * 0.22, 0.7), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // -------------------------------------------------------------
    // 3. Subtle Connective Strands (2-4 fine semi-translucent bezier threads)
    // -------------------------------------------------------------
    ctx.save();
    for (const wound of wounds) {
      for (const fiber of wound.fibers) {
        if (fiber.isSnapped) continue;

        ctx.beginPath();
        ctx.moveTo(fiber.anchorL.x, fiber.anchorL.y);
        ctx.quadraticCurveTo(
          fiber.currentMid.x,
          fiber.currentMid.y,
          fiber.anchorR.x,
          fiber.anchorR.y
        );

        // Semi-translucent fine fibrous thread
        ctx.strokeStyle = fiber.color;
        ctx.lineWidth = fiber.thickness;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Subtle specular sheen line
        ctx.strokeStyle = `rgba(255, 255, 255, ${fiber.alpha * 0.6})`;
        ctx.lineWidth = Math.max(fiber.thickness * 0.4, 0.5);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  public clear(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }
}
