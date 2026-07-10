import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";

import { SaveManager } from "./SaveManager";
import { AudioManager } from "./AudioManager";
import { InputManager } from "./InputManager";
import { ArcadePhysics } from "../gameplay/ArcadePhysics";
import { CarController } from "../gameplay/CarController";
import { LauncherController } from "../gameplay/LauncherController";
import { CameraController } from "../gameplay/CameraController";
import { EffectsManager } from "../gameplay/EffectsManager";
import { LevelController } from "../gameplay/LevelController";
import { SharedMaterials } from "../objects/Materials";
import { HUD } from "../ui/HUD";
import { MenuUI, LevelSelectUI, ResultsUI, GarageUI, SettingsUI, PauseUI } from "../ui/Screens";
import { LEVELS } from "../data/levels";
import { CARS } from "../data/cars";
import type { FinalScore } from "../gameplay/ScoreManager";

type GameState = "menu" | "levelselect" | "playing" | "paused" | "results" | "garage" | "settings";

/**
 * Top-level state machine. One engine, one scene, DOM overlay screens.
 * The current level's arena doubles as the menu background.
 */
export class Game {
  private engine: Engine;
  private scene: Scene;
  private state: GameState = "menu";
  private settingsFrom: GameState = "menu";

  private save = new SaveManager();
  private audio = new AudioManager();
  private input: InputManager;
  private phys = new ArcadePhysics();
  private mats: SharedMaterials;
  private car: CarController;
  private launcher: LauncherController;
  private cameraCtl: CameraController;
  private effects: EffectsManager;
  private level: LevelController;

  private hud: HUD;
  private menu: MenuUI;
  private levelSelect: LevelSelectUI;
  private results: ResultsUI;
  private garage: GarageUI;
  private settings: SettingsUI;
  private pause: PauseUI;

