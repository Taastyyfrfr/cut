/**
 * Physics and Spline Mathematics for Dermal Cutting & Tension Dynamics
 */

export interface Point2D {
  x: number;
  y: number;
  time: number;
  pressure?: number;
}

export class Vec2 {
  public x: number;
  public y: number;

  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }

  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  copy(v: Vec2): this {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  clone(): Vec2 {
    return new Vec2(this.x, this.y);
  }

  add(v: Vec2): this {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  sub(v: Vec2): this {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  scale(s: number): this {
    this.x *= s;
    this.y *= s;
    return this;
  }

  lengthSq(): number {
    return this.x * this.x + this.y * this.y;
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize(): this {
    const len = this.length();
    if (len > 0.00001) {
      this.x /= len;
      this.y /= len;
    }
    return this;
  }

  dot(v: Vec2): number {
    return this.x * v.x + this.y * v.y;
  }

  perp(): Vec2 {
    // Normal vector perpendicular to (x, y)
    return new Vec2(-this.y, this.x);
  }

  distanceTo(v: Vec2): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  lerp(v: Vec2, alpha: number): this {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    return this;
  }
}

/**
 * Catmull-Rom Spline Interpolation
 * Evaluates smooth curve through points p0, p1, p2, p3 at parameter t in [0, 1]
 */
export function catmullRom(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const t2 = t * t;
  const t3 = t2 * t;

  const f0 = -0.5 * t3 + t2 - 0.5 * t;
  const f1 = 1.5 * t3 - 2.5 * t2 + 1.0;
  const f2 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
  const f3 = 0.5 * t3 - 0.5 * t2;

  return new Vec2(
    p0.x * f0 + p1.x * f1 + p2.x * f2 + p3.x * f3,
    p0.y * f0 + p1.y * f1 + p2.y * f2 + p3.y * f3
  );
}

/**
 * Tangent of Catmull-Rom Spline at parameter t
 */
export function catmullRomTangent(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const t2 = t * t;

  const f0 = -1.5 * t2 + 2.0 * t - 0.5;
  const f1 = 4.5 * t2 - 5.0 * t;
  const f2 = -4.5 * t2 + 4.0 * t + 0.5;
  const f3 = 1.5 * t2 - 1.0 * t;

  const tan = new Vec2(
    p0.x * f0 + p1.x * f1 + p2.x * f2 + p3.x * f3,
    p0.y * f0 + p1.y * f1 + p2.y * f2 + p3.y * f3
  );
  return tan.normalize();
}

/**
 * Damped spring-mass state for visceral skin recoil
 */
export class SpringMassNode {
  // Center anchor along the cut spine
  public spinePos: Vec2;
  public normal: Vec2;
  public tangent: Vec2;

  // Tension parameters
  public targetHalfWidth: number = 0;
  public currentWidthL: number = 0;
  public currentWidthR: number = 0;
  public velocityL: number = 0;
  public velocityR: number = 0;

  // Viscoelastic constants
  public stiffness: number = 38.0;   // Spring recall
  public damping: number = 7.5;      // Viscous damping (slightly underdamped for recoil snap)
  public mass: number = 1.0;

  // Curling of the epidermal lip
  public curlHeight: number = 0;     // Vertical bevel/curl

  constructor(spinePos: Vec2, normal: Vec2, tangent: Vec2, targetHalfWidth: number) {
    this.spinePos = spinePos.clone();
    this.normal = normal.clone().normalize();
    this.tangent = tangent.clone().normalize();
    this.targetHalfWidth = targetHalfWidth;

    // Initially closed
    this.currentWidthL = 0.5;
    this.currentWidthR = 0.5;

    // Initial recoil impulse when cut
    const impulse = 120.0 + Math.random() * 40.0;
    this.velocityL = impulse;
    this.velocityR = impulse;
  }

  /**
   * Update spring-mass dynamics
   * @param dt Time delta in seconds
   * @param neighborPullL Coupling force from adjacent nodes
   * @param neighborPullR Coupling force from adjacent nodes
   */
  public update(dt: number, neighborPullL: number = 0, neighborPullR: number = 0): void {
    // Clamp dt to prevent explosion on tab switch
    const subDt = Math.min(dt, 0.033);

    // Left edge spring: F = -k*(x - target) - c*v + neighborCoupling
    const forceL = -this.stiffness * (this.currentWidthL - this.targetHalfWidth) 
                   - this.damping * this.velocityL 
                   + neighborPullL * 15.0;
    const accelL = forceL / this.mass;
    this.velocityL += accelL * subDt;
    this.currentWidthL += this.velocityL * subDt;
    if (this.currentWidthL < 0) {
      this.currentWidthL = 0;
      this.velocityL = 0;
    }

    // Right edge spring
    const forceR = -this.stiffness * (this.currentWidthR - this.targetHalfWidth) 
                   - this.damping * this.velocityR 
                   + neighborPullR * 15.0;
    const accelR = forceR / this.mass;
    this.velocityR += accelR * subDt;
    this.currentWidthR += this.velocityR * subDt;
    if (this.currentWidthR < 0) {
      this.currentWidthR = 0;
      this.velocityR = 0;
    }

    // Curl relaxes towards a subtle raised lip as tension gapes
    const targetCurl = Math.min(this.targetHalfWidth * 0.25, 4.0);
    this.curlHeight += (targetCurl - this.curlHeight) * subDt * 6.0;
  }

  /**
   * Compute current left and right world coordinates
   */
  public getLeftPos(): Vec2 {
    return new Vec2(
      this.spinePos.x - this.normal.x * this.currentWidthL,
      this.spinePos.y - this.normal.y * this.currentWidthL
    );
  }

  public getRightPos(): Vec2 {
    return new Vec2(
      this.spinePos.x + this.normal.x * this.currentWidthR,
      this.spinePos.y + this.normal.y * this.currentWidthR
    );
  }
}
