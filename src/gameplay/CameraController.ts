import type { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { ArcadePhysics } from "./ArcadePhysics";
import { TUNING } from "../data/tuning";
import { clamp, damp, randRange } from "../utils/MathUtils";

const C = TUNING.camera;

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

  constructor(scene: Scene) {
    this.camera = new ArcRotateCamera("cam", C.alpha, C.beta, 16, Vector3.Zero(), scene);
    this.camera.minZ = 0.1;
    this.camera.maxZ = 200;
    // gameplay drives the camera — no user orbit controls
    this.camera.inputs.clear();
  }

  /** Frame a level: arena size decides the overview distance. */
  frameLevel(width: number, depth: number): void {
    const fitW = width / (2 * Math.tan(this.camera.fov / 2)) / Math.max(0.5, this.aspect());
    const fitD = depth * 0.78;
    this.overviewRadius = Math.max(C.minRadius, fitW * 1.25, fitD);
    this.mode = "overview";
    this.targetPos.set(0, 0, 0.4);
    // snap on level load
    this.curTarget.copyFrom(this.targetPos);
    this.curRadius = this.overviewRadius;
    this.apply(0);
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
      this.targetPos.set(0, 0, 0.4);
    } else if (this.mode === "follow") {
      this.targetPos.set(phys.pos.x, phys.pos.y * 0.5, phys.pos.z);
      wantRadius = clamp(
        this.overviewRadius * 0.72 + phys.speed * C.speedZoom,
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
    this.camera.beta = C.beta;
    this.camera.radius = this.curRadius;
  }
}