  private currentLevelId = 1;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.engine = new Engine(canvas, true, { stencil: false, preserveDrawingBuffer: false });
    this.engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));

    this.scene = new Scene(this.engine);
    this.scene.clearColor = Color4.FromHexString("#3ec6f0ff");

    const hemi = new HemisphericLight("hemi", new Vector3(0.2, 1, 0.1), this.scene);
    hemi.intensity = 0.85;
    hemi.groundColor = new Color3(0.45, 0.5, 0.6);
    const dir = new DirectionalLight("dir", new Vector3(-0.4, -1, 0.5), this.scene);
    dir.intensity = 0.55;

    this.audio.init(this.save.data.sound, this.save.data.music);
    this.input = new InputManager(canvas);
    this.mats = new SharedMaterials(this.scene);
    this.car = new CarController(this.scene, this.mats);
    this.car.setSkin(CARS[this.save.data.selectedCar] ?? CARS[0]);
    this.launcher = new LauncherController(this.scene, this.input, this.phys);
    this.cameraCtl = new CameraController(this.scene);
    this.effects = new EffectsManager(this.scene, uiRoot);

    this.hud = new HUD(uiRoot);
    this.menu = new MenuUI(uiRoot);
    this.levelSelect = new LevelSelectUI(uiRoot);
    this.results = new ResultsUI(uiRoot);
    this.garage = new GarageUI(uiRoot);
    this.settings = new SettingsUI(uiRoot);
    this.pause = new PauseUI(uiRoot);

    this.level = new LevelController(
      this.scene,
      this.phys,
      this.car,
      this.launcher,
      this.cameraCtl,
      this.effects,
      this.audio,
      this.mats,
      {
        onHudScore: (s) => this.hud.setScore(s),
        onHudCoins: (c) => this.hud.setCoins(c),
        onHudAttempts: (l, t) => this.hud.setAttempts(l, t),
        onBanner: (t) => this.hud.banner(t),
        onComboChain: (c, m) => this.hud.setCombo(c, m),
        onLevelComplete: (r) => this.handleLevelComplete(r),
        onLevelFailed: (reason) => this.handleLevelFailed(reason),
      }
    );

    this.wireUI();
    this.wireDebugKeys();
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__pp = this;

    // audio can only start after a user gesture
    const unlock = () => this.audio.unlock();
    document.addEventListener("pointerdown", unlock, { passive: true });

    window.addEventListener("resize", () => {
      this.engine.resize();
      // aspect ratio changed → the arena needs re-framing
      this.cameraCtl.onResize();
    });
  }

  start(): void {
    this.showMenu();
    this.engine.runRenderLoop(() => this.tick());
  }

  // ────────────────────────────────────────────── state transitions

  private hideAllScreens(): void {
    this.menu.hide();
    this.levelSelect.hide();
    this.results.hide();
    this.garage.hide();
    this.settings.hide();
    this.pause.hide();
  }

  private showMenu(): void {
    this.state = "menu";
    this.hideAllScreens();
    this.hud.hide();
    this.input.enabled = false;
    this.launcher.disarm();
    // keep a pretty arena behind the menu
    this.loadLevelQuiet(Math.min(this.save.data.unlockedLevel, LEVELS.length));
    this.menu.refresh(this.save);
    this.menu.show();
  }

  private loadLevelQuiet(id: number): void {
    this.currentLevelId = id;
    this.level.load(LEVELS[id - 1]);
    this.input.enabled = false;
  }

  private play(id: number): void {
    this.currentLevelId = id;
    this.state = "playing";
    this.hideAllScreens();
    const data = LEVELS[id - 1];
    this.level.load(data);
    this.car.setSkin(CARS[this.save.data.selectedCar] ?? CARS[0]);
    this.hud.show();
    this.hud.setLevelInfo(data.id, data.name, data.hint);
    this.input.enabled = true;
    this.audio.click();
  }

  private handleLevelComplete(result: FinalScore): void {
    // wallet: coin score + a small star bonus
    const earned = result.coins * 10 + result.stars * 25;
    this.save.addCoins(earned);
    const isBest = this.save.recordResult(this.currentLevelId, result.stars, result.total, LEVELS.length);
    const best = this.save.data.scores[this.currentLevelId] ?? result.total;

    this.state = "results";
    this.input.enabled = false;
    this.hud.hide();
    this.results.showSuccess(this.currentLevelId, result, best, isBest, this.currentLevelId < LEVELS.length);
  }

  private handleLevelFailed(reason: string): void {
    this.state = "results";
    this.input.enabled = false;
    this.hud.hide();
    this.results.showFail(this.currentLevelId, reason);
    this.audio.horn();
  }

  // ────────────────────────────────────────────── UI wiring

  private wireUI(): void {
    this.menu.onPlay = () => this.play(Math.min(this.save.data.unlockedLevel, LEVELS.length));
    this.menu.onLevels = () => {
      this.state = "levelselect";
      this.hideAllScreens();
      this.levelSelect.refresh(this.save);
      this.levelSelect.show();
      this.audio.click();
    };
    this.menu.onGarage = () => {
      this.state = "garage";
      this.hideAllScreens();
      this.garage.refresh(this.save);
      this.garage.show();
      this.audio.click();
    };
    this.menu.onSettings = () => this.openSettings("menu");

    this.levelSelect.onPick = (id) => this.play(id);
    this.levelSelect.onBack = () => this.showMenu();

    this.results.onRetry = () => this.play(this.currentLevelId);
    this.results.onNext = () => this.play(Math.min(this.currentLevelId + 1, LEVELS.length));
    this.results.onMenu = () => this.showMenu();

    this.garage.onAction = (carId) => {
      const car = CARS[carId];
      const owned = this.save.data.ownedCars.includes(carId);
      if (owned) {
        this.save.selectCar(carId);
        this.audio.click();
      } else if (this.save.buyCar(carId, car.cost)) {
        this.save.selectCar(carId);
        this.audio.success();
      } else {
        this.audio.fail();
      }
      this.car.setSkin(CARS[this.save.data.selectedCar]);
      this.garage.refresh(this.save);
    };
    this.garage.onBack = () => this.showMenu();

    this.settings.onSound = (on) => {
      this.save.data.sound = on;
      this.save.save();
      this.audio.setSound(on);
      this.audio.click();
    };
    this.settings.onMusic = (on) => {
      this.save.data.music = on;
      this.save.save();
      this.audio.setMusic(on);
    };
    this.settings.onBack = () => {
      if (this.settingsFrom === "paused") {
        this.openPause();
      } else {
        this.showMenu();
      }
    };

    this.pause.onResume = () => {
      this.state = "playing";
      this.hideAllScreens();
      this.input.enabled = true;
    };
    this.pause.onRestart = () => this.play(this.currentLevelId);
    this.pause.onQuit = () => this.showMenu();

    this.hud.onRetry = () => {
      this.audio.click();
      this.hud.hideHint();
      this.level.retry();
    };
    this.hud.onPause = () => this.openPause();

    this.launcher.onCharge = (p) => {
      if (p < 0) {
        this.hud.setPower(-1);
        this.car.setCharge(0);
        return;
      }
      this.hud.hideHint();
      this.hud.setPower(p);
      this.car.setCharge(p);
      this.audio.stretch(p);
    };
    const prevLaunch = this.launcher.onLaunch;
    this.launcher.onLaunch = (p) => {
      this.hud.setPower(-1);
      this.hud.hideHint();
      prevLaunch?.(p);
    };
  }

  private openSettings(from: GameState): void {
    this.settingsFrom = from === "paused" ? "paused" : "menu";
    this.hideAllScreens();
    this.state = "settings";
    this.settings.refresh(this.save);
    this.settings.show();
    this.audio.click();
  }

  private openPause(): void {
    if (this.state !== "playing" && this.state !== "settings") return;
    this.state = "paused";
    this.input.enabled = false;
    this.input.cancel();
    this.hideAllScreens();
    this.pause.show();
    this.audio.click();
  }

  private wireDebugKeys(): void {
    if (!import.meta.env.DEV) return;
    window.addEventListener("keydown", (e) => {
      if (this.state !== "playing") return;
      if (e.key === "r") this.level.retry();
      if (e.key === "n") this.play(Math.min(this.currentLevelId + 1, LEVELS.length));
      if (e.key === "p") this.play(Math.max(this.currentLevelId - 1, 1));
    });
  }

  // ────────────────────────────────────────────── frame loop

  private tick(): void {
    const realDt = Math.min(this.engine.getDeltaTime() / 1000, 0.05);
    this.effects.update(realDt);

    if (this.state !== "paused") {
      const dt = realDt * this.effects.timeScale;
      this.phys.update(dt);
      this.level.update(dt);
      this.car.update(this.phys, dt);
      this.cameraCtl.update(this.phys, realDt);
    }

    this.scene.render();
  }
}
