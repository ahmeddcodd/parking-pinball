import type { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { ArcadePhysics } from "./ArcadePhysics";
import type { SpotData } from "../data/levels";
import { TUNING } from "../data/tuning";
import { alignmentError, clamp, degToRad, radToDeg } from "../utils/MathUtils";

const PK = TUNING.parking;

export interface ParkCheck {
  inside: boolean;
  dwellDone: boolean;
  centerDist: number;
  alignDeg: number;
  fullyInside: boolean;
}

/**
 * Painted parking bay. Trigger-only — checks the car's position, speed,
 * alignment and dwell time, and applies the invisible "magnet" assist
 * that makes near-misses settle in without feeling like cheating.
 */
export class ParkingSpot {
  readonly root: TransformNode;
  readonly x: number;
  readonly z: number;
  readonly rotation: number; // radians
  readonly halfW: number;
  readonly halfL: number;
  readonly isDecoy: boolean;

  private dwell = 0;
  private fill: ReturnType<typeof MeshBuilder.CreateGround>;
  private fillMat: StandardMaterial;
  private pulseT = 0;
  private celebrating = false;

  constructor(scene: Scene, data: SpotData, isDecoy = false) {
    this.x = data.x;
    this.z = data.z;
    this.rotation = degToRad(data.rotation);
    this.halfW = data.width / 2;
    this.halfL = data.length / 2;
    this.isDecoy = isDecoy;

    this.root = new TransformNode(isDecoy ? "decoy-spot" : "parking-spot", scene);
    this.root.position.set(this.x, 0, this.z);
    this.root.rotation.y = this.rotation;

    const lineColor = isDecoy ? new Color3(0.62, 0.66, 0.72) : new Color3(1, 1, 1);
    const lineMat = new StandardMaterial(isDecoy ? "decoy-line-mat" : "spot-line-mat", scene);
    lineMat.diffuseColor = lineColor;
    lineMat.emissiveColor = lineColor.scale(isDecoy ? 0.25 : 0.45);
    lineMat.specularColor = Color3.Black();

    // painted lines: two sides + back bar
    const lineW = 0.14;
    const mk = (name: string, w: number, d: number, x: number, z: number) => {
      const m = MeshBuilder.CreateGround(name, { width: w, height: d }, scene);
      m.position.set(x, 0.02, z);
      m.material = lineMat;
      m.parent = this.root;
      m.isPickable = false;
      return m;
    };
    mk("spot-l", lineW, this.halfL * 2, -this.halfW, 0);
    mk("spot-r", lineW, this.halfL * 2, this.halfW, 0);
    mk("spot-b", this.halfW * 2 + lineW, lineW, 0, this.halfL);

    // glowing fill
    this.fill = MeshBuilder.CreateGround(
      "spot-fill",
      { width: this.halfW * 2 - 0.15, height: this.halfL * 2 - 0.15 },
      scene
    );
    this.fill.position.y = 0.015;
    this.fill.parent = this.root;
    this.fill.isPickable = false;
    this.fillMat = new StandardMaterial("spot-fill-mat", scene);
    this.fillMat.diffuseColor = Color3.Black();
    this.fillMat.specularColor = Color3.Black();
    this.fillMat.emissiveColor = isDecoy ? new Color3(0.35, 0.37, 0.4) : new Color3(0.25, 0.85, 0.4);
    this.fillMat.alpha = isDecoy ? 0.16 : 0.3;
    this.fillMat.disableLighting = true;
    this.fill.material = this.fillMat;

    // "P" marker: simple bright bar pair reads well from iso view
    if (!isDecoy) {
      const pMat = new StandardMaterial("spot-p-mat", scene);
      pMat.emissiveColor = new Color3(1, 1, 1);
      pMat.diffuseColor = Color3.Black();
      pMat.specularColor = Color3.Black();
      pMat.disableLighting = true;
      pMat.alpha = 0.85;
      const bar = MeshBuilder.CreateGround("spot-p1", { width: 0.16, height: 1.0 }, scene);
      bar.position.set(-0.18, 0.025, 0);
      bar.material = pMat;
      bar.parent = this.root;
      const bowl = MeshBuilder.CreateGround("spot-p2", { width: 0.42, height: 0.5 }, scene);
      bowl.position.set(0.08, 0.025, 0.25);
      bowl.material = pMat;
      bowl.parent = this.root;
      bar.isPickable = bowl.isPickable = false;
    }
  }

  resetAttempt(): void {
    this.dwell = 0;
    this.celebrating = false;
  }

  /**
   * Per-frame check + assist. Returns the current parking status.
   */
  update(phys: ArcadePhysics, carYaw: number, dt: number): ParkCheck {
    // car position in spot-local space
    const dx = phys.pos.x - this.x;
    const dz = phys.pos.z - this.z;
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;

    const inside =
      Math.abs(lx) < this.halfW * PK.insideInset && Math.abs(lz) < this.halfL * PK.insideInset && phys.pos.y < 0.3;
    const centerDist = Math.hypot(lx, lz);
    const r = TUNING.physics.carRadius;
    const fullyInside = Math.abs(lx) < this.halfW - r * 0.8 && Math.abs(lz) < this.halfL - r * 0.4;

    const speed = phys.speed;

    // parking assist (real target only): brake hard on a fast entry,
    // then a critically-damped spring glides the car to the bay center
    if (!this.isDecoy && inside && !phys.airborne) {
      if (speed >= PK.magnetMaxSpeed) {
        phys.extraDamping = Math.max(phys.extraDamping, clamp(PK.entryBrake, 0, 0.9));
      } else {
        phys.assistForce.x = (this.x - phys.pos.x) * PK.magnetK - phys.vel.x * PK.magnetC;
        phys.assistForce.z = (this.z - phys.pos.z) * PK.magnetK - phys.vel.z * PK.magnetC;
      }
    }

    if (inside && speed < PK.maxParkSpeed && !phys.airborne) {
      this.dwell += dt;
    } else {
      this.dwell = 0;
    }

    // visual pulse
    this.pulseT += dt;
    if (!this.celebrating) {
      const base = this.isDecoy ? 0.16 : 0.26;
      const boost = !this.isDecoy && inside ? 0.25 : 0;
      this.fillMat.alpha = base + boost + Math.sin(this.pulseT * 3) * 0.06;
    }

    return {
      inside,
      dwellDone: this.dwell >= PK.dwellTime,
      centerDist,
      alignDeg: radToDeg(alignmentError(carYaw, this.rotation)),
      fullyInside,
    };
  }

  celebrate(perfect: boolean): void {
    this.celebrating = true;
    this.fillMat.emissiveColor = perfect ? new Color3(1, 0.85, 0.2) : new Color3(0.3, 1, 0.45);
    this.fillMat.alpha = 0.75;
  }

  dispose(): void {
    this.root.dispose(false, true);
  }
}
