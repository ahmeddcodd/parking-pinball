import type { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";

/**
 * One shared StandardMaterial per object family — created once,
 * reused by every instance (draw-call and memory friendly).
 */
export class SharedMaterials {
  readonly ground: StandardMaterial;
  readonly groundLines: StandardMaterial;
  readonly wall: StandardMaterial;
  readonly border: StandardMaterial;
  readonly bumper: StandardMaterial;
  readonly bumperTop: StandardMaterial;
  readonly coin: StandardMaterial;
  readonly hazard: StandardMaterial;
  readonly ramp: StandardMaterial;
  readonly rampStripe: StandardMaterial;
  readonly cone: StandardMaterial;

  constructor(scene: Scene) {
    const mk = (name: string, hex: string, emissive = 0, specular = 0.08): StandardMaterial => {
      const m = new StandardMaterial(name, scene);
      const c = Color3.FromHexString(hex);
      m.diffuseColor = c;
      m.specularColor = new Color3(specular, specular, specular);
      if (emissive > 0) m.emissiveColor = c.scale(emissive);
      return m;
    };

    this.ground = mk("mat-ground", "#8d9db6");
    this.groundLines = mk("mat-ground-lines", "#f5f7fa", 0.35);
    this.wall = mk("mat-wall", "#f0a13c", 0.08);
    this.border = mk("mat-border", "#e8edf4", 0.05);
    this.bumper = mk("mat-bumper", "#ff5e7a", 0.15, 0.3);
    this.bumperTop = mk("mat-bumper-top", "#ffd1da", 0.45, 0.3);
    this.coin = mk("mat-coin", "#ffcf3f", 0.55, 0.5);
    this.hazard = mk("mat-hazard", "#2c2f38", 0, 0.5);
    this.ramp = mk("mat-ramp", "#55c8f5", 0.1);
    this.rampStripe = mk("mat-ramp-stripe", "#ffffff", 0.4);
    this.cone = mk("mat-cone", "#ff7a3c", 0.12);
  }

  setGroundColor(hex: string): void {
    this.ground.diffuseColor = Color3.FromHexString(hex);
  }
}
