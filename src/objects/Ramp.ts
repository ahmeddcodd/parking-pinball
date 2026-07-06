import type { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { SharedMaterials } from "./Materials";
import type { ArcadePhysics } from "../gameplay/ArcadePhysics";
import { TUNING } from "../data/tuning";
import { degToRad } from "../utils/MathUtils";

/**
 * Jump ramp. Visually a sloped pad; physically a trigger strip that
 * converts ground speed into a hop when the car crosses it fast enough
 * and roughly in the ramp's direction.
 */
export class Ramp {
  readonly root: TransformNode;
  onJump: (() => void) | null = null;

  private x: number;
  private z: number;
  private dirX: number;
  private dirZ: number;
  private halfW: number;
  private halfL: number;
  private cooldown = 0;

  constructor(
    scene: Scene,
    private phys: ArcadePhysics,
    mats: SharedMaterials,
    x: number,
    z: number,
    rotDeg = 0,
    w = 2.2,
    l = 2.0
  ) {
    this.x = x;
    this.z = z;
    const rot = degToRad(rotDeg);
    this.dirX = Math.sin(rot);
    this.dirZ = Math.cos(rot);
    this.halfW = w / 2;
    this.halfL = l / 2;

    this.root = new TransformNode("ramp", scene);
    this.root.position.set(x, 0, z);
    this.root.rotation.y = rot;

    // sloped face (a tilted box reads perfectly from the iso camera)
    const slope = MeshBuilder.CreateBox("ramp-slope", { width: w, height: 0.12, depth: l * 1.04 }, scene);
    slope.rotation.x = -Math.atan2(0.55, l);
    slope.position.set(0, 0.26, 0);
    slope.material = mats.ramp;
    slope.parent = this.root;
    slope.isPickable = false;

    // white chevron stripe
    const stripe = MeshBuilder.CreateBox("ramp-stripe", { width: w * 0.35, height: 0.125, depth: l * 0.5 }, scene);
    stripe.rotation.x = slope.rotation.x;
    stripe.position.set(0, 0.275, 0.1);
    stripe.material = mats.rampStripe;
    stripe.parent = this.root;
    stripe.isPickable = false;

    // back support
    const back = MeshBuilder.CreateBox("ramp-back", { width: w, height: 0.5, depth: 0.18 }, scene);
    back.position.set(0, 0.25, l / 2 - 0.06);
    back.material = mats.ramp;
    back.parent = this.root;
    back.isPickable = false;
  }

  resetAttempt(): void {
    this.cooldown = 0;
  }

  update(dt: number): void {
    if (this.cooldown > 0) this.cooldown -= dt;
    const phys = this.phys;
    if (phys.airborne || this.cooldown > 0) return;

    // car in ramp-local space
    const dx = phys.pos.x - this.x;
    const dz = phys.pos.z - this.z;
    // local axes: dir = "uphill" (+local z), right = perpendicular
    const lz = dx * this.dirX + dz * this.dirZ;
    const lx = dx * this.dirZ - dz * this.dirX;
    if (Math.abs(lx) > this.halfW || Math.abs(lz) > this.halfL) return;

    // must be moving up the ramp fast enough
    const along = phys.vel.x * this.dirX + phys.vel.z * this.dirZ;
    if (along < TUNING.ramp.minSpeed) return;

    this.cooldown = 0.8;
    phys.launchAir();
    this.onJump?.();
  }

  dispose(): void {
    this.root.dispose(false, true);
  }
}
