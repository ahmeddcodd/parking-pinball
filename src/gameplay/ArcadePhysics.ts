import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TUNING } from "../data/tuning";
import { clamp } from "../utils/MathUtils";

/**
 * Custom fixed-timestep arcade physics.
 *
 * The car is a single circle (in XZ) with a height coordinate for jumps.
 * Walls are rotated boxes (circle-vs-OBB with reflection), bumpers are
 * circles that fire a radial impulse. Everything else in the game is a
 * pure trigger check done by the objects themselves.
 *
 * Deliberately not a general engine: it's tuned to make a toy car in a
 * pinball parking lot feel great, resolve fast, and cost ~nothing.
 */

export interface WallCollider {
  x: number;
  z: number;
  halfW: number;
  halfD: number;
  cos: number;
  sin: number;
  height: number;
  restitution: number;
  ref?: unknown;
}

export interface BumperCollider {
  x: number;
  z: number;
  radius: number;
  force: number;
  cooldown: number;
  ref?: unknown;
}

export interface GroundRect {
  x: number;
  z: number;
  halfW: number;
  halfD: number;
}

/** A circular pit punched out of the lot. The car falls in if it drives over. */
export interface HoleCollider {
  x: number;
  z: number;
  radius: number;
}

const P = TUNING.physics;

export class ArcadePhysics {
  readonly pos = new Vector3(0, 0, 0); // y = height of car bottom above lot
  readonly vel = new Vector3(0, 0, 0);
  airborne = false;

  /**
   * The hole that swallowed the car, or null. Once set, the car is committed:
   * it cannot land, collide or climb back out — only a reset clears it.
   */
  capturedBy: HoleCollider | null = null;

  walls: WallCollider[] = [];
  bumpers: BumperCollider[] = [];
  grounds: GroundRect[] = [];
  holes: HoleCollider[] = [];

  /** Extra damping applied this frame (parking auto-brake). */
  extraDamping = 0;
  /** Assist force applied this frame (parking magnet). */
  readonly assistForce = new Vector3(0, 0, 0);

  onWallHit: ((impactSpeed: number, x: number, z: number) => void) | null = null;
  onBumperHit: ((b: BumperCollider) => void) | null = null;
  onLand: (() => void) | null = null;
  /** Fired the instant the car drops into a hole, before it has fallen far. */
  onHoleEnter: ((h: HoleCollider) => void) | null = null;

  private accumulator = 0;
  private settleTimer = 0;

