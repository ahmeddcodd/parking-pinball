import type { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { CarSkin } from "../data/cars";
import type { ArcadePhysics } from "./ArcadePhysics";
import type { SharedMaterials } from "../objects/Materials";
import { TUNING } from "../data/tuning";
import { clamp, damp, dampAngle, lerp } from "../utils/MathUtils";

const WHEEL_RADIUS = 0.17;

/**
 * The visible toy car. Physics drives a point + velocity; this class
 * gives it a body and the juice: squash while charging, stretch on
 * launch, thump on landing, wheels that actually spin.
 *
 * Build (facing +Z): dark skirt, glossy body, chrome-ish bumper bars,
 * tinted glass canopy under an accent roof, emissive head/tail lights,
 * four wheels on pivots (tire + hub) that roll with ground speed.
 */
export class CarController {
  readonly root: TransformNode;
  yaw = 0;

  private shadow: Mesh;
  private bodyMat: StandardMaterial;
  private roofMat: StandardMaterial;
  private carScale: TransformNode;
  private wheels: TransformNode[] = [];
  private wheelSpin = 0;

  private charge = 0; // 0..1 while aiming
  private stretchPulse = 0; // >0 right after launch
  private squashPulse = 0; // >0 right after landing

  // falling-into-a-hole animation
  private falling = false;
  private fallT = 0;
  private fallSpinX = 0;
  private fallSpinY = 0;
  private fallTiltDir = 1;
  private prevVelX = 0;
  private prevVelZ = 0;
  private roll = 0;
  private pitch = 0;

  constructor(
    private scene: Scene,
    mats: SharedMaterials
  ) {
    this.root = new TransformNode("car-root", scene);
    this.carScale = new TransformNode("car-scale", scene);
    this.carScale.parent = this.root;

    this.bodyMat = new StandardMaterial("car-body-mat", scene);
    this.bodyMat.specularColor = new Color3(0.55, 0.55, 0.6);
    this.bodyMat.specularPower = 28;
    this.roofMat = new StandardMaterial("car-roof-mat", scene);
    this.roofMat.specularColor = new Color3(0.4, 0.4, 0.45);

    this.buildMeshes(mats);

    // fake blob shadow — cheap and mobile-friendly
    this.shadow = MeshBuilder.CreateDisc("car-shadow", { radius: 0.68, tessellation: 22 }, scene);
    this.shadow.rotation.x = Math.PI / 2;
    const shadowMat = new StandardMaterial("car-shadow-mat", scene);
    shadowMat.diffuseColor = Color3.Black();
    shadowMat.specularColor = Color3.Black();
    shadowMat.alpha = 0.25;
    shadowMat.disableLighting = true;
    shadowMat.emissiveColor = new Color3(0.02, 0.03, 0.05);
    this.shadow.material = shadowMat;
    this.shadow.isPickable = false;
  }

  private buildMeshes(mats: SharedMaterials): void {
    const s = this.scene;
    const parts: Mesh[] = [];

    const skirtMat = new StandardMaterial("car-skirt-mat", s);
    skirtMat.diffuseColor = new Color3(0.16, 0.18, 0.24);
    skirtMat.specularColor = new Color3(0.1, 0.1, 0.1);

    const tireMat = new StandardMaterial("car-tire-mat", s);
    tireMat.diffuseColor = new Color3(0.13, 0.14, 0.18);
    tireMat.specularColor = new Color3(0.12, 0.12, 0.12);

    const hubMat = new StandardMaterial("car-hub-mat", s);
    hubMat.diffuseColor = new Color3(0.82, 0.85, 0.92);
    hubMat.specularColor = new Color3(0.5, 0.5, 0.5);

    const headMat = new StandardMaterial("car-head-mat", s);
    headMat.diffuseColor = new Color3(1, 0.95, 0.65);
    headMat.emissiveColor = new Color3(0.85, 0.78, 0.35);

    const tailMat = new StandardMaterial("car-tail-mat", s);
    tailMat.diffuseColor = new Color3(1, 0.3, 0.3);
    tailMat.emissiveColor = new Color3(0.7, 0.12, 0.12);

    // dark underbody skirt
    const skirt = MeshBuilder.CreateBox("car-skirt", { width: 0.68, height: 0.14, depth: 1.14 }, s);
    skirt.position.y = 0.18;
    skirt.material = skirtMat;
    parts.push(skirt);

    // main body
    const body = MeshBuilder.CreateBox("car-body", { width: 0.76, height: 0.26, depth: 1.3 }, s);
    body.position.y = 0.34;
    body.material = this.bodyMat;
    parts.push(body);

    // hood + trunk steps (adds silhouette without more polys than boxes)
    const hood = MeshBuilder.CreateBox("car-hood", { width: 0.7, height: 0.09, depth: 0.34 }, s);
    hood.position.set(0, 0.5, 0.42);
    hood.material = this.bodyMat;
    parts.push(hood);
    const trunk = MeshBuilder.CreateBox("car-trunk", { width: 0.7, height: 0.07, depth: 0.22 }, s);
    trunk.position.set(0, 0.49, -0.5);
    trunk.material = this.bodyMat;
    parts.push(trunk);

    // glass canopy + accent roof
    const glass = MeshBuilder.CreateBox("car-glass", { width: 0.6, height: 0.2, depth: 0.6 }, s);
    glass.position.set(0, 0.56, -0.06);
    glass.material = mats.glass;
    parts.push(glass);
    const roof = MeshBuilder.CreateBox("car-roof", { width: 0.56, height: 0.09, depth: 0.5 }, s);
    roof.position.set(0, 0.7, -0.06);
    roof.material = this.roofMat;
    parts.push(roof);

    // chrome-ish bumper bars
    const frontBar = MeshBuilder.CreateBox("car-bumper-f", { width: 0.78, height: 0.12, depth: 0.1 }, s);
    frontBar.position.set(0, 0.24, 0.66);
    frontBar.material = mats.trim;
    parts.push(frontBar);
    const rearBar = MeshBuilder.CreateBox("car-bumper-r", { width: 0.78, height: 0.12, depth: 0.1 }, s);
    rearBar.position.set(0, 0.24, -0.66);
    rearBar.material = mats.trim;
    parts.push(rearBar);

    // lights
    const mkLamp = (name: string, mat: StandardMaterial, x: number, z: number): void => {
      const lamp = MeshBuilder.CreateBox(name, { width: 0.15, height: 0.09, depth: 0.05 }, s);
      lamp.position.set(x, 0.38, z);
      lamp.material = mat;
      parts.push(lamp);
    };
    mkLamp("car-head-l", headMat, 0.22, 0.66);
    mkLamp("car-head-r", headMat, -0.22, 0.66);
    mkLamp("car-tail-l", tailMat, 0.22, -0.66);
    mkLamp("car-tail-r", tailMat, -0.22, -0.66);

    // wheels: pivot (spins on X) → tire + hub
    const wheelPos: Array<[number, number]> = [
      [0.4, 0.42],
      [-0.4, 0.42],
      [0.4, -0.42],
      [-0.4, -0.42],
    ];
    for (const [x, z] of wheelPos) {
      const pivot = new TransformNode("car-wheel-pivot", s);
      pivot.position.set(x, WHEEL_RADIUS, z);
      pivot.parent = this.carScale;
      const tire = MeshBuilder.CreateCylinder("car-tire", { diameter: WHEEL_RADIUS * 2, height: 0.15, tessellation: 14 }, s);
      tire.rotation.z = Math.PI / 2;
      tire.material = tireMat;
      tire.parent = pivot;
      tire.isPickable = false;
      const hub = MeshBuilder.CreateCylinder("car-hub", { diameter: 0.17, height: 0.16, tessellation: 10 }, s);
      hub.rotation.z = Math.PI / 2;
      hub.material = hubMat;
      hub.parent = pivot;
      hub.isPickable = false;
      this.wheels.push(pivot);
    }

    for (const p of parts) {
      p.parent = this.carScale;
      p.isPickable = false;
    }
  }

  setSkin(skin: CarSkin): void {
    this.bodyMat.diffuseColor = Color3.FromHexString(skin.body);
    this.roofMat.diffuseColor = Color3.FromHexString(skin.accent);
  }

  /** 0..1 while the player is pulling back. */
  setCharge(power: number): void {
    this.charge = clamp(power, 0, 1);
  }

  pulseLaunch(): void {
    this.charge = 0;
    this.stretchPulse = 1;
  }

  pulseLand(): void {
    this.squashPulse = 1;
  }

  /** The car has been swallowed by a hole: tumble in and shrink away. */
  startFalling(): void {
    if (this.falling) return;
    this.falling = true;
    this.fallT = 0;
    this.charge = 0;
    // random tumble so no two falls look the same
    this.fallSpinX = 3.4 + Math.random() * 2.6;
    this.fallSpinY = (Math.random() < 0.5 ? -1 : 1) * (2.2 + Math.random() * 2.4);
    this.fallTiltDir = Math.random() < 0.5 ? -1 : 1;
  }

  place(x: number, z: number, yaw: number): void {
    this.root.position.set(x, 0, z);
    this.yaw = yaw;
    this.root.rotation.set(0, yaw, 0);
    this.roll = 0;
    this.pitch = 0;
    // clear the fall animation so a retry starts on a clean, full-size car
    this.falling = false;
    this.fallT = 0;
    this.carScale.scaling.set(1, 1, 1);
    this.shadow.visibility = 1;
    this.shadow.position.set(x, 0.02, z);
  }

  update(phys: ArcadePhysics, dt: number): void {
    const speed = phys.speed;

    // follow the physics point
    this.root.position.set(phys.pos.x, phys.pos.y, phys.pos.z);

    // Falling into a pit overrides the normal orientation: the car noses in,
    // tumbles, and shrinks with depth so it reads as dropping away rather
    // than sinking through the floor.
    if (this.falling) {
      this.fallT += dt;
      this.root.rotation.set(
        this.pitch - this.fallSpinX * this.fallT,
        this.yaw + this.fallSpinY * this.fallT,
        this.roll + this.fallTiltDir * Math.min(this.fallT * 2.2, 0.8)
      );
      const shrink = clamp(1 - this.fallT * 0.75, 0.25, 1);
      this.carScale.scaling.set(shrink, shrink, shrink);
      this.shadow.visibility = 0;
      return;
    }

    // face direction of travel
    if (speed > 0.6) {
      const targetYaw = Math.atan2(phys.vel.x, phys.vel.z);
      this.yaw = dampAngle(this.yaw, targetYaw, TUNING.physics.headingTurnRate, dt);
    }

    // wheels roll with ground speed (sign = forward/backward motion)
    const fwd = phys.vel.x * Math.sin(this.yaw) + phys.vel.z * Math.cos(this.yaw);
    this.wheelSpin += (fwd / WHEEL_RADIUS) * dt;
    for (const w of this.wheels) w.rotation.x = this.wheelSpin;

    // body lean from lateral acceleration, nose pitch from jumps
    const ax = (phys.vel.x - this.prevVelX) / Math.max(dt, 1e-4);
    const az = (phys.vel.z - this.prevVelZ) / Math.max(dt, 1e-4);
    this.prevVelX = phys.vel.x;
    this.prevVelZ = phys.vel.z;
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);
    const lateral = ax * rightX + az * rightZ;
    this.roll = damp(this.roll, clamp(-lateral * 0.012, -0.28, 0.28), 8, dt);
    const targetPitch = phys.airborne ? clamp(-phys.vel.y * 0.045, -0.4, 0.35) : 0;
    this.pitch = damp(this.pitch, targetPitch, 7, dt);
    this.root.rotation.set(this.pitch, this.yaw, this.roll);

    // squash & stretch
    this.stretchPulse = Math.max(0, this.stretchPulse - dt * 4);
    this.squashPulse = Math.max(0, this.squashPulse - dt * 5);
    const squash = this.charge * 0.2 + this.squashPulse * 0.24;
    const stretch = this.stretchPulse * 0.22;
    this.carScale.scaling.set(1 + squash * 0.5 - stretch * 0.3, 1 - squash + stretch, 1 + squash * 0.35 + stretch * 0.5);

    // blob shadow stays on the lot and shrinks with height
    this.shadow.position.set(phys.pos.x, 0.02, phys.pos.z);
    const h = clamp(phys.pos.y, 0, 4);
    const sc = lerp(1, 0.55, h / 4);
    this.shadow.scaling.set(sc, sc, sc);
    this.shadow.visibility = phys.pos.y < -0.5 ? 0 : lerp(1, 0.35, h / 4);
  }

  setVisible(v: boolean): void {
    this.root.setEnabled(v);
    this.shadow.setEnabled(v);
  }
}
