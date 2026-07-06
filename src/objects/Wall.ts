import type { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { ArcadePhysics, WallCollider } from "../gameplay/ArcadePhysics";
import { TUNING } from "../data/tuning";
import { degToRad } from "../utils/MathUtils";

/**
 * Static box obstacle: body + a lighter rounded-looking top cap so the
 * barrier reads as molded plastic. One collider entry, nothing dynamic.
 */
export class Wall {
  readonly mesh: Mesh;
  private cap: Mesh;

  constructor(
    scene: Scene,
    phys: ArcadePhysics,
    material: StandardMaterial,
    capMaterial: StandardMaterial,
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

    this.cap = MeshBuilder.CreateBox("wall-cap", { width: w + 0.06, height: 0.08, depth: d + 0.06 }, scene);
    this.cap.position.set(x, h + 0.04, z);
    this.cap.rotation.y = this.mesh.rotation.y;
    this.cap.material = capMaterial;
    this.cap.isPickable = false;

    const rot = degToRad(rotDeg);
    const collider: WallCollider = {
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
    phys.walls.push(collider);
  }

  dispose(): void {
    this.mesh.dispose();
    this.cap.dispose();
  }
}
