import type { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { CarSkin } from "../data/cars";
import type { ArcadePhysics } from "./ArcadePhysics";
import { TUNING } from "../data/tuning";
import { clamp, damp, dampAngle, lerp } from "../utils/MathUtils";

/**
 * The visible toy car. Physics drives a point + velocity; this class
 * gives it a body, turns it to face its motion, and adds the juice:
 * squash while charging, stretch on launch, thump on landing.
 */
export class CarController {
  readonly root: TransformNode;
  yaw = 0;

  private body!: Mesh;
  private cabin!: Mesh;
  private shadow: Mesh;
  private bodyMat: StandardMaterial;
  private cabinMat: StandardMaterial;
  private carScale: TransformNode;

  private charge = 0; // 0..1 while aiming
  private stretchPulse = 0; // >0 right after launch
  private squashPulse = 0; // >0 right after landing
  private prevVelX = 0;
  private prevVelZ = 0;
  private roll = 0;
  private pitch = 0;

  constructor(private scene: Scene) {
    this.root = new TransformNode("car-root", scene);
    this.carScale = new TransformNode("car-scale", scene);
    this.carScale.parent = this.root;

    this.bodyMat = new StandardMaterial("car-body-mat", scene);
    this.bodyMat.specularColor = new Color3(0.35, 0.35, 0.35);
    this.cabinMat = new StandardMaterial("car-cabin-mat", scene);
    this.cabinMat.specularColor = new Color3(0.4, 0.4, 0.45);

    this.buildMeshes();

    // fake blob shadow — cheap and mobile-friendly
    this.shadow = MeshBuilder.CreateDisc("car-shadow", { radius: 0.62, tessellation: 20 }, scene);
    this.shadow.rotation.x = Math.PI / 2;
    const shadowMat = new StandardMaterial("car-shadow-mat", scene);
    shadowMat.diffuseColor = Color3.Black();
    shadowMat.specularColor = Color3.Black();
    shadowMat.alpha = 0.28;
    shadowMat.disableLighting = true;
    shadowMat.emissiveColor = new Color3(0.02, 0.03, 0.05);
    this.shadow.material = shadowMat;
    this.shadow.isPickable = false;
  }

  private buildMeshes(): void {
    const s = this.scene;

    this.body = MeshBuilder.CreateBox("car-body", { width: 0.72, height: 0.3, depth: 1.15 }, s);
    this.body.position.y = 0.3;
    this.body.material = this.bodyMat;

    this.cabin = MeshBuilder.CreateBox("car-cabin", { width: 0.6, height: 0.26, depth: 0.55 }, s);
    this.cabin.position.set(0, 0.55, -0.08);
    this.cabin.material = this.cabinMat;

    const wheelMat = new StandardMaterial("car-wheel-mat", s);
    wheelMat.diffuseColor = new Color3(0.13, 0.14, 0.18);
    wheelMat.specularColor = new Color3(0.1, 0.1, 0.1);

    const lightMat = new StandardMaterial("car-light-mat", s);
    lightMat.diffuseColor = new Color3(1, 0.95, 0.6);
    lightMat.emissiveColor = new Color3(0.7, 0.62, 0.25);

    const wheelProto = MeshBuilder.CreateCylinder("car-wheel", { diameter: 0.34, height: 0.14, tessellation: 12 }, s);
    wheelProto.rotation.z = Math.PI / 2;
    wheelProto.material = wheelMat;
    wheelProto.position.set(-0.38, 0.17, 0.36);
    const wheelPositions: Array<[number, number]> = [
      [0.38, 0.36],
      [-0.38, -0.36],
      [0.38, -0.36],
    ];
    const parts: Mesh[] = [this.body, this.cabin, wheelProto];
    for (const [x, z] of wheelPositions) {
      const w = wheelProto.clone("car-wheel-c");
      w.position.set(x, 0.17, z);
      parts.push(w);
    }

    const lightProto = MeshBuilder.CreateBox("car-lamp", { width: 0.14, height: 0.1, depth: 0.06 }, s);
    lightProto.material = lightMat;
    lightProto.position.set(0.2, 0.32, 0.58);
    const lamp2 = lightProto.clone("car-lamp-2");
    lamp2.position.x = -0.2;
    parts.push(lightProto, lamp2);

    for (const p of parts) {
      p.parent = this.carScale;
      p.isPickable = false;
    }
  }

  setSkin(skin: CarSkin): void {
    this.bodyMat.diffuseColor = Color3.FromHexString(skin.body);
    this.cabinMat.diffuseColor = Color3.FromHexString(skin.accent);
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

  place(x: number, z: number, yaw: number): void {
    this.root.position.set(x, 0, z);
    this.yaw = yaw;
    this.root.rotation.set(0, yaw, 0);
    this.roll = 0;
    this.pitch = 0;
    this.shadow.position.set(x, 0.02, z);
  }

  update(phys: ArcadePhysics, dt: number): void {
    const speed = phys.speed;

    // follow the physics point
    this.root.position.set(phys.pos.x, phys.pos.y, phys.pos.z);

    // face direction of travel
    if (speed > 0.6) {
      const targetYaw = Math.atan2(phys.vel.x, phys.vel.z);
      this.yaw = dampAngle(this.yaw, targetYaw, TUNING.physics.headingTurnRate, dt);
    }

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
