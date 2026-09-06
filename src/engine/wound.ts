/**
 * Wound Manager:
 * Handles continuous spline generation, spring-mass edge retraction,
 * gaping envelope calculation, and temporal oxidation/healing.
 */

import { Vec2, SpringMassNode, catmullRom, catmullRomTangent } from './physics';
import { TissueStrataManager, type CollagenFiber, type LipidGlobule } from './strata';

export interface RawStrokePoint {
  x: number;
  y: number;
  time: number;
  pressure: number;
}

export interface WoundCut {
  id: string;
  createdAt: number;
  nodes: SpringMassNode[];
  rawPoints: RawStrokePoint[];
  totalLength: number;
  isComplete: boolean;
  baseWidth: number;
  fibers: CollagenFiber[];
  lipids: LipidGlobule[];
  coagulationProgress: number; // 0.0 fresh arterial -> 1.0 clotted burgundy
  bleedSourceRemaining: number;
}

export class WoundManager {
  public wounds: WoundCut[] = [];
  public activeCut: WoundCut | null = null;
  public strataManager: TissueStrataManager;

  // Smoothing buffer for active pointer drag
  private inputBuffer: RawStrokePoint[] = [];

  constructor(strataManager: TissueStrataManager) {
    this.strataManager = strataManager;
  }

