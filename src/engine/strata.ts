/**
 * Tissue Stratification:
 * Anatomical layers exposed upon incising the taut biological membrane:
 * 1. Epidermal perimeter (pale blanched margin, curled lip)
 * 2. Dermis (fibrous pink/red tissue with bridging collagen strands)
 * 3. Subcutaneous layer (soft, glistening yellow-white lipid globules)
 * 4. Core cavity (dark crimson void with ambient occlusion)
 */

import { Vec2 } from './physics';

export interface CollagenFiber {
  nodeIndex: number;
  anchorL: Vec2;
  anchorR: Vec2;
  currentMid: Vec2;
  velocityMid: Vec2;
  thickness: number;
  alpha: number;
  color: string;
  isSnapped: boolean;
  quiverPhase: number;
  quiverFreq: number;
  maxStretch: number;
}

export interface LipidGlobule {
  nodeIndex: number;
  center: Vec2;
  radius: number;
  baseRadius: number;
  depth: number; // 0.0 to 1.0
  hueShift: number;
  gloss: number;
  jigglePhase: number;
  jiggleAmp: number;
}

export class TissueStrataManager {
  public fibers: CollagenFiber[] = [];
  public lipidGlobules: LipidGlobule[] = [];

  /**
   * Procedurally generate bridging connective tissue fibers along a newly formed wound
   */
  public generateFibersForWound(
    nodes: { spinePos: Vec2; normal: Vec2; targetHalfWidth: number }[]
  ): CollagenFiber[] {
    const newFibers: CollagenFiber[] = [];
    const count = Math.min(Math.max(Math.floor(nodes.length * 0.35), 4), 28);

    for (let k = 0; k < count; k++) {
      // Pick random node index along the wound, favoring ends and narrower sections
      const nodeIdx = Math.floor(1 + Math.random() * (nodes.length - 2));
      const node = nodes[nodeIdx];
      if (!node) continue;

      // Only generate fibers where cut gap is moderate
      if (node.targetHalfWidth > 32) continue;

      const norm = node.normal;
      const leftAnchor = new Vec2(
        node.spinePos.x - norm.x * (node.targetHalfWidth * (0.6 + Math.random() * 0.4)),
        node.spinePos.y - norm.y * (node.targetHalfWidth * (0.6 + Math.random() * 0.4))
      );
      const rightAnchor = new Vec2(
        node.spinePos.x + norm.x * (node.targetHalfWidth * (0.6 + Math.random() * 0.4)),
        node.spinePos.y + norm.y * (node.targetHalfWidth * (0.6 + Math.random() * 0.4))
      );

      const mid = new Vec2(
        (leftAnchor.x + rightAnchor.x) * 0.5 + (Math.random() - 0.5) * 4.0,
        (leftAnchor.y + rightAnchor.y) * 0.5 + (Math.random() - 0.5) * 4.0
      );

      newFibers.push({
        nodeIndex: nodeIdx,
        anchorL: leftAnchor,
        anchorR: rightAnchor,
        currentMid: mid,
        velocityMid: new Vec2((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60),
        thickness: 0.75 + Math.random() * 1.5,
        alpha: 0.75 + Math.random() * 0.25,
        color: Math.random() > 0.4 ? '#E4A5AC' : '#F6D2D6', // Pale fibrous pink/cream
        isSnapped: false,
        quiverPhase: Math.random() * Math.PI * 2,
        quiverFreq: 18.0 + Math.random() * 14.0,
        maxStretch: node.targetHalfWidth * 2.2 + 8.0,
      });
    }

    this.fibers.push(...newFibers);
    return newFibers;
  }

  /**
   * Procedurally generate lipid globules (subcutaneous adipose clusters) along wound walls
   */
  public generateLipidsForWound(
    nodes: { spinePos: Vec2; normal: Vec2; tangent?: Vec2; targetHalfWidth: number }[]
  ): LipidGlobule[] {
    const newLipids: LipidGlobule[] = [];

    for (let i = 1; i < nodes.length - 1; i++) {
      const node = nodes[i];
      if (node.targetHalfWidth < 6) continue;

      // 1 to 3 globules per node along both left and right inner shelves
      const globuleCount = Math.floor(1 + Math.random() * 2.5);
      for (let g = 0; g < globuleCount; g++) {
        const side = Math.random() > 0.5 ? 1 : -1;
        // Placed between 30% and 80% out from center spine towards edge
        const distRatio = 0.25 + Math.random() * 0.55;
        const offsetNorm = distRatio * node.targetHalfWidth;
        const tangJitter = (Math.random() - 0.5) * 6.0;

        const pos = new Vec2(
          node.spinePos.x + node.normal.x * (side * offsetNorm) + (node.normal.y * tangJitter),
          node.spinePos.y + node.normal.y * (side * offsetNorm) - (node.normal.x * tangJitter)
        );

        const r = 3.0 + Math.random() * 4.5;

        newLipids.push({
          nodeIndex: i,
          center: pos,
          radius: r,
          baseRadius: r,
          depth: 0.55 + Math.random() * 0.35, // deeper in tissue
          hueShift: (Math.random() - 0.5) * 0.15,
          gloss: 0.85 + Math.random() * 0.15,
          jigglePhase: Math.random() * Math.PI * 2,
          jiggleAmp: 1.0,
        });
      }
    }

    this.lipidGlobules.push(...newLipids);
    return newLipids;
  }

  /**
   * Update dynamic fibers and lipid jiggle
   */
  public update(dt: number): void {
    const subDt = Math.min(dt, 0.033);

    // Update fibers
    for (const fiber of this.fibers) {
      if (fiber.isSnapped) continue;

      // Distance between anchors
      const currentDist = fiber.anchorL.distanceTo(fiber.anchorR);
      if (currentDist > fiber.maxStretch) {
        fiber.isSnapped = true;
        fiber.alpha = 0.2;
        continue;
      }

      // Quiver dampening
      fiber.quiverPhase += fiber.quiverFreq * subDt;
      const targetMidX = (fiber.anchorL.x + fiber.anchorR.x) * 0.5;
      const targetMidY = (fiber.anchorL.y + fiber.anchorR.y) * 0.5;

      // Spring-mass for fiber center
      const fx = -45.0 * (fiber.currentMid.x - targetMidX) - 8.0 * fiber.velocityMid.x;
      const fy = -45.0 * (fiber.currentMid.y - targetMidY) - 8.0 * fiber.velocityMid.y;

      fiber.velocityMid.x += fx * subDt;
      fiber.velocityMid.y += fy * subDt;

      fiber.currentMid.x += fiber.velocityMid.x * subDt;
      fiber.currentMid.y += fiber.velocityMid.y * subDt;
    }

    // Update lipid globules jiggle
    for (const lipid of this.lipidGlobules) {
      if (lipid.jiggleAmp > 0.01) {
        lipid.jigglePhase += 14.0 * subDt;
        lipid.jiggleAmp *= Math.pow(0.88, subDt * 60); // exponential decay
        lipid.radius = lipid.baseRadius * (1.0 + Math.sin(lipid.jigglePhase) * 0.08 * lipid.jiggleAmp);
      }
    }
  }

  public clear(): void {
    this.fibers = [];
    this.lipidGlobules = [];
  }
}
