import type { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { SharedMaterials } from "./Materials";
import type { ArcadePhysics } from "../gameplay/ArcadePhysics";

/**
 * Oil slick — touch it and the attempt ends. Pure trigger circle with
 * a flat dark puddle mesh (irregular scaling so no two look identical).
 */
export class Hazard {
  readonly mesh: Mesh;
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  triggered = false;

  constructor(scene: Scene, mats: SharedMaterials, x: number, z: number, radius = 1.2) {
    this.x = x;
    this.z = z;
    this.radius = radius;

    this.mesh = MeshBuilder.CreateDisc("hazard", { radius, tessellation: 14 }, scene);
    this.mesh.rotation.x = Math.PI / 2;
    this.mesh.rotation.y = Math.random() * Math.PI;
    this.mesh.position.set(x, 0.025, z);
    this.mesh.scaling.set(1, 0.82 + Math.random() * 0.2, 1);
    this.mesh.material = mats.hazard;
    this.mesh.isPickable = false;
  }

  resetAttempt(): void {
    this.triggered = false;
  }

  /** True exactly once, when the car first touches the slick. */
  check(phys: ArcadePhysics): boolean {
    if (this.triggered || phys.airborne || phys.pos.y > 0.3) return false;
    const dx = phys.pos.x - this.x;
    const dz = phys.pos.z - this.z;
    const r = this.radius * 0.85; // a touch forgiving
    if (dx * dx + dz * dz > r * r) return false;
    this.triggered = true;
    return true;
  }

  dispose(): void {
    this.mesh.dispose();
  }
}