  get speed(): number {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  /** True once the car has been (almost) still for a moment on the ground. */
  get settled(): boolean {
    return this.settleTimer >= P.stopSettleTime;
  }

  reset(x: number, z: number): void {
    this.pos.set(x, 0, z);
    this.vel.setAll(0);
    this.airborne = false;
    this.capturedBy = null;
    this.accumulator = 0;
    this.settleTimer = 0;
    this.extraDamping = 0;
    this.assistForce.setAll(0);
    for (const b of this.bumpers) b.cooldown = 0;
  }

  launch(dirX: number, dirZ: number, power: number): void {
    const len = Math.hypot(dirX, dirZ) || 1;
    this.vel.x = (dirX / len) * power;
    this.vel.z = (dirZ / len) * power;
    this.settleTimer = 0;
  }

  /** Ramp takeoff: convert forward speed into a jump. */
  launchAir(): void {
    if (this.airborne) return;
    const s = this.speed;
    this.vel.y = s * TUNING.ramp.liftFactor;
    this.vel.x *= TUNING.ramp.boost;
    this.vel.z *= TUNING.ramp.boost;
    this.airborne = true;
  }

  update(dt: number): void {
    this.accumulator += Math.min(dt, 0.1);
    while (this.accumulator >= P.fixedStep) {
      this.substep(P.fixedStep);
      this.accumulator -= P.fixedStep;
    }
    // consumed once per frame — owners re-set them every frame
    this.extraDamping = 0;
    this.assistForce.setAll(0);
  }

  /**
   * Is there solid lot under this point?
   *
   * Holes are subtracted from the ground, so the existing gravity/landing
   * logic does the rest: over a hole there is nothing to land on, so the car
   * simply falls through and trips the out-of-bounds check. Airborne cars are
   * unaffected — this is only consulted at ground level, so a ramp jump sails
   * straight over a pit.
   *
   * The car is a circle, but testing its center against a slightly shrunken
   * hole is what feels right: clipping the very lip lets you scrape past,
   * while committing the car's middle over the edge drops you in.
   */
  private isOverGround(x: number, z: number): boolean {
    const m = P.fallEdgeMargin;
    for (const g of this.grounds) {
      if (Math.abs(x - g.x) <= g.halfW + m && Math.abs(z - g.z) <= g.halfD + m) return true;
    }
    return false;
  }

  /** The hole containing this point, if any. */
  private holeAt(x: number, z: number): HoleCollider | null {
    for (const h of this.holes) {
      const dx = x - h.x;
      const dz = z - h.z;
      const r = h.radius * P.holeGrip;
      if (dx * dx + dz * dz < r * r) return h;
    }
    return null;
  }

  /**
   * Did the segment a→b pass through a hole's mouth? At 30 u/s a substep moves
   * the car ~0.25u, but this also guards fast diagonal crossings of a small
   * pit, where sampling only the end points would miss the mouth entirely.
   */
  private holeCrossed(ax: number, az: number, bx: number, bz: number): HoleCollider | null {
    const sx = bx - ax;
    const sz = bz - az;
    const segLenSq = sx * sx + sz * sz;
    if (segLenSq < 1e-8) return null;

    for (const h of this.holes) {
      const r = h.radius * P.holeGrip;
      // closest approach of the segment to the hole centre
      let t = ((h.x - ax) * sx + (h.z - az) * sz) / segLenSq;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = ax + sx * t - h.x;
      const cz = az + sz * t - h.z;
      if (cx * cx + cz * cz < r * r) return h;
    }
    return null;
  }

  private substep(dt: number): void {
    // ── captured: the car is inside a hole and committed to the fall ──
    // No landing, no collisions, no escape. Horizontal motion is killed
    // quickly so it drops down the shaft instead of shooting out the side —
    // without this the car keeps its speed, drifts past the hole's radius
    // while below the lot, finds solid ground and climbs back on top.
    if (this.capturedBy) {
      const keep = Math.pow(P.holeFallDamping, dt);
      this.vel.x *= keep;
      this.vel.z *= keep;
      this.vel.y += P.gravity * dt;
      this.airborne = true;
      this.pos.x += this.vel.x * dt;
      this.pos.y += this.vel.y * dt;
      this.pos.z += this.vel.z * dt;
      return;
    }

    const overGround = this.isOverGround(this.pos.x, this.pos.z);

    // At lot level, entering a hole's mouth swallows the car immediately.
    // Airborne cars (y > 0) sail over — this is only tested on the ground.
    if (this.pos.y <= 0) {
      const hole = this.holeAt(this.pos.x, this.pos.z);
      if (hole) {
        this.capturedBy = hole;
        this.airborne = true;
        // nudge toward the centre so it visibly drops into the mouth
        const dx = hole.x - this.pos.x;
        const dz = hole.z - this.pos.z;
        this.vel.x = this.vel.x * 0.35 + dx * P.holeSuck;
        this.vel.z = this.vel.z * 0.35 + dz * P.holeSuck;
        this.vel.y = Math.min(this.vel.y, -1.5); // commit downward at once
        this.onHoleEnter?.(hole);
        return;
      }
    }

    // gravity & landing
    if (this.pos.y > 0 || !overGround) {
      this.vel.y += P.gravity * dt;
      this.airborne = true;
    }

    // damping (ground contact only)
    if (!this.airborne) {
      const keep = Math.pow(P.groundDamping, dt) * Math.pow(1 - clamp(this.extraDamping, 0, 0.95), dt * 4);
      this.vel.x *= keep;
      this.vel.z *= keep;
      this.vel.x += this.assistForce.x * dt;
      this.vel.z += this.assistForce.z * dt;
    } else {
      const keep = Math.pow(P.airDamping, dt);
      this.vel.x *= keep;
      this.vel.z *= keep;
    }

    // clamp top speed
    const s = this.speed;
    if (s > P.maxSpeed) {
      const k = P.maxSpeed / s;
      this.vel.x *= k;
      this.vel.z *= k;
    }

    // integrate (remember where we were, for the swept hole test below)
    const px = this.pos.x;
    const pz = this.pos.z;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;

    // A fast car can step clean over a hole's mouth in one substep. Catch that
    // by testing the segment it just travelled, not only its end point.
    if (this.pos.y <= 0.02) {
      const hole = this.holeAt(this.pos.x, this.pos.z) ?? this.holeCrossed(px, pz, this.pos.x, this.pos.z);
      if (hole) {
        this.capturedBy = hole;
        this.airborne = true;
        this.pos.x = hole.x + (this.pos.x - hole.x) * 0.5;
        this.pos.z = hole.z + (this.pos.z - hole.z) * 0.5;
        this.vel.y = Math.min(this.vel.y, -1.5);
        this.onHoleEnter?.(hole);
        return;
      }
    }

    // land
    if (this.airborne && this.pos.y <= 0 && this.isOverGround(this.pos.x, this.pos.z)) {
      this.pos.y = 0;
      this.vel.y = 0;
      // the toy car thuds down and sheds speed instead of skating on
      this.vel.x *= TUNING.ramp.landAbsorb;
      this.vel.z *= TUNING.ramp.landAbsorb;
      this.airborne = false;
      this.onLand?.();
    }

    // collisions (skip what the car has jumped over)
    this.collideWalls();
    this.collideBumpers(dt);

    // settle detection (parking assist keeps nudging — don't freeze mid-glide)
    const assisted = Math.abs(this.assistForce.x) + Math.abs(this.assistForce.z) > 0.3;
    if (!this.airborne && this.speed < P.stopSpeed && !assisted) {
      this.settleTimer += dt;
      if (this.settleTimer >= P.stopSettleTime) {
        this.vel.x = 0;
        this.vel.z = 0;
      }
    } else {
      this.settleTimer = 0;
    }
  }

  private collideWalls(): void {
    const r = P.carRadius;
    for (const w of this.walls) {
      if (this.pos.y > w.height) continue;
      // circle center in wall-local space
      const dx = this.pos.x - w.x;
      const dz = this.pos.z - w.z;
      const lx = dx * w.cos + dz * w.sin;
      const lz = -dx * w.sin + dz * w.cos;
      const cx = clamp(lx, -w.halfW, w.halfW);
      const cz = clamp(lz, -w.halfD, w.halfD);
      let nx = lx - cx;
      let nz = lz - cz;
      let distSq = nx * nx + nz * nz;
      if (distSq >= r * r) continue;

      let dist: number;
      if (distSq < 1e-9) {
        // center inside the box — push out along the shallowest axis
        const px = w.halfW - Math.abs(lx);
        const pz = w.halfD - Math.abs(lz);
        if (px < pz) {
          nx = lx >= 0 ? 1 : -1;
          nz = 0;
        } else {
          nx = 0;
          nz = lz >= 0 ? 1 : -1;
        }
        dist = 0;
      } else {
        dist = Math.sqrt(distSq);
        nx /= dist;
        nz /= dist;
      }

      // normal back to world space
      const wnx = nx * w.cos - nz * w.sin;
      const wnz = nx * w.sin + nz * w.cos;

      // push out
      const push = r - dist;
      this.pos.x += wnx * push;
      this.pos.z += wnz * push;

      // reflect velocity along the normal
      const vn = this.vel.x * wnx + this.vel.z * wnz;
      if (vn < 0) {
        const impact = -vn;
        this.vel.x -= (1 + w.restitution) * vn * wnx;
        this.vel.z -= (1 + w.restitution) * vn * wnz;
        if (impact > 1.2) this.onWallHit?.(impact, this.pos.x, this.pos.z);
      }
    }
  }

  private collideBumpers(dt: number): void {
    const r = P.carRadius;
    for (const b of this.bumpers) {
      if (b.cooldown > 0) b.cooldown -= dt;
      if (this.pos.y > 0.6) continue; // flew over it
      const dx = this.pos.x - b.x;
      const dz = this.pos.z - b.z;
      const minDist = b.radius + r;
      const distSq = dx * dx + dz * dz;
      if (distSq >= minDist * minDist) continue;

      const dist = Math.sqrt(distSq) || 0.001;
      const nx = dx / dist;
      const nz = dz / dist;

      // push out of the bumper
      this.pos.x = b.x + nx * minDist;
      this.pos.z = b.z + nz * minDist;

      if (b.cooldown <= 0) {
        b.cooldown = TUNING.bumper.cooldown;
        // pinball kick: radial launch, keep a little of the tangent motion
        const tx = -nz;
        const tz = nx;
        const vt = this.vel.x * tx + this.vel.z * tz;
        const out = Math.max(TUNING.bumper.minExitSpeed, b.force);
        this.vel.x = nx * out + tx * vt * 0.35;
        this.vel.z = nz * out + tz * vt * 0.35;
        this.settleTimer = 0;
        this.onBumperHit?.(b);
      }
    }
  }
}
