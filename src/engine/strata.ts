/**
 * Tissue Stratification:
 * 1. Subcutaneous Adipose lobules (lipid globules nestled in deep crevices)
 * 2. Subtle Collagen Strands: 2-4 semi-translucent fibrous bezier threads spanning narrow sections
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
  depth: number;
  gloss: number;
  jigglePhase: number;
  jiggleAmp: number;
}

export class TissueStrataManager {
  public fibers: CollagenFiber[] = [];
  public lipidGlobules: LipidGlobule[] = [];

  /**
   * Exactly 2 to 4 subtle, semi-translucent fibrous bezier threads spanning narrow sections
   */
  public generateFibersForWound(
    nodes: { spinePos: Vec2; normal: Vec2; targetHalfWidth: number }[]
  ): CollagenFiber[] {
    const newFibers: CollagenFiber[] = [];
    if (nodes.length < 4) return newFibers;

    // Strictly 2 to 4 subtle fibers
    const count = Math.min(Math.max(Math.floor(2 + Math.random() * 2.5), 2), 4);

    for (let k = 0; k < count; k++) {
      // Pick narrow sections near incision tips
      const isStart = Math.random() > 0.5;
      const nodeIdx = isStart
        ? Math.floor(1 + Math.random() * Math.min(nodes.length * 0.35, 6))
        : Math.floor(Math.max(nodes.length * 0.65, nodes.length - 7) + Math.random() * 4);

      const clampedIdx = Math.min(Math.max(nodeIdx, 1), nodes.length - 2);
      const node = nodes[clampedIdx];
      if (!node) continue;

      const norm = node.normal;
      const leftAnchor = new Vec2(
        node.spinePos.x - norm.x * (node.targetHalfWidth * 0.85),
        node.spinePos.y - norm.y * (node.targetHalfWidth * 0.85)
      );
      const rightAnchor = new Vec2(
        node.spinePos.x + norm.x * (node.targetHalfWidth * 0.85),
        node.spinePos.y + norm.y * (node.targetHalfWidth * 0.85)
      );

      const mid = new Vec2(
        (leftAnchor.x + rightAnchor.x) * 0.5 + (Math.random() - 0.5) * 3.0,
        (leftAnchor.y + rightAnchor.y) * 0.5 + (Math.random() - 0.5) * 3.0
      );

      newFibers.push({
        nodeIndex: clampedIdx,
        anchorL: leftAnchor,
        anchorR: rightAnchor,
        currentMid: mid,
        velocityMid: new Vec2((Math.random() - 0.5) * 20.0, (Math.random() - 0.5) * 20.0),
        thickness: 0.8 + Math.random() * 0.4, // Delicate hairline
        alpha: 0.45 + Math.random() * 0.25,  // Semi-translucent
        color: 'rgba(215, 195, 198, 0.6)',   // Muted fibrous pink-ivory
        isSnapped: false,
        quiverPhase: Math.random() * Math.PI * 2,
        quiverFreq: 22.0 + Math.random() * 12.0,
        maxStretch: node.targetHalfWidth * 2.5 + 10.0,
      });
    }

    this.fibers.push(...newFibers);
    return newFibers;
  }

  /**
   * Procedural lipid lobules (subcutaneous adipose) clustered along deep crevice walls
   */
  public generateLipidsForWound(
    nodes: { spinePos: Vec2; normal: Vec2; targetHalfWidth: number }[]
  ): LipidGlobule[] {
    const newLipids: LipidGlobule[] = [];

    for (let i = 2; i < nodes.length - 2; i += 2) {
      const node = nodes[i];
      if (node.targetHalfWidth < 6.0) continue;

      const side = Math.random() > 0.5 ? 1 : -1;
      const offsetNorm = node.targetHalfWidth * (0.35 + Math.random() * 0.35);

      const pos = new Vec2(
        node.spinePos.x + node.normal.x * (side * offsetNorm),
        node.spinePos.y + node.normal.y * (side * offsetNorm)
      );

      const r = 2.2 + Math.random() * 2.8;

      newLipids.push({
        nodeIndex: i,
        center: pos,
        radius: r,
        baseRadius: r,
        depth: 0.65 + Math.random() * 0.3,
        gloss: 0.9,
        jigglePhase: Math.random() * Math.PI * 2,
        jiggleAmp: 1.0,
      });
    }

    this.lipidGlobules.push(...newLipids);
    return newLipids;
  }

  public update(dt: number): void {
    const subDt = Math.min(dt, 0.033);

    // Update fibers
    for (const fiber of this.fibers) {
      if (fiber.isSnapped) continue;

      const currentDist = fiber.anchorL.distanceTo(fiber.anchorR);
      if (currentDist > fiber.maxStretch) {
        fiber.isSnapped = true;
        fiber.alpha = 0.15;
        continue;
      }

      fiber.quiverPhase += fiber.quiverFreq * subDt;
      const targetMidX = (fiber.anchorL.x + fiber.anchorR.x) * 0.5;
      const targetMidY = (fiber.anchorL.y + fiber.anchorR.y) * 0.5;

      const fx = -45.0 * (fiber.currentMid.x - targetMidX) - 10.0 * fiber.velocityMid.x;
      const fy = -45.0 * (fiber.currentMid.y - targetMidY) - 10.0 * fiber.velocityMid.y;

      fiber.velocityMid.x += fx * subDt;
      fiber.velocityMid.y += fy * subDt;
      fiber.currentMid.x += fiber.velocityMid.x * subDt;
      fiber.currentMid.y += fiber.velocityMid.y * subDt;
    }

    // Update lipid jiggle
    for (const lipid of this.lipidGlobules) {
      if (lipid.jiggleAmp > 0.01) {
        lipid.jigglePhase += 14.0 * subDt;
        lipid.jiggleAmp *= Math.pow(0.85, subDt * 60);
        lipid.radius = lipid.baseRadius * (1.0 + Math.sin(lipid.jigglePhase) * 0.05 * lipid.jiggleAmp);
      }
    }
  }

  public clear(): void {
    this.fibers = [];
    this.lipidGlobules = [];
  }
}
