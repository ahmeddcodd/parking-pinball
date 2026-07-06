import type { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { SharedMaterials } from "./Materials";

/** Deterministic PRNG so each level always grows the same backdrop. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Decorative world around the lot: a grass "island" fading into the
 * sky, low-poly trees and bushes ringing the arena, drifting clouds.
 * Pure decoration — no physics, shared materials, ~40 tiny meshes.
 */
export class Scenery {
  private root: TransformNode;
  private clouds: Array<{ mesh: Mesh; baseX: number; speed: number; phase: number }> = [];
  private t = 0;

  constructor(scene: Scene, mats: SharedMaterials, levelId: number, arenaW: number, arenaD: number) {
    this.root = new TransformNode("scenery", scene);
    const rand = mulberry32(levelId * 7919 + 13);

    // grass island under everything
    const grass = MeshBuilder.CreateDisc("grass", { radius: Math.max(arenaW, arenaD) * 2.6, tessellation: 48 }, scene);
    grass.rotation.x = Math.PI / 2;
    grass.position.y = -0.42;
    grass.material = mats.grass;
    grass.parent = this.root;
    grass.isPickable = false;

    // tree/bush ring outside the arena
    const halfW = arenaW / 2;
    const halfD = arenaD / 2;
    const placed: Array<[number, number]> = [];
    const treeCount = 11;
    for (let i = 0; i < treeCount; i++) {
      // pick a point in a ring around the lot
      let x = 0;
      let z = 0;
      let ok = false;
      for (let tries = 0; tries < 12 && !ok; tries++) {
        const ang = rand() * Math.PI * 2;
        const dist = 2.2 + rand() * 5.5;
        x = Math.cos(ang) * (halfW + dist);
        z = Math.sin(ang) * (halfD + dist) * 0.92;
        ok = placed.every(([px, pz]) => Math.hypot(px - x, pz - z) > 2.4) && z < halfD + 6;
      }
      if (!ok) continue;
      placed.push([x, z]);
      const kind = rand();
      if (kind < 0.42) this.roundTree(scene, mats, x, z, 0.85 + rand() * 0.5, rand());
      else if (kind < 0.72) this.pineTree(scene, mats, x, z, 0.9 + rand() * 0.45);
      else this.bush(scene, mats, x, z, 0.5 + rand() * 0.4, rand());
    }

    // clouds
    const cloudCount = 4;
    for (let i = 0; i < cloudCount; i++) {
      const cloud = this.cloud(scene, mats, rand);
      const baseX = (rand() - 0.5) * arenaW * 2.4;
      cloud.position.set(baseX, 7 + rand() * 3.5, -2 + rand() * (halfD + 10));
      this.clouds.push({ mesh: cloud, baseX, speed: 0.18 + rand() * 0.2, phase: rand() * Math.PI * 2 });
    }
  }

  private roundTree(scene: Scene, mats: SharedMaterials, x: number, z: number, s: number, v: number): void {
    const trunk = MeshBuilder.CreateCylinder("trunk", { diameter: 0.24 * s, height: 0.7 * s, tessellation: 7 }, scene);
    trunk.position.set(x, 0.35 * s - 0.4, z);
    trunk.material = mats.treeTrunk;
    trunk.parent = this.root;
    const leaf = MeshBuilder.CreateSphere("leaf", { diameter: 1.5 * s, segments: 6 }, scene);
    leaf.position.set(x, 1.2 * s - 0.4, z);
    leaf.scaling.y = 0.92;
    leaf.material = v > 0.5 ? mats.treeLeaf : mats.treeLeafDark;
    leaf.parent = this.root;
    trunk.isPickable = leaf.isPickable = false;
  }

  private pineTree(scene: Scene, mats: SharedMaterials, x: number, z: number, s: number): void {
    const trunk = MeshBuilder.CreateCylinder("trunk", { diameter: 0.22 * s, height: 0.6 * s, tessellation: 7 }, scene);
    trunk.position.set(x, 0.3 * s - 0.4, z);
    trunk.material = mats.treeTrunk;
    trunk.parent = this.root;
    const cone = MeshBuilder.CreateCylinder(
      "pine",
      { diameterBottom: 1.25 * s, diameterTop: 0.05, height: 1.9 * s, tessellation: 8 },
      scene
    );
    cone.position.set(x, 1.45 * s - 0.4, z);
    cone.material = mats.treeLeafDark;
    cone.parent = this.root;
    trunk.isPickable = cone.isPickable = false;
  }

  private bush(scene: Scene, mats: SharedMaterials, x: number, z: number, s: number, v: number): void {
    const b = MeshBuilder.CreateSphere("bush", { diameter: 1.3 * s, segments: 5 }, scene);
    b.position.set(x, 0.3 * s - 0.4, z);
    b.scaling.y = 0.62;
    b.material = v > 0.5 ? mats.treeLeaf : mats.treeLeafDark;
    b.parent = this.root;
    b.isPickable = false;
  }

  private cloud(scene: Scene, mats: SharedMaterials, rand: () => number): Mesh {
    const core = MeshBuilder.CreateSphere("cloud", { diameter: 2.1, segments: 5 }, scene);
    core.scaling.y = 0.55;
    core.material = mats.cloud;
    core.parent = this.root;
    core.isPickable = false;
    const lobes = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < lobes; i++) {
      const lobe = MeshBuilder.CreateSphere("cloud-lobe", { diameter: 1.2 + rand() * 0.9, segments: 5 }, scene);
      lobe.scaling.y = 0.55;
      lobe.position.set((rand() - 0.5) * 2.4, (rand() - 0.35) * 0.4, (rand() - 0.5) * 0.7);
      lobe.material = mats.cloud;
      lobe.parent = core;
      lobe.isPickable = false;
    }
    return core;
  }

  update(dt: number): void {
    this.t += dt;
    for (const c of this.clouds) {
      c.mesh.position.x = c.baseX + Math.sin(this.t * c.speed + c.phase) * 2.2;
    }
  }

  dispose(): void {
    // materials are shared — dispose meshes only
    this.root.dispose();
  }
}
