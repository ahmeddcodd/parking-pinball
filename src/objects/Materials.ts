import type { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";

/**
 * Shared materials + small procedural textures (asphalt speckle, grass
 * gradient, hazard stripes, soft glow). Everything is generated once at
 * startup — zero asset downloads, one material per object family.
 */
export class SharedMaterials {
  readonly ground: StandardMaterial;
  readonly curb: StandardMaterial;
  readonly grass: StandardMaterial;
  readonly wall: StandardMaterial;
  readonly wallCap: StandardMaterial;
  readonly border: StandardMaterial;
  readonly borderCap: StandardMaterial;
  readonly bumper: StandardMaterial;
  readonly bumperRing: StandardMaterial;
  readonly coin: StandardMaterial;
  readonly coinFace: StandardMaterial;
  readonly hazard: StandardMaterial;
  readonly ramp: StandardMaterial;
  readonly rampStripe: StandardMaterial;
  readonly rampBack: StandardMaterial;
  readonly cone: StandardMaterial;
  readonly coneBand: StandardMaterial;
  readonly treeTrunk: StandardMaterial;
  readonly treeLeaf: StandardMaterial;
  readonly treeLeafDark: StandardMaterial;
  readonly cloud: StandardMaterial;
  readonly glow: StandardMaterial;
  readonly glass: StandardMaterial;
  readonly trim: StandardMaterial;
  readonly asphaltTex: DynamicTexture;

  constructor(scene: Scene) {
    const mk = (name: string, hex: string, emissive = 0, specular = 0.08): StandardMaterial => {
      const m = new StandardMaterial(name, scene);
      const c = Color3.FromHexString(hex);
      m.diffuseColor = c;
      m.specularColor = new Color3(specular, specular, specular);
      if (emissive > 0) m.emissiveColor = c.scale(emissive);
      return m;
    };

    // asphalt: bright speckled grayscale texture tinted by diffuseColor
    this.ground = mk("mat-ground", "#98a5c0", 0.12);
    this.asphaltTex = this.makeAsphaltTexture(scene);
    this.ground.diffuseTexture = this.asphaltTex;
    this.ground.specularColor = new Color3(0.05, 0.05, 0.06);

    this.curb = mk("mat-curb", "#d6dce8", 0.06);
    this.grass = mk("mat-grass", "#ffffff");
    this.grass.diffuseTexture = this.makeGrassTexture(scene);
    this.grass.specularColor = Color3.Black();
    this.grass.emissiveColor = new Color3(0.25, 0.32, 0.2);

    this.wall = mk("mat-wall", "#f5a340", 0.1);
    this.wallCap = mk("mat-wall-cap", "#ffe8c7", 0.25);
    this.border = mk("mat-border", "#eef2f8", 0.08);
    this.borderCap = mk("mat-border-cap", "#ffffff", 0.2);

    this.bumper = mk("mat-bumper", "#ff5e7a", 0.16, 0.35);
    this.bumperRing = mk("mat-bumper-ring", "#ffffff", 0.3, 0.3);

    this.coin = mk("mat-coin", "#ffc93c", 0.5, 0.6);
    this.coinFace = mk("mat-coin-face", "#ffe066", 0.75, 0.4);
    this.coinFace.diffuseTexture = this.makeStarTexture(scene);
    this.coinFace.diffuseTexture.hasAlpha = true;
    this.coinFace.useAlphaFromDiffuseTexture = true;
    this.coinFace.backFaceCulling = false;

    this.hazard = mk("mat-hazard", "#23262f", 0, 0.9);
    this.hazard.specularPower = 24;
    this.hazard.emissiveColor = new Color3(0.05, 0.06, 0.1);

    this.ramp = mk("mat-ramp", "#4fb9ea", 0.12);
    this.rampStripe = mk("mat-ramp-stripe", "#ffffff", 0.45);
    this.rampBack = mk("mat-ramp-back", "#ffffff", 0.15);
    this.rampBack.diffuseTexture = this.makeStripesTexture(scene);

    this.cone = mk("mat-cone", "#ff7a3c", 0.15);
    this.coneBand = mk("mat-cone-band", "#ffffff", 0.35);

    this.treeTrunk = mk("mat-trunk", "#9a6b4f", 0.05);
    this.treeLeaf = mk("mat-leaf", "#6fce62", 0.08);
    this.treeLeafDark = mk("mat-leaf-dark", "#4bab55", 0.08);

    this.cloud = mk("mat-cloud", "#ffffff");
    this.cloud.emissiveColor = new Color3(0.92, 0.96, 1);
    this.cloud.diffuseColor = Color3.Black();
    this.cloud.disableLighting = true;
    this.cloud.alpha = 0.96;

    // soft radial glow sprite (parking spot ring, coin shine)
    this.glow = new StandardMaterial("mat-glow", scene);
    this.glow.emissiveTexture = this.makeGlowTexture(scene);
    this.glow.opacityTexture = this.glow.emissiveTexture;
    this.glow.emissiveColor = new Color3(0.3, 1, 0.5);
    this.glow.diffuseColor = Color3.Black();
    this.glow.disableLighting = true;

    this.glass = mk("mat-glass", "#8fd3f2", 0.12, 0.7);
    this.glass.alpha = 0.85;
    this.glass.specularPower = 48;

    this.trim = mk("mat-trim", "#e8ecf4", 0.08, 0.4);
  }

  setGroundColor(hex: string): void {
    this.ground.diffuseColor = Color3.FromHexString(hex);
  }

  // ─────────────────────────────────────────── procedural textures

  private makeAsphaltTexture(scene: Scene): DynamicTexture {
    const size = 256;
    const tex = new DynamicTexture("tex-asphalt", size, scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = "#c9cfdd";
    ctx.fillRect(0, 0, size, size);
    // speckle
    for (let i = 0; i < 2600; i++) {
      const v = 175 + Math.floor(Math.random() * 80);
      const a = 0.14 + Math.random() * 0.22;
      ctx.fillStyle = `rgba(${v},${v + 4},${v + 14},${a})`;
      ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 1.6, 1 + Math.random() * 1.6);
    }
    // faint cracks
    ctx.strokeStyle = "rgba(120,128,148,0.16)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      let x = Math.random() * size;
      let y = Math.random() * size;
      ctx.moveTo(x, y);
      for (let s = 0; s < 5; s++) {
        x += (Math.random() - 0.5) * 46;
        y += (Math.random() - 0.5) * 46;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    tex.update();
    tex.wrapU = Texture.WRAP_ADDRESSMODE;
    tex.wrapV = Texture.WRAP_ADDRESSMODE;
    return tex;
  }

  private makeGrassTexture(scene: Scene): DynamicTexture {
    const size = 512;
    const tex = new DynamicTexture("tex-grass", size, scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.5);
    g.addColorStop(0, "#8fdf68");
    g.addColorStop(0.55, "#7bd45e");
    g.addColorStop(0.85, "#67c9d8");
    g.addColorStop(1, "#4fc3ee"); // fade toward the sky at the horizon
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    // mottling
    for (let i = 0; i < 900; i++) {
      const r = 2 + Math.random() * 7;
      const x = Math.random() * size;
      const y = Math.random() * size;
      const d = Math.hypot(x - size / 2, y - size / 2) / (size / 2);
      if (d > 0.8) continue;
      ctx.fillStyle = `rgba(70,${150 + Math.random() * 60},70,${0.05 + Math.random() * 0.08})`;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.6, r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    tex.update();
    return tex;
  }

  private makeStripesTexture(scene: Scene): DynamicTexture {
    const size = 128;
    const tex = new DynamicTexture("tex-stripes", size, scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = "#ffd23c";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#2b2f3a";
    const w = size / 4;
    for (let x = -size; x < size * 2; x += w * 2) {
      ctx.beginPath();
      ctx.moveTo(x, size);
      ctx.lineTo(x + w, size);
      ctx.lineTo(x + w + size * 0.5, 0);
      ctx.lineTo(x + size * 0.5, 0);
      ctx.fill();
    }
    tex.update();
    tex.wrapU = Texture.WRAP_ADDRESSMODE;
    return tex;
  }

  private makeStarTexture(scene: Scene): DynamicTexture {
    const size = 128;
    const tex = new DynamicTexture("tex-star", size, scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2;
    ctx.fillStyle = "#b97b12";
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? size * 0.34 : size * 0.15;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const x = cx + Math.cos(a) * r;
      const y = cx + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    tex.update();
    return tex;
  }

  private makeGlowTexture(scene: Scene): DynamicTexture {
    const size = 128;
    const tex = new DynamicTexture("tex-glow", size, scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, size, size);
    const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.5);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.45, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    tex.update();
    tex.hasAlpha = true;
    return tex;
  }
}
