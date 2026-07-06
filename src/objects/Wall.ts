import type { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { ArcadePhysics, WallCollider } from "../gameplay/ArcadePhysics";
import { TUNING } from "../data/tuning";
import { degToRad } from "../utils/MathUtils";

/** Static box obstacle. Mesh + one collider entry, nothing dynamic. */
export class Wall {
  readonly mesh: Mesh;
  private collider: WallCollider;

  constructor(
    scene: Scene,
    phys: ArcadePhysics,
    material: StandardMaterial,
    x: number,
    z: number,
    w: number,
    d: number,
    rotDeg = 0,
    h = 0.6
  ) {
    this.mesh = MeshBuilder.CreateBox("wall", { width: w, height: h, depth: d }, scene);
    this.mesh.position.set(x, h / 2, z);
    this.mesh.rotation.y = degToRad(rotDeg);
    this.mesh.material = material;
    this.mesh.isPickable = false;

    const rot = degToRad(rotDeg);
    this.collider = {
      x,
      z,
      halfW: w / 2,
      halfD: d / 2,
      cos: Math.cos(rot),
      sin: Math.sin(rot),
      height: h,
      restitution: TUNING.physics.wallRestitution,
      ref: this,
    };
    phys.walls.push(this.collider);
  }

  dispose(): void {
    this.mesh.dispose();
  }
}
