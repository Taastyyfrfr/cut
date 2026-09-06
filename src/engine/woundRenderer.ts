/**
 * Hyper-Realistic Wound Texture Renderer:
 * Rasterizes true-color anatomical tissue stratification:
 * 1. Epidermal perimeter: blanched pale tension halo (#FAF7EF), curled lip bevel & drop shadow
 * 2. Dermis: striated fibrous crimson matrix (#9E1A29 to #5C0A14) with weeping capillary petechiae
 * 3. Subcutaneous adipose: clustered 3D golden-ivory lipid lobules (#F8E8C0) with ambient occlusion
 * 4. Core cavity: deep pitch crimson-black void (#080002) with spatial ambient occlusion
 * 5. Collagen strands: quivering pearlescent bridging fibers (#F2CAD1) with tensile specular sheen
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
   * Render stratified anatomy of all active wounds
   */
  public render(wounds: WoundCut[]): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    if (wounds.length === 0) return;

    // -------------------------------------------------------------
    // 1. Blanched Epidermal Perimeter (Pale ischemic halo under strain)
    // -------------------------------------------------------------
    ctx.save();
    for (const wound of wounds) {
      if (wound.nodes.length < 2) continue;

      ctx.beginPath();
      const pL0 = wound.nodes[0].getLeftPos();
      ctx.moveTo(pL0.x, pL0.y);

      for (let i = 1; i < wound.nodes.length; i++) {
        const p = wound.nodes[i].getLeftPos();
        ctx.lineTo(p.x, p.y);
      }
      for (let i = wound.nodes.length - 1; i >= 0; i--) {
        const p = wound.nodes[i].getRightPos();
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();

      // Outer blanched halo (diffuse tension stretch)
      ctx.strokeStyle = 'rgba(255, 252, 246, 0.48)';
      ctx.lineWidth = 15.0;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Concentrated ischemic white rim (severed capillary blanching)
      ctx.strokeStyle = 'rgba(255, 255, 252, 0.72)';
      ctx.lineWidth = 6.0;
      ctx.stroke();
    }
    ctx.restore();

    // -------------------------------------------------------------
    // 2. Dermis: Fibrous Deep Crimson Structural Tissue Matrix
    // -------------------------------------------------------------
    ctx.save();
    for (const wound of wounds) {
      if (wound.nodes.length < 2) continue;

      // Outer wound contour
      ctx.beginPath();
      const pL0 = wound.nodes[0].getLeftPos();
      ctx.moveTo(pL0.x, pL0.y);

      for (let i = 1; i < wound.nodes.length; i++) {
        const p = wound.nodes[i].getLeftPos();
        ctx.lineTo(p.x, p.y);
      }
      for (let i = wound.nodes.length - 1; i >= 0; i--) {
        const p = wound.nodes[i].getRightPos();
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();

      // Rich living dermis crimson base
      ctx.fillStyle = '#9E1A29';
      ctx.fill();

      // Curled lip inner shadow (depth bevel along severed dermal wall)
      ctx.strokeStyle = 'rgba(50, 4, 9, 0.65)';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Directional fibrous striations along the cut
      ctx.save();
      ctx.clip(); // clip to wound interior
      for (let i = 1; i < wound.nodes.length - 1; i += 2) {
        const node = wound.nodes[i];
        const pL = node.getLeftPos();
        const pR = node.getRightPos();

        // Striated collagen grain in dermis
        ctx.beginPath();
        ctx.moveTo(pL.x, pL.y);
        ctx.lineTo(node.spinePos.x, node.spinePos.y);
        ctx.strokeStyle = 'rgba(185, 38, 55, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(pR.x, pR.y);
        ctx.lineTo(node.spinePos.x, node.spinePos.y);
        ctx.strokeStyle = 'rgba(185, 38, 55, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Petechiae: micro-dots of bright arterial blood weeping from capillaries
        if (Math.random() < 0.35) {
          ctx.fillStyle = 'rgba(215, 0, 35, 0.85)';
          ctx.beginPath();
          ctx.arc(
            pL.x + node.normal.x * 2.5 + (Math.random() - 0.5) * 2,
            pL.y + node.normal.y * 2.5 + (Math.random() - 0.5) * 2,
            1.2 + Math.random() * 0.8,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }
      ctx.restore();
    }
    ctx.restore();

    // -------------------------------------------------------------
    // 3. Subcutaneous Layer: 3D Golden-Ivory Lipid Lobules (Adipose)
    // -------------------------------------------------------------
    ctx.save();
    for (const wound of wounds) {
      for (const lipid of wound.lipids) {
        const r = lipid.radius;
        if (r <= 0.5) continue;

        // Cast shadow behind lipid globule onto wound wall
        ctx.fillStyle = 'rgba(20, 2, 4, 0.5)';
        ctx.beginPath();
        ctx.arc(lipid.center.x + 1.2, lipid.center.y + 1.5, r * 1.05, 0, Math.PI * 2);
        ctx.fill();

        // 3D Spherical gradient
        const grad = ctx.createRadialGradient(
          lipid.center.x - r * 0.35,
          lipid.center.y - r * 0.35,
          r * 0.08,
          lipid.center.x,
          lipid.center.y,
          r
        );
        grad.addColorStop(0, '#FFFBEB');  // Highlight
        grad.addColorStop(0.35, '#F9E6B3'); // Buttery lipid body
        grad.addColorStop(0.75, '#D5B56E'); // Adipose amber
        grad.addColorStop(1, 'rgba(130, 90, 35, 0.9)'); // Shadow rim

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(lipid.center.x, lipid.center.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Sharp moist specular glint on lipid surface
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.beginPath();
        ctx.arc(lipid.center.x - r * 0.32, lipid.center.y - r * 0.32, Math.max(r * 0.22, 0.8), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // -------------------------------------------------------------
    // 4. Core Cavity: Deep Spatial Abyss & Ambient Occlusion
    // -------------------------------------------------------------
    ctx.save();
    for (const wound of wounds) {
      if (wound.nodes.length < 2) continue;

      const nodes = wound.nodes;

      // Deep ambient occlusion gradient along central spine
      ctx.beginPath();
      ctx.moveTo(nodes[0].spinePos.x, nodes[0].spinePos.y);
      for (let i = 1; i < nodes.length; i++) {
        ctx.lineTo(nodes[i].spinePos.x, nodes[i].spinePos.y);
      }

      const avgGap = nodes.reduce((acc, n) => acc + (n.currentWidthL + n.currentWidthR) * 0.5, 0) / nodes.length;

      // Soft ambient occlusion penumbra
      ctx.strokeStyle = 'rgba(18, 1, 3, 0.85)';
      ctx.lineWidth = Math.max(avgGap * 0.72, 5.0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Deepest central slit void (Fontana spatial abyss)
      ctx.strokeStyle = '#080002';
      ctx.lineWidth = Math.max(avgGap * 0.35, 2.5);
      ctx.stroke();
    }
    ctx.restore();

    // -------------------------------------------------------------
    // 5. Connective Strands: Bridging Collagen & Elastin Fibers
    // -------------------------------------------------------------
    ctx.save();
    for (const wound of wounds) {
      for (const fiber of wound.fibers) {
        if (fiber.isSnapped) continue;

        // Curved catenary/spring drape through vibrating midpoint
        ctx.beginPath();
        ctx.moveTo(fiber.anchorL.x, fiber.anchorL.y);
        ctx.quadraticCurveTo(
          fiber.currentMid.x,
          fiber.currentMid.y,
          fiber.anchorR.x,
          fiber.anchorR.y
        );

        // Translucent pearlescent collagen strand
        ctx.strokeStyle = fiber.color;
        ctx.lineWidth = fiber.thickness;
        ctx.lineCap = 'round';
        ctx.globalAlpha = fiber.alpha;
        ctx.stroke();

        // Crisp tensile specular glint line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = Math.max(fiber.thickness * 0.45, 0.6);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  public clear(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }
}
