import type { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { InputManager, DragState } from "../core/InputManager";
import type { ArcadePhysics } from "./ArcadePhysics";
import { TUNING } from "../data/tuning";
import { clamp, lerp } from "../utils/MathUtils";

const L = TUNING.launch;

/**
 * Slingshot input: drag anywhere, pull back, release to launch the car
 * the opposite way. Shows a dotted aim line + arrowhead that stretch
 * and heat up with power. The camera yaw is fixed, so screen-space
 * drag maps 1:1 onto the lot plane (right = +X, up = +Z).
 */
export class LauncherController {
  /** Fired continuously while aiming with power 0..1 (-1 = not aiming). */
  onCharge: ((power: number) => void) | null = null;
  /** Fired on release with launch speed; return value unused. */
  onLaunch: ((power01: number) => void) | null = null;

  private armed = false;
  private aiming = false;
  private dirX = 0;
  private dirZ = 1;
  private power01 = 0;

  private dots: Mesh[] = [];
  private head: Mesh;
  private dotMat: StandardMaterial;

  constructor(
    scene: Scene,
    private input: InputManager,
    private phys: ArcadePhysics
  ) {
    this.dotMat = new StandardMaterial("aim-mat", scene);
    this.dotMat.disableLighting = true;
    this.dotMat.emissiveColor = new Color3(1, 1, 1);
    this.dotMat.alpha = 0.95;

    for (let i = 0; i < L.aimDotCount; i++) {
      const d = MeshBuilder.CreateDisc(`aim-dot-${i}`, { radius: 0.11, tessellation: 12 }, scene);
      d.rotation.x = Math.PI / 2;
      d.material = this.dotMat;
      d.isPickable = false;
      d.setEnabled(false);
      this.dots.push(d);
    }

    this.head = MeshBuilder.CreateDisc("aim-head", { radius: 0.24, tessellation: 3 }, scene);
    this.head.rotation.x = Math.PI / 2;
    this.head.material = this.dotMat;
    this.head.isPickable = false;
    this.head.setEnabled(false);

    input.onDragStart = () => {
      if (!this.armed) return;
      this.aiming = true;
    };
    input.onDragMove = (d) => {
      if (!this.armed || !this.aiming) return;
      this.readDrag(d);
      this.updateVisuals();
      this.onCharge?.(this.power01);
    };
    input.onDragEnd = (d) => {
      if (!this.armed || !this.aiming) return;
      this.aiming = false;
      this.readDrag(d);
      this.hideAim();
      if (d.normLength < L.minDrag) {
        this.onCharge?.(-1); // too small — cancel
        return;
      }
      this.armed = false;
      const speed = lerp(L.minPower, L.maxPower, Math.pow(this.power01, L.powerCurve));
      this.phys.launch(this.dirX, this.dirZ, speed);
      this.onLaunch?.(this.power01);
    };
  }

  /** Allow the next drag to launch the car. */
  arm(): void {
    this.armed = true;
    this.input.enabled = true;
  }

  disarm(): void {
    this.armed = false;
    this.aiming = false;
    this.hideAim();
  }

  get isAiming(): boolean {
    return this.aiming;
  }

  private readDrag(d: DragState): void {
    // slingshot: launch opposite the drag; screen down (+y) = world -Z
    const wx = -d.normDragX;
    const wz = d.normDragY;
    const len = Math.hypot(wx, wz);
    if (len > 0.005) {
      this.dirX = wx / len;
      this.dirZ = wz / len;
    }
    this.power01 = clamp((d.normLength - L.minDrag) / (L.maxDrag - L.minDrag), 0, 1);
  }

  private updateVisuals(): void {
    const px = this.phys.pos.x;
    const pz = this.phys.pos.z;
    const valid = this.power01 > 0;
    const reach = lerp(1.2, L.aimDotSpacing * L.aimDotCount, this.power01);

    // green → yellow → red with power
    const t = this.power01;
    this.dotMat.emissiveColor.set(lerp(0.45, 1, t), lerp(0.95, 0.35, Math.max(0, t - 0.5) * 2), 0.25);

    for (let i = 0; i < this.dots.length; i++) {
      const dot = this.dots[i];
      const f = (i + 1) / (this.dots.length + 1);
      if (!valid || f * reach < 0.7) {
        dot.setEnabled(false);
        continue;
      }
      dot.setEnabled(true);
      dot.position.set(px + this.dirX * f * reach, 0.06, pz + this.dirZ * f * reach);
      const s = lerp(1.15, 0.55, f);
      dot.scaling.set(s, s, s);
    }

    this.head.setEnabled(valid);
    if (valid) {
      this.head.position.set(px + this.dirX * reach, 0.07, pz + this.dirZ * reach);
      this.head.rotation.y = Math.atan2(this.dirX, this.dirZ) + Math.PI / 6; // triangle disc points along +dir
    }
  }

  hideAim(): void {
    for (const d of this.dots) d.setEnabled(false);
    this.head.setEnabled(false);
  }
}
