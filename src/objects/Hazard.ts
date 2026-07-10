import type { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { SharedMaterials } from "./Materials";
import type { ArcadePhysics } from "../gameplay/ArcadePhysics";

/** How far down the pit is modelled. Deep enough that you never see a bottom. */
const DEPTH = 6;

/**
 * A hole punched clean through the lot. Drive over it and the car drops in —
 * there is no trigger involved: the pit removes ground from the physics, so
 * gravity and the existing out-of-bounds check do all the work. A car in the
 * air (off a ramp) sails straight over.
 *
 * Built as a rim ring + a dark shaft, so from the game's low camera you read
 * depth rather than a flat sticker.
 */
export class Hazard {
  readonly root: TransformNode;
  readonly x: number;
  readonly z: number;
  readonly radius: number;

  constructor(scene: Scene, mats: SharedMaterials, x: number, z: number, radius = 1.2) {
    this.x = x;
    this.z = z;
    this.radius = radius;

    this.root = new TransformNode("hole", scene);
    this.root.position.set(x, 0, z);

    // The lot is one opaque plane with no hole cut in it, so pit geometry
    // placed below ground is simply occluded by the road and the hole reads as
    // a painted ring. Rather than re-mesh the ground per level, the pit is
    // drawn in a later rendering group with depth-testing off: it always paints
    // over the asphalt, giving a true black void inside the rim. The falling
    // car (drawn in the default group) still disappears beneath the road.
    const mouth = MeshBuilder.CreateDisc("hole-floor", { radius: radius * 0.98, tessellation: 20 }, scene);
    mouth.rotation.x = Math.PI / 2;
    mouth.position.y = 0.01;
    mouth.material = mats.holeVoid;
    mouth.parent = this.root;
    mouth.isPickable = false;

    // Sunken shaft, seen from inside. Its near wall is hidden by backface
    // culling, so what shows through the mouth is the far wall — that's the
    // parallax that sells depth as the camera moves.
    const shaft = MeshBuilder.CreateCylinder(
      "hole-shaft",
      { diameter: radius * 2, height: DEPTH, tessellation: 20, sideOrientation: VertexData.BACKSIDE },
      scene
    );
    shaft.position.y = -DEPTH / 2;
    shaft.material = mats.holeWall;
    shaft.parent = this.root;
    shaft.isPickable = false;

    // rim: a thin torus so the lip catches the light and the edge is obvious
    const rim = MeshBuilder.CreateTorus(
      "hole-rim",
      { diameter: radius * 2, thickness: 0.12, tessellation: 20 },
      scene
    );
    rim.position.y = 0.02;
    rim.material = mats.holeRim;
    rim.parent = this.root;
    rim.isPickable = false;
  }

  /** Register the pit with physics; the ground is subtracted here. */
  addCollider(phys: ArcadePhysics): void {
    phys.holes.push({ x: this.x, z: this.z, radius: this.radius });
  }

  /** True while the car is falling inside this pit (for the fail message). */
  contains(phys: ArcadePhysics): boolean {
    const dx = phys.pos.x - this.x;
    const dz = phys.pos.z - this.z;
    return dx * dx + dz * dz < this.radius * this.radius;
  }

  dispose(): void {
    // materials are shared — dispose meshes only
    this.root.dispose();
  }
}
