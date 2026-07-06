import type { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { SharedMaterials } from "./Materials";
import type { ArcadePhysics, BumperCollider } from "../gameplay/ArcadePhysics";
import { TUNING } from "../data/tuning";

/**
 * Chunky pinball bumper: pink drum, white rubber ring, glossy cap.
 * The physics kick lives in ArcadePhysics; this owns the mesh and the
 * hit flash/pop animation (per-bumper material clone so each one can
 * flash independently).
 */
export class Bumper {
  readonly x: number;
  readonly z: number;

  private base: Mesh;
  private ring: Mesh;
  private top: Mesh;
  private topMat: StandardMaterial;
  private flash = 0;

  constructor(scene: Scene, phys: ArcadePhysics, mats: SharedMaterials, x: number, z: number, radius?: number, force?: number) {
    this.x = x;
    this.z = z;
    const r = radius ?? TUNING.bumper.defaultRadius;

    this.base = MeshBuilder.CreateCylinder("bumper", { diameter: r * 2, height: 0.5, tessellation: 22 }, scene);
    this.base.position.set(x, 0.25, z);
    this.base.material = mats.bumper;
    this.base.isPickable = false;

    this.ring = MeshBuilder.CreateTorus("bumper-ring", { diameter: r * 2, thickness: 0.16, tessellation: 22 }, scene);
    this.ring.position.set(x, 0.5, z);
    this.ring.material = mats.bumperRing;
    this.ring.isPickable = false;

    this.top = MeshBuilder.CreateCylinder("bumper-top", { diameter: r * 1.35, height: 0.14, tessellation: 22 }, scene);
    this.top.position.set(x, 0.6, z);
    this.topMat = mats.bumper.clone("bumper-top-mat");
    this.topMat.diffuseColor = Color3.FromHexString("#ffd1da");
    this.topMat.emissiveColor = Color3.FromHexString("#ffd1da").scale(0.35);
    this.top.material = this.topMat;
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
    const pop = 1 + this.flash * 0.3;
    this.base.scaling.set(pop, 1 - this.flash * 0.18, pop);
    this.ring.scaling.set(pop * 1.06, 1, pop * 1.06);
    this.top.scaling.set(pop * 1.1, 1, pop * 1.1);
    this.top.position.y = 0.6 + this.flash * 0.14;
    // white-hot flash that cools back down
    this.topMat.emissiveColor.set(0.35 + this.flash * 0.65, 0.35 + this.flash * 0.5, 0.35 + this.flash * 0.45);
  }

  dispose(): void {
    this.base.dispose();
    this.ring.dispose();
    this.top.dispose();
    this.topMat.dispose();
  }
}