  /**
   * Start a new cut stroke
   */
  public beginCut(x: number, y: number, time: number, pressure: number = 1.0): void {
    this.inputBuffer = [{ x, y, time, pressure }];

    const newCut: WoundCut = {
      id: `cut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: time,
      nodes: [],
      rawPoints: [{ x, y, time, pressure }],
      totalLength: 0,
      isComplete: false,
      baseWidth: 12.0,
      fibers: [],
      lipids: [],
      coagulationProgress: 0.0,
      bleedSourceRemaining: 1.0,
    };

    this.activeCut = newCut;
    this.wounds.push(newCut);
  }

  /**
   * Add movement point to active stroke
   */
  public addPoint(x: number, y: number, time: number, pressure: number = 1.0): { velocity: number; normal: Vec2 } | null {
    if (!this.activeCut) return null;

    const pts = this.inputBuffer;
    const lastPt = pts[pts.length - 1];
    const dx = x - lastPt.x;
    const dy = y - lastPt.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Filter tiny micro-jitters
    if (dist < 3.0) return null;

    const dt = Math.max((time - lastPt.time) / 1000, 0.001);
    const velocity = dist / dt;

    pts.push({ x, y, time, pressure });
    this.activeCut.rawPoints.push({ x, y, time, pressure });

    const stepSize = 6.0; // 6px fine sampling resolution

    if (pts.length >= 4) {
      // Catmull-Rom spline segment
      const p0 = new Vec2(pts[pts.length - 4].x, pts[pts.length - 4].y);
      const p1 = new Vec2(pts[pts.length - 3].x, pts[pts.length - 3].y);
      const p2 = new Vec2(pts[pts.length - 2].x, pts[pts.length - 2].y);
      const p3 = new Vec2(pts[pts.length - 1].x, pts[pts.length - 1].y);

      const segDist = p1.distanceTo(p2);
      const steps = Math.max(Math.floor(segDist / stepSize), 1);

      for (let s = 1; s <= steps; s++) {
        const u = s / steps;
        const pos = catmullRom(p0, p1, p2, p3, u);
        const tangent = catmullRomTangent(p0, p1, p2, p3, u);
        const normal = tangent.perp();

        // Dynamic gaping width: faster slices cut deeper and snap wider
        const speedFactor = Math.min(Math.max((velocity - 120) / 900, 0.35), 1.7);
        const targetHalfWidth = Math.min(Math.max((8.0 + speedFactor * 14.0) * pressure, 4.0), 32.0);

        const node = new SpringMassNode(pos, normal, tangent, targetHalfWidth);
        this.activeCut.nodes.push(node);
        this.activeCut.totalLength += stepSize;
      }

      const currentTangent = catmullRomTangent(p0, p1, p2, p3, 1.0);
      return {
        velocity,
        normal: currentTangent.perp(),
      };
    } else if (pts.length >= 2) {
      // Linear interpolation for initial points before 4-point spline buffer fills
      const pA = new Vec2(pts[pts.length - 2].x, pts[pts.length - 2].y);
      const pB = new Vec2(pts[pts.length - 1].x, pts[pts.length - 1].y);
      const segDist = pA.distanceTo(pB);

      if (segDist >= stepSize) {
        const steps = Math.max(Math.floor(segDist / stepSize), 1);
        const tangent = new Vec2(dx, dy).normalize();
        const normal = tangent.perp();

        for (let s = 1; s <= steps; s++) {
          const u = s / steps;
          const pos = new Vec2(pA.x + (pB.x - pA.x) * u, pA.y + (pB.y - pA.y) * u);
          const targetHalfWidth = Math.min(Math.max(10.0 * pressure, 4.0), 22.0);

          const node = new SpringMassNode(pos, normal, tangent, targetHalfWidth);
          this.activeCut.nodes.push(node);
          this.activeCut.totalLength += stepSize;
        }

        return { velocity, normal };
      }
    }

    return {
      velocity,
      normal: new Vec2(-dy, dx).normalize(),
    };
  }

  /**
   * Finalize the cut on pointer release
   */
  public endCut(_time?: number): WoundCut | null {
    if (!this.activeCut) return null;

    const cut = this.activeCut;
    cut.isComplete = true;

    // If stroke was very short and didn't generate enough nodes, interpolate from raw points
    if (cut.nodes.length < 3 && cut.rawPoints.length >= 2) {
      const p1 = new Vec2(cut.rawPoints[0].x, cut.rawPoints[0].y);
      const p2 = new Vec2(cut.rawPoints[cut.rawPoints.length - 1].x, cut.rawPoints[cut.rawPoints.length - 1].y);
      const dist = p1.distanceTo(p2);
      const steps = Math.max(Math.floor(dist / 5.0), 4);
      const tangent = new Vec2(p2.x - p1.x, p2.y - p1.y).normalize();
      const normal = tangent.perp();

      cut.nodes = [];
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const pos = new Vec2(p1.x + (p2.x - p1.x) * u, p1.y + (p2.y - p1.y) * u);
        const node = new SpringMassNode(pos, normal, tangent, 12.0);
        cut.nodes.push(node);
      }
      cut.totalLength = dist;
    }

    // Apply smooth lenticular taper to both ends of the wound (Fontana slit shape)
    const nodeCount = cut.nodes.length;
    if (nodeCount >= 3) {
      for (let i = 0; i < nodeCount; i++) {
        const s = i / (nodeCount - 1);
        // Sinusoidal lenticular envelope: 0 at tips, 1 at center
        const envelope = Math.sin(s * Math.PI);
        // Slightly sharpen the very tip
        const taper = Math.pow(envelope, 0.72);
        cut.nodes[i].targetHalfWidth *= taper;
      }

      // Procedurally generate bridging connective tissue fibers and lipid globules
      const nodesData = cut.nodes.map(n => ({
        spinePos: n.spinePos,
        normal: n.normal,
        targetHalfWidth: n.targetHalfWidth,
      }));

      cut.fibers = this.strataManager.generateFibersForWound(nodesData);
      cut.lipids = this.strataManager.generateLipidsForWound(nodesData);
    }

    this.activeCut = null;
    this.inputBuffer = [];
    return cut;
  }

  /**
   * Step physics for all wounds
   */
  public update(dt: number, currentTime: number): void {
    const subDt = Math.min(dt, 0.033);

    for (const cut of this.wounds) {
      const nodes = cut.nodes;
      const n = nodes.length;

      // Neighboring node coupling for organic continuous membrane gaping
      for (let i = 0; i < n; i++) {
        let neighborPullL = 0;
        let neighborPullR = 0;

        if (i > 0) {
          neighborPullL += nodes[i - 1].currentWidthL - nodes[i].currentWidthL;
          neighborPullR += nodes[i - 1].currentWidthR - nodes[i].currentWidthR;
        }
        if (i < n - 1) {
          neighborPullL += nodes[i + 1].currentWidthL - nodes[i].currentWidthL;
          neighborPullR += nodes[i + 1].currentWidthR - nodes[i].currentWidthR;
        }

        nodes[i].update(subDt, neighborPullL, neighborPullR);
      }

      // Update fiber anchors to match current gaping positions
      for (const fiber of cut.fibers) {
        const node = nodes[fiber.nodeIndex];
        if (node) {
          const norm = node.normal;
          fiber.anchorL.set(
            node.spinePos.x - norm.x * node.currentWidthL,
            node.spinePos.y - norm.y * node.currentWidthL
          );
          fiber.anchorR.set(
            node.spinePos.x + norm.x * node.currentWidthR,
            node.spinePos.y + norm.y * node.currentWidthR
          );
        }
      }

      // Update coagulation / oxidation over time
      // 0.0 -> 1.0 over ~75 seconds
      const age = (currentTime - cut.createdAt) / 1000;
      cut.coagulationProgress = Math.min(age / 75.0, 1.0);

      // Bleeding source rate slows as wound seals
      cut.bleedSourceRemaining = Math.max(1.0 - (age / 35.0), 0.05);
    }

    // Update tissue strata vibrations
    this.strataManager.update(subDt);
  }

  /**
   * Clear all wounds (regenerate canvas)
   */
  public clear(): void {
    this.wounds = [];
    this.activeCut = null;
    this.inputBuffer = [];
    this.strataManager.clear();
  }
}
