import type { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { ArcadePhysics } from "./ArcadePhysics";
import { TUNING } from "../data/tuning";
import { clamp, damp, lerp, randRange } from "../utils/MathUtils";

const C = TUNING.camera;

/** Overview look-at point: slightly up-arena so the lot sits centered. */
const OVERVIEW_Z = 0.4;

type CamMode = "overview" | "follow" | "success";

/**
 * Fixed-yaw isometric camera. Overview frames the whole arena before a
 * shot; follow tracks the car and zooms out with speed; success eases
 * in on the parked car. Impacts add a decaying positional shake.
 */
export class CameraController {
  readonly camera: ArcRotateCamera;

  private mode: CamMode = "overview";
  private targetPos = new Vector3(0, 0, 0);
  private curTarget = new Vector3(0, 0, 0);
  private overviewRadius = 16;
  private curRadius = 16;
  private shake = 0;
  private successPoint = new Vector3(0, 0, 0);
  private levelWidth = 12;
  private levelDepth = 22;
  private beta: number = C.beta;

  constructor(scene: Scene) {
    this.camera = new ArcRotateCamera("cam", C.alpha, C.beta, 16, Vector3.Zero(), scene);
    this.camera.minZ = 0.1;
    this.camera.maxZ = 200;
    // gameplay drives the camera — no user orbit controls
    this.camera.inputs.clear();
  }

  /** Frame a level: arena size decides the overview distance. */
  frameLevel(width: number, depth: number): void {
    this.levelWidth = width;
    this.levelDepth = depth;
    this.mode = "overview";
    this.targetPos.set(0, 0, OVERVIEW_Z);
    this.refit();
    // snap on level load
    this.curTarget.copyFrom(this.targetPos);
    this.curRadius = this.overviewRadius;
    this.apply(0);
  }

  /** Re-fit after a viewport change (rotate, resize, fullscreen). */
  onResize(): void {
    this.refit();
  }

  private refit(): void {
    this.beta = this.fitBeta();
    this.overviewRadius = this.fitRadius(this.levelWidth, this.levelDepth);
  }

  /**
   * Tilt adapts to the viewport shape. The lots are long and narrow
   * (portrait-ish). On a tall phone screen a low, isometric tilt frames them
   * naturally. On a wide desktop screen that same tilt forces the camera far
   * back to fit the depth, shrinking the lot to a distant strip — so we swing
   * toward top-down, which trades some 3D drama for a playfield that actually
   * fills the screen.
   */
  private fitBeta(): number {
    const [lo, hi] = C.betaBlendAspect;
    const t = clamp((this.aspect() - lo) / (hi - lo), 0, 1);
    return lerp(C.beta, C.betaWide, t);
  }

  /**
   * Are all four ground corners inside the frustum at this distance?
   *
   * Builds the camera basis for the current alpha/beta/radius and projects
   * each corner into view space. Cheap enough to bisect over (~40 calls,
   * once per level load / resize).
   */
  private cornersVisible(radius: number, halfW: number, halfD: number): boolean {
    const tanV = Math.tan(this.camera.fov / 2);
    const tanH = tanV * this.aspect();
    // always fit around the overview anchor, never the live follow target
    const tz = OVERVIEW_Z;

    // ArcRotateCamera eye for alpha = -PI/2 (camera on the -Z side)
    const sb = Math.sin(this.beta);
    const cb = Math.cos(this.beta);
    const ex = 0;
    const ey = radius * cb;
    const ez = tz - radius * sb;

    // forward = normalize(target - eye)
    let fx = 0 - ex;
    let fy = 0 - ey;
    let fz = tz - ez;
    const fl = Math.hypot(fx, fy, fz) || 1;
    fx /= fl;
    fy /= fl;
    fz /= fl;

    // right = normalize(forward x worldUp), up = right x forward
    let rx = fy * 0 - fz * 1;
    let ry = fz * 0 - fx * 0;
    let rz = fx * 1 - fy * 0;
    const rl = Math.hypot(rx, ry, rz) || 1;
    rx /= rl;
    ry /= rl;
    rz /= rl;
    const ux = ry * fz - rz * fy;
    const uy = rz * fx - rx * fz;
    const uz = rx * fy - ry * fx;

    // HUD chrome eats the top and bottom of the frame — the playfield has to
    // clear those bands, not just the raw viewport edges.
    const upLimit = 1 - 2 * C.safeTop;
    const downLimit = 1 - 2 * C.safeBottom;

    for (const cx of [-halfW, halfW]) {
      for (const cz of [-halfD, halfD]) {
        const dx = cx - ex;
        const dy = -ey;
        const dz = cz - ez;
        const zc = dx * fx + dy * fy + dz * fz; // depth along view axis
        if (zc <= 0.01) return false;
        const xc = dx * rx + dy * ry + dz * rz;
        const yc = dx * ux + dy * uy + dz * uz;
        if (Math.abs(xc) > zc * tanH) return false;
        const vLimit = yc >= 0 ? upLimit : downLimit;
        if (Math.abs(yc) > zc * tanV * vLimit) return false;
      }
    }
    return true;
  }

  /**
   * Smallest distance that keeps the entire lot on screen.
   *
   * Solved by bisection on `cornersVisible` rather than a closed form: the
   * camera targets a slightly offset z and the tilt makes the projected
   * arena asymmetric (the far edge climbs faster than the near edge drops),
   * so a symmetric trig fit under-shoots and clips the near corners. The old
   * code fitted width only, which pushed the car — parked at the near end —
   * off the bottom of the screen on wide desktop viewports.
   */
  private fitRadius(width: number, depth: number): number {
    const halfW = width / 2 + C.fitPadding;
    const halfD = depth / 2 + C.fitPadding;

    let lo: number = C.minRadius;
    let hi = 400;
    if (this.cornersVisible(lo, halfW, halfD)) return lo;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (this.cornersVisible(mid, halfW, halfD)) hi = mid;
      else lo = mid;
    }
    return hi;
  }

  private aspect(): number {
    const e = this.camera.getEngine();
    return e.getRenderWidth() / Math.max(1, e.getRenderHeight());
  }

  setOverview(): void {
    this.mode = "overview";
  }

  follow(): void {
    this.mode = "follow";
  }

  zoomSuccess(x: number, z: number): void {
    this.mode = "success";
    this.successPoint.set(x, 0, z);
  }

  addShake(amount: number): void {
    this.shake = Math.min(1, this.shake + amount);
  }

  update(phys: ArcadePhysics, dt: number): void {
    let wantRadius = this.overviewRadius;
    if (this.mode === "overview") {
      this.targetPos.set(0, 0, OVERVIEW_Z);
    } else if (this.mode === "follow") {
      this.targetPos.set(phys.pos.x, phys.pos.y * 0.5, phys.pos.z);
      wantRadius = clamp(
        this.overviewRadius * C.followZoomFactor + phys.speed * C.speedZoom,
        C.minRadius,
        this.overviewRadius * 1.05
      );
    } else {
      this.targetPos.copyFrom(this.successPoint);
      wantRadius = Math.max(C.minRadius * 0.7, this.overviewRadius * C.successZoomFactor);
    }

    this.curTarget.x = damp(this.curTarget.x, this.targetPos.x, C.followLerp, dt);
    this.curTarget.y = damp(this.curTarget.y, this.targetPos.y, C.followLerp, dt);
    this.curTarget.z = damp(this.curTarget.z, this.targetPos.z, C.followLerp, dt);
    this.curRadius = damp(this.curRadius, wantRadius, C.radiusLerp, dt);
    this.shake = Math.max(0, this.shake - C.shakeDecay * dt * this.shake - 0.4 * dt);

    this.apply(this.shake);
  }

  private apply(shake: number): void {
    const s = shake * 0.35;
    this.camera.target.set(
      this.curTarget.x + randRange(-s, s),
      this.curTarget.y + randRange(-s, s) * 0.4,
      this.curTarget.z + randRange(-s, s)
    );
    this.camera.alpha = C.alpha;
    this.camera.beta = this.beta;
    this.camera.radius = this.curRadius;
  }
}
