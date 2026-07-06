import type { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { SharedMaterials } from "./Materials";
import type { ArcadePhysics, BumperCollider } from "../gameplay/ArcadePhysics";
import { TUNING } from "../data/tuning";

/**
 * Chunky pinball bumper. The physics kick lives in ArcadePhysics;
 * this owns the mesh and the hit flash/pop animation.
 */
export class Bumper {
  readonly base: Mesh;
  readonly top: Mesh;
  readonly x: number;
  readonly z: number;
  private flash = 0;

  constructor(scene: Scene, phys: ArcadePhysics, mats: SharedMaterials, x: number, z: number, radius?: number, force?: number) {
    this.x = x;
    this.z = z;
    const r = radius ?? TUNING.bumper.defaultRadius;

    this.base = MeshBuilder.CreateCylinder("bumper", { diameter: r * 2, height: 0.55, tessellation: 20 }, scene);
    this.base.position.set(x, 0.275, z);
    this.base.material = mats.bumper;
    this.base.isPickable = false;

    this.top = MeshBuilder.CreateCylinder("bumper-top", { diameter: r * 1.5, height: 0.16, tessellation: 20 }, scene);
    this.top.position.set(x, 0.62, z);
    this.top.material = mats.bumperTop;
    this.top.isPickable = false;

    const collider: BumperCollider = {
      x,
      z,
      radius: r,
      force: force ?? TUNING.bumper.defaultForce,
      cooldown: 0,
      ref: this,
    };
    phys.bumpers.push(collider);
  }

  hit(): void {
    this.flash = 1;
  }

  update(dt: number): void {
    if (this.flash <= 0) return;
    this.flash = Math.max(0, this.flash - dt * 4);
    const pop = 1 + this.flash * 0.28;
    this.base.scaling.set(pop, 1 - this.flash * 0.18, pop);
    this.top.scaling.set(pop * 1.08, 1, pop * 1.08);
    this.top.position.y = 0.62 + this.flash * 0.12;
  }

  dispose(): void {
    this.base.dispose();
    this.top.dispose();
  }
}
