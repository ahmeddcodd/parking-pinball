import type { Scene } from "@babylonjs/core/scene";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import { TUNING } from "../data/tuning";

/**
 * All the juice: reusable burst particle systems (never re-created per
 * event), global slow motion, and DOM floating text projected from
 * world space. Everything is pooled/pre-allocated at construction.
 */
export class EffectsManager {
  /** Multiply frame dt by this (slow motion). */
  timeScale = 1;

  private slowMoLeft = 0;
  private hitPS: ParticleSystem;
  private sparklePS: ParticleSystem;
  private confettiPS: ParticleSystem;
  private dustPS: ParticleSystem;

  constructor(
    private scene: Scene,
    private uiRoot: HTMLElement
  ) {
    const tex = this.makeDotTexture();

    this.hitPS = this.makePS("fx-hit", tex, {
      capacity: 60,
      c1: new Color4(1, 0.55, 0.7, 1),
      c2: new Color4(1, 0.9, 0.5, 1),
      minSize: 0.14,
      maxSize: 0.3,
      minLife: 0.18,
      maxLife: 0.4,
      power: 6,
      gravity: -4,
    });

    this.sparklePS = this.makePS("fx-sparkle", tex, {
      capacity: 40,
      c1: new Color4(1, 0.9, 0.35, 1),
      c2: new Color4(1, 1, 0.75, 1),
      minSize: 0.1,
      maxSize: 0.24,
      minLife: 0.25,
      maxLife: 0.5,
      power: 3.2,
      gravity: 2.5,
    });

    this.confettiPS = this.makePS("fx-confetti", tex, {
      capacity: 220,
      c1: new Color4(1, 0.45, 0.65, 1),
      c2: new Color4(0.4, 0.85, 1, 1),
      minSize: 0.16,
      maxSize: 0.34,
      minLife: 0.9,
      maxLife: 1.6,
      power: 8,
      gravity: -9,
    });

    this.dustPS = this.makePS("fx-dust", tex, {
      capacity: 50,
      c1: new Color4(0.85, 0.82, 0.75, 0.7),
      c2: new Color4(0.95, 0.93, 0.88, 0.5),
      minSize: 0.2,
      maxSize: 0.5,
      minLife: 0.3,
      maxLife: 0.7,
      power: 2,
      gravity: 0.6,
    });
  }

  private makeDotTexture(): DynamicTexture {
    const size = 64;
    const tex = new DynamicTexture("fx-dot", size, this.scene, false);
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.7, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    tex.update();
    tex.hasAlpha = true;
    return tex;
  }

  private makePS(
    name: string,
    tex: DynamicTexture,
    o: {
      capacity: number;
      c1: Color4;
      c2: Color4;
      minSize: number;
      maxSize: number;
      minLife: number;
      maxLife: number;
      power: number;
      gravity: number;
    }
  ): ParticleSystem {
    const ps = new ParticleSystem(name, o.capacity, this.scene);
    ps.particleTexture = tex;
    ps.emitter = new Vector3(0, -100, 0);
    ps.color1 = o.c1;
    ps.color2 = o.c2;
    ps.colorDead = new Color4(o.c2.r, o.c2.g, o.c2.b, 0);
    ps.minSize = o.minSize;
    ps.maxSize = o.maxSize;
    ps.minLifeTime = o.minLife;
    ps.maxLifeTime = o.maxLife;
    ps.emitRate = 0;
    ps.manualEmitCount = 0;
    ps.minEmitPower = o.power * 0.5;
    ps.maxEmitPower = o.power;
    ps.gravity = new Vector3(0, o.gravity, 0);
    ps.direction1 = new Vector3(-1, 0.4, -1);
    ps.direction2 = new Vector3(1, 1.4, 1);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.start();
    return ps;
  }

  private burst(ps: ParticleSystem, x: number, y: number, z: number, count: number): void {
    (ps.emitter as Vector3).set(x, y, z);
    ps.manualEmitCount = count;
  }

  bumperHit(x: number, y: number, z: number): void {
    this.burst(this.hitPS, x, y + 0.5, z, 16);
  }

  coinSparkle(x: number, y: number, z: number): void {
    this.burst(this.sparklePS, x, y, z, 12);
  }

  confetti(x: number, z: number): void {
    this.burst(this.confettiPS, x, 2.2, z, 140);
  }

  dust(x: number, z: number): void {
    this.burst(this.dustPS, x, 0.15, z, 10);
  }

  slowMo(): void {
    this.timeScale = TUNING.effects.slowMoScale;
    this.slowMoLeft = TUNING.effects.slowMoDuration;
  }

  /** dt = REAL seconds (unscaled). */
  update(dt: number): void {
    if (this.slowMoLeft > 0) {
      this.slowMoLeft -= dt;
      if (this.slowMoLeft <= 0) this.timeScale = 1;
    }
  }

  clearSlowMo(): void {
    this.slowMoLeft = 0;
    this.timeScale = 1;
  }

  /** Floating score/combo text at a world position (DOM, auto-removes). */
  floatText(text: string, worldPos: Vector3, camera: Camera, big = false): void {
    const engine = this.scene.getEngine();
    const p = Vector3.Project(
      worldPos,
      Matrix.IdentityReadOnly,
      this.scene.getTransformMatrix(),
      camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
    );
    const el = document.createElement("div");
    el.className = big ? "float-text big" : "float-text";
    el.textContent = text;
    el.style.left = `${(p.x / engine.getRenderWidth()) * 100}%`;
    el.style.top = `${(p.y / engine.getRenderHeight()) * 100}%`;
    this.uiRoot.appendChild(el);
    window.setTimeout(() => el.remove(), 950);
  }
}
