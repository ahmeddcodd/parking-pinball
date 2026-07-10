import type { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { LevelData } from "../data/levels";
import { getWorld } from "../data/levels";
import { TUNING } from "../data/tuning";
import { degToRad } from "../utils/MathUtils";
import type { ArcadePhysics } from "./ArcadePhysics";
import type { CarController } from "./CarController";
import type { LauncherController } from "./LauncherController";
import type { CameraController } from "./CameraController";
import type { EffectsManager } from "./EffectsManager";
import type { AudioManager } from "../core/AudioManager";
import { ScoreManager, type FinalScore } from "./ScoreManager";
import { ComboManager } from "./ComboManager";
import { ParkingSpot } from "./ParkingSpot";
import { SharedMaterials } from "../objects/Materials";
import { Scenery } from "../objects/Scenery";
import { Wall } from "../objects/Wall";
import { Bumper } from "../objects/Bumper";
import { Coin } from "../objects/Coin";
import { Ramp } from "../objects/Ramp";
import { Hazard } from "../objects/Hazard";

export type AttemptState = "ready" | "launched" | "resolving" | "done";

export interface LevelEvents {
  onHudScore(score: number): void;
  onHudCoins(coins: number): void;
  onHudAttempts(left: number, total: number): void;
  onBanner(text: string, sticky?: boolean): void;
  onComboChain(chain: number, multiplier: number): void;
  onLevelComplete(result: FinalScore): void;
  onLevelFailed(reason: string): void;
}

/**
 * Spawns a level from data and runs the attempt loop:
 * ready → launched → (parked | failed) → retry or results.
 */
export class LevelController {
  state: AttemptState = "ready";
  data!: LevelData;

  private ground: Mesh | null = null;
  private asphalt: Mesh | null = null;
  private scenery: Scenery | null = null;
  private walls: Wall[] = [];
  private bumpers: Bumper[] = [];
  private coins: Coin[] = [];
  private ramps: Ramp[] = [];
  private hazards: Hazard[] = [];
  private cones: Mesh[] = [];
  private spot: ParkingSpot | null = null;
  private decoys: ParkingSpot[] = [];

  private attemptsLeft = 3;
  private attemptIndex = 0;
  private attemptTimer = 0;
  private stuckTimer = 0;
  private failTimer = -1;
  private failReason = "";
  private successTimer = -1;
  private pendingResult: FinalScore | null = null;
  private coinStreak = 0;

  readonly score = new ScoreManager();
  readonly combo = new ComboManager();

  constructor(
    private scene: Scene,
    private phys: ArcadePhysics,
    private car: CarController,
    private launcher: LauncherController,
    private camera: CameraController,
    private effects: EffectsManager,
    private audio: AudioManager,
    private mats: SharedMaterials,
    private events: LevelEvents
  ) {
    // physics → game events
    phys.onWallHit = (impact, x, z) => this.handleWallHit(impact, x, z);
    phys.onBumperHit = (b) => this.handleBumperHit(b.ref as Bumper);
    phys.onLand = () => {
      if (this.state !== "launched") return;
      this.car.pulseLand();
      this.effects.dust(phys.pos.x, phys.pos.z);
      this.audio.land();
      this.camera.addShake(0.12);
    };
    // The instant the car tips over a lip — long before it hits the failure
    // depth — kick off the falling animation and its feedback.
    phys.onHoleEnter = (h) => {
      if (this.state !== "launched") return;
      this.car.startFalling();
      this.effects.dust(h.x, h.z);
      this.camera.addShake(0.3);
      this.audio.fail();
    };

    launcher.onLaunch = (power01) => this.handleLaunch(power01);

    this.combo.onChainChange = (chain, mult) => this.events.onComboChain(chain, mult);
    this.combo.onComboName = (name) => {
      this.effects.floatText(name, new Vector3(phys.pos.x, 1.4, phys.pos.z), this.camera.camera, true);
    };
  }

  // ────────────────────────────────────────────── level lifecycle

  load(data: LevelData): void {
    this.dispose();
    this.data = data;
    const world = getWorld(data.world);
    this.mats.setGroundColor(world.ground);

    const { width, depth } = data.ground;

    // lot floor: concrete curb box + textured asphalt surface on top
    this.ground = MeshBuilder.CreateBox("ground", { width: width + 0.5, height: 0.4, depth: depth + 0.5 }, this.scene);
    this.ground.position.y = -0.2;
    this.ground.material = this.mats.curb;
    this.ground.isPickable = false;
    this.asphalt = MeshBuilder.CreateGround("asphalt", { width, height: depth }, this.scene);
    this.asphalt.position.y = 0.004;
    this.asphalt.material = this.mats.ground;
    this.asphalt.isPickable = false;
    this.mats.asphaltTex.uScale = width / 5;
    this.mats.asphaltTex.vScale = depth / 5;
    this.phys.grounds = [{ x: 0, z: 0, halfW: width / 2, halfD: depth / 2 }];

    // decorative world around the lot
    this.scenery = new Scenery(this.scene, this.mats, data.id, width, depth);

    // border rails
    this.phys.walls = [];
    this.phys.bumpers = [];
    this.phys.holes = [];
    const t = 0.35;
    const bh = 0.55;
    const border = (x: number, z: number, w: number, d: number) =>
      new Wall(this.scene, this.phys, this.mats.border, this.mats.borderCap, x, z, w, d, 0, bh);
    this.walls = [
      border(0, depth / 2 + t / 2, width + t * 2, t),
      border(0, -depth / 2 - t / 2, width + t * 2, t),
      border(width / 2 + t / 2, 0, t, depth),
      border(-width / 2 - t / 2, 0, t, depth),
    ];

    // target + objects
    this.spot = new ParkingSpot(this.scene, this.mats, data.target);
    for (const o of data.objects) {
      switch (o.type) {
        case "wall":
          this.walls.push(
            new Wall(this.scene, this.phys, this.mats.wall, this.mats.wallCap, o.x, o.z, o.w, o.d, o.rot ?? 0, o.h ?? 0.6)
          );
          break;
        case "bumper":
          this.bumpers.push(new Bumper(this.scene, this.phys, this.mats, o.x, o.z, o.radius, o.force));
          break;
        case "coin":
          this.coins.push(new Coin(this.scene, this.mats, o.x, o.z, o.value ?? TUNING.score.coin));
          break;
        case "ramp": {
          const ramp = new Ramp(this.scene, this.phys, this.mats, o.x, o.z, o.rot ?? 0, o.w, o.l);
          ramp.onJump = () => this.handleRampJump();
          this.ramps.push(ramp);
          break;
        }
        case "hazard": {
          const hole = new Hazard(this.scene, this.mats, o.x, o.z, o.radius);
          hole.addCollider(this.phys); // subtracts ground; the car falls in
          this.hazards.push(hole);
          break;
        }
        case "decoy":
          this.decoys.push(
            new ParkingSpot(
              this.scene,
              this.mats,
              { x: o.x, z: o.z, rotation: o.rotation ?? 0, width: o.width ?? 2.7, length: o.length ?? 4.0 },
              true
            )
          );
          break;
        case "cone": {
          const cone = MeshBuilder.CreateCylinder(
            "cone",
            { diameterBottom: 0.44, diameterTop: 0.06, height: 0.62, tessellation: 12 },
            this.scene
          );
          cone.position.set(o.x, 0.31, o.z);
          cone.material = this.mats.cone;
          cone.isPickable = false;
          const band = MeshBuilder.CreateCylinder(
            "cone-band",
            { diameterBottom: 0.3, diameterTop: 0.2, height: 0.14, tessellation: 12 },
            this.scene
          );
          band.position.y = 0.06;
          band.material = this.mats.coneBand;
          band.parent = cone;
          band.isPickable = false;
          this.cones.push(cone);
          break;
        }
      }
    }

    this.attemptsLeft = data.attempts;
    this.attemptIndex = 0;
    this.camera.frameLevel(width, depth);
    this.startAttempt();
  }

  private startAttempt(): void {
    const d = this.data;
    this.state = "ready";
    this.attemptTimer = 0;
    this.stuckTimer = 0;
    this.failTimer = -1;
    this.successTimer = -1;
    this.coinStreak = 0;

    this.phys.reset(d.start.x, d.start.z);
    this.car.place(d.start.x, d.start.z, degToRad(d.start.angle));
    this.car.setVisible(true);
    this.spot?.resetAttempt();
    for (const dcy of this.decoys) dcy.resetAttempt();
    for (const c of this.coins) c.resetAttempt();
    for (const r of this.ramps) r.resetAttempt();

    this.score.startAttempt(this.attemptIndex);
    this.combo.reset();
    this.effects.clearSlowMo();
    this.camera.setOverview();
    this.launcher.arm();

    this.events.onHudScore(0);
    this.events.onHudCoins(0);
    this.events.onHudAttempts(this.attemptsLeft, d.attempts);
  }

  /** Player pressed retry: costs the current attempt if the car is in play. */
  retry(): void {
    if (this.state === "done") return;
    if (this.state === "ready") {
      this.startAttempt(); // free re-place before launching
      return;
    }
    this.failAttempt("Retry!");
    this.failTimer = 0.01; // resolve immediately
  }

  // ────────────────────────────────────────────── event handlers

  private handleLaunch(power01: number): void {
    if (this.state !== "ready") return;
    this.state = "launched";
    this.car.pulseLaunch();
    this.audio.launch(power01);
    this.camera.follow();
    this.events.onBanner("");
  }

  private handleWallHit(impact: number, x: number, z: number): void {
    if (this.state !== "launched") return;
    const crash = impact > TUNING.physics.wallCrashSpeed;
    if (crash) {
      this.score.addCrash();
      this.audio.crash();
      this.camera.addShake(TUNING.effects.crashShake);
      this.effects.dust(x, z);
    } else if (impact > 3) {
      this.audio.wallHit(impact / TUNING.physics.maxSpeed);
      this.camera.addShake(TUNING.effects.hitShake * (impact / TUNING.physics.maxSpeed));
      if (impact > 4.5) this.combo.add("wall");
    }
    this.events.onHudScore(this.score.liveScore);
  }

  private handleBumperHit(bumper: Bumper | undefined): void {
    if (this.state !== "launched") return;
    bumper?.hit();
    this.combo.add("bumper");
    const pts = this.score.addBumper(this.combo.multiplier);
    this.audio.bumper(this.combo.chain);
    this.camera.addShake(TUNING.effects.hitShake);
    const p = this.phys.pos;
    this.effects.bumperHit(bumper?.x ?? p.x, 0.4, bumper?.z ?? p.z);
    this.effects.floatText(`+${pts}`, new Vector3(p.x, 1.1, p.z), this.camera.camera);
    this.events.onHudScore(this.score.liveScore);
  }

  private handleRampJump(): void {
    if (this.state !== "launched") return;
    const pts = this.score.addRamp();
    this.combo.add("ramp");
    this.audio.ramp();
    const p = this.phys.pos;
    this.effects.floatText(`+${pts}`, new Vector3(p.x, 1.6, p.z), this.camera.camera);
    this.events.onHudScore(this.score.liveScore);
  }

  // ────────────────────────────────────────────── outcome handling

  private failAttempt(reason: string): void {
    if (this.state !== "launched") return;
    this.state = "resolving";
    this.failReason = reason;
    this.failTimer = TUNING.attempt.failResetDelay;
    this.launcher.disarm();
    this.audio.fail();
    this.events.onBanner(reason);
    this.combo.reset();
  }

  private succeed(alignDeg: number, centerDist: number, fullyInside: boolean): void {
    this.state = "resolving";
    this.launcher.disarm();

    const PK = TUNING.parking;
    const perfect =
      centerDist <= PK.perfectCenterDist &&
      alignDeg <= PK.perfectAlignDeg &&
      fullyInside &&
      !this.score.tally.crashed;

    const result = this.score.finalize(alignDeg, perfect, this.data.starScores);
    this.pendingResult = result;
    this.successTimer = perfect ? 2.1 : 1.5;

    this.spot?.celebrate(perfect);
    this.camera.zoomSuccess(this.spot!.x, this.spot!.z);
    this.effects.confetti(this.spot!.x, this.spot!.z);
    this.audio.confetti();
    if (perfect) {
      this.effects.slowMo();
      this.audio.perfect();
      this.events.onBanner("PERFECT PARK!");
    } else {
      this.audio.success();
      this.events.onBanner(alignDeg <= PK.goodAlignDeg ? "GREAT PARK!" : "PARKED!");
    }
  }

  // ────────────────────────────────────────────── frame update

  update(dt: number): void {
    this.scenery?.update(dt);
    for (const b of this.bumpers) b.update(dt);
    for (const c of this.coins) c.update(dt);

    if (this.state === "launched") {
      this.attemptTimer += dt;
      this.combo.update(dt);
      this.updateTriggers(dt);
      this.updateOutcomes(dt);
    } else if (this.state === "resolving") {
      this.combo.update(dt);
      // let the car keep sliding into place during the celebration
      if (this.successTimer >= 0 && this.spot) {
        this.spot.update(this.phys, this.car.yaw, dt);
      }
      this.updateTimers(dt);
    } else if (this.state === "ready" && this.spot) {
      this.spot.update(this.phys, this.car.yaw, dt);
    }
  }

  private updateTriggers(dt: number): void {
    const phys = this.phys;

    // coins
    for (const c of this.coins) {
      if (c.tryCollect(phys)) {
        this.coinStreak++;
        this.score.addCoin(c.value);
        this.combo.add("coin");
        this.audio.coin(this.coinStreak);
        this.effects.coinSparkle(phys.pos.x, 0.7, phys.pos.z);
        this.events.onHudCoins(this.score.tally.coins);
        this.events.onHudScore(this.score.liveScore);
      }
    }

    // ramps
    for (const r of this.ramps) r.update(dt);
  }

  private updateOutcomes(dt: number): void {
    const phys = this.phys;
    const A = TUNING.attempt;

    // Swallowed by a pit. The car is captured the moment it crosses the lip,
    // so this only waits long enough for the fall to read on screen before
    // resolving — no need to trace it down to the out-of-bounds plane.
    if (phys.capturedBy && phys.pos.y < TUNING.physics.holeFailDepth) {
      this.failAttempt("Down the hole! 🕳️");
      return;
    }

    // fell off the lot
    if (phys.pos.y < TUNING.physics.outOfBoundsY) {
      this.failAttempt("Out of bounds!");
      return;
    }

    // parking check
    const check = this.spot!.update(phys, this.car.yaw, dt);
    if (check.dwellDone) {
      this.succeed(check.alignDeg, check.centerDist, check.fullyInside);
      return;
    }

    // decoy check — settled in the wrong spot
    for (const d of this.decoys) {
      const dc = d.update(phys, this.car.yaw, dt);
      if (dc.inside && phys.settled) {
        this.failAttempt("Wrong spot! -300");
        return;
      }
    }

    // stopped outside the target
    if (phys.settled && !check.inside) {
      this.failAttempt("Missed the spot!");
      return;
    }

    // barely moving forever (stuck against a wall etc.)
    if (!check.inside && phys.speed < A.stuckSpeed && !phys.airborne) {
      this.stuckTimer += dt;
      if (this.stuckTimer > A.stuckTime) {
        this.failAttempt("Stuck!");
        return;
      }
    } else {
      this.stuckTimer = 0;
    }

    // attempt timeout
    if (this.attemptTimer > A.maxTime) {
      this.failAttempt("Time's up!");
    }
  }

  private updateTimers(dt: number): void {
    if (this.failTimer >= 0) {
      this.failTimer -= dt;
      if (this.failTimer < 0) {
        this.attemptsLeft--;
        this.attemptIndex++;
        this.events.onHudAttempts(Math.max(0, this.attemptsLeft), this.data.attempts);
        if (this.attemptsLeft > 0) {
          this.startAttempt();
        } else {
          this.state = "done";
          this.events.onLevelFailed(this.failReason);
        }
      }
    }
    if (this.successTimer >= 0) {
      this.successTimer -= dt;
      if (this.successTimer < 0) {
        this.state = "done";
        this.effects.clearSlowMo();
        this.events.onLevelComplete(this.pendingResult!);
      }
    }
  }

  dispose(): void {
    this.launcher.disarm();
    this.ground?.dispose();
    this.ground = null;
    this.asphalt?.dispose();
    this.asphalt = null;
    this.scenery?.dispose();
    this.scenery = null;
    for (const w of this.walls) w.dispose();
    for (const b of this.bumpers) b.dispose();
    for (const c of this.coins) c.dispose();
    for (const r of this.ramps) r.dispose();
    for (const h of this.hazards) h.dispose();
    for (const c of this.cones) c.dispose();
    this.spot?.dispose();
    for (const d of this.decoys) d.dispose();
    this.walls = [];
    this.bumpers = [];
    this.coins = [];
    this.ramps = [];
    this.hazards = [];
    this.cones = [];
    this.decoys = [];
    this.spot = null;
    this.phys.walls = [];
    this.phys.bumpers = [];
    this.phys.holes = [];
  }
}
