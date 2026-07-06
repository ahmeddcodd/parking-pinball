import type { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { SharedMaterials } from "./Materials";
import type { ArcadePhysics } from "../gameplay/ArcadePhysics";

const PICKUP_RADIUS = 0.75;

/**
 * Spinning collectible. Pure trigger — on pickup it pops upward,
 * shrinks away and disables. `resetAttempt` brings it back so every
 * retry offers the full coin route again.
 */
export class Coin {
  readonly mesh: Mesh;
  readonly value: number;
  collected = false;

  private baseY = 0.55;
  private t = Math.random() * Math.PI * 2;
  private popT = -1; // >=0 while playing the collect animation

  constructor(scene: Scene, mats: SharedMaterials, private x: number, private z: number, value = 10) {
    this.value = value;
    this.mesh = MeshBuilder.CreateCylinder("coin", { diameter: 0.62, height: 0.09, tessellation: 16 }, scene);
    this.mesh.rotation.x = Math.PI / 2;
    this.mesh.position.set(x, this.baseY, z);
    this.mesh.material = mats.coin;
    this.mesh.isPickable = false;
  }

  resetAttempt(): void {
    this.collected = false;
    this.popT = -1;
    this.mesh.setEnabled(true);
    this.mesh.scaling.setAll(1);
    this.mesh.position.set(this.x, this.baseY, this.z);
  }

  /** Returns true exactly once, on the frame the car grabs it. */
  tryCollect(phys: ArcadePhysics): boolean {
    if (this.collected) return false;
    const dx = phys.pos.x - this.x;
    const dz = phys.pos.z - this.z;
    if (dx * dx + dz * dz > PICKUP_RADIUS * PICKUP_RADIUS) return false;
    if (phys.pos.y > 2.0) return false; // still collectible mid-jump
    this.collected = true;
    this.popT = 0;
    return true;
  }

  update(dt: number): void {
    if (this.collected) {
      if (this.popT >= 0) {
        this.popT += dt;
        const k = this.popT / 0.35;
        if (k >= 1) {
          this.popT = -1;
          this.mesh.setEnabled(false);
        } else {
          this.mesh.position.y = this.baseY + k * 1.6;
          const s = 1 - k;
          this.mesh.scaling.setAll(Math.max(0.01, s));
          this.mesh.rotation.y += dt * 20;
        }
      }
      return;
    }
    this.t += dt;
    this.mesh.rotation.y = this.t * 2.4;
    this.mesh.position.y = this.baseY + Math.sin(this.t * 2.2) * 0.07;
  }

  dispose(): void {
    this.mesh.dispose();
  }
}
