import type { SaveManager } from "../core/SaveManager";
import type { FinalScore } from "../gameplay/ScoreManager";
import { LEVELS, getWorld } from "../data/levels";
import { CARS } from "../data/cars";

/** Base helper for a full-screen DOM overlay. */
class Screen {
  protected root: HTMLElement;

  constructor(uiRoot: HTMLElement, id: string, dim = false) {
    this.root = document.createElement("div");
    this.root.id = id;
    this.root.className = `screen hidden${dim ? " dim" : ""}`;
    uiRoot.appendChild(this.root);
  }

  show(): void {
    this.root.classList.remove("hidden");
  }

  hide(): void {
    this.root.classList.add("hidden");
  }
}

// ────────────────────────────────────────────────────────── main menu

export class MenuUI extends Screen {
  onPlay: (() => void) | null = null;
  onLevels: (() => void) | null = null;
  onGarage: (() => void) | null = null;
  onSettings: (() => void) | null = null;

  private coinsEl: HTMLElement;

  constructor(uiRoot: HTMLElement) {
    super(uiRoot, "menu-screen");
    this.root.innerHTML = `
      <span class="pill menu-coins"><span class="coin-ico"></span><span id="menu-coins">0</span></span>
      <div class="game-title">
        <h1>PARKING<br>PINBALL <span class="title-3d">3D</span></h1>
        <p>Launch it. Bounce it. Park it.</p>
      </div>
      <div class="menu-buttons">
        <button class="btn primary" id="m-play">▶ PLAY</button>
        <div class="btn-row">
          <button class="btn blue" id="m-levels">Levels</button>
          <button class="btn" id="m-garage">Garage</button>
          <button class="btn icon ghost" id="m-settings" aria-label="Settings">⚙</button>
        </div>
      </div>
    `;
    this.coinsEl = this.root.querySelector("#menu-coins")!;
    this.root.querySelector("#m-play")!.addEventListener("click", () => this.onPlay?.());
    this.root.querySelector("#m-levels")!.addEventListener("click", () => this.onLevels?.());
    this.root.querySelector("#m-garage")!.addEventListener("click", () => this.onGarage?.());
    this.root.querySelector("#m-settings")!.addEventListener("click", () => this.onSettings?.());
  }

  refresh(save: SaveManager): void {
    this.coinsEl.textContent = String(save.data.coins);
  }
}

// ────────────────────────────────────────────────────────── level select

export class LevelSelectUI extends Screen {
  onPick: ((levelId: number) => void) | null = null;
  onBack: (() => void) | null = null;

  private grid: HTMLElement;
  private worldEl: HTMLElement;

  constructor(uiRoot: HTMLElement) {
    super(uiRoot, "level-select-screen", true);
    this.root.innerHTML = `
      <div class="top-bar">
        <button class="btn icon ghost" id="ls-back" aria-label="Back">←</button>
        <span class="screen-heading">Levels</span>
        <span style="width:52px"></span>
      </div>
      <div class="panel">
        <div class="world-label" id="ls-world"></div>
        <div class="level-grid" id="ls-grid"></div>
      </div>
    `;
    this.grid = this.root.querySelector("#ls-grid")!;
    this.worldEl = this.root.querySelector("#ls-world")!;
    this.root.querySelector("#ls-back")!.addEventListener("click", () => this.onBack?.());
  }

  refresh(save: SaveManager): void {
    this.worldEl.textContent = `World 1 · ${getWorld(LEVELS[0].world).name}`;
    this.grid.innerHTML = "";
    for (const lvl of LEVELS) {
      const unlocked = lvl.id <= save.data.unlockedLevel;
      const stars = save.data.stars[lvl.id] ?? 0;
      const cell = document.createElement("button");
      cell.className = `level-cell${unlocked ? "" : " locked"}`;
      if (unlocked) {
        cell.innerHTML = `<span>${lvl.id}</span><span class="cell-stars">${"★"
          .repeat(stars)
          .padEnd(3, "☆")
          .replace(/☆/g, '<span class="off">★</span>')}</span>`;
        cell.addEventListener("click", () => this.onPick?.(lvl.id));
      } else {
        cell.textContent = "🔒";
        cell.disabled = true;
      }
      this.grid.appendChild(cell);
    }
  }
}

// ────────────────────────────────────────────────────────── results

export class ResultsUI extends Screen {
  onRetry: (() => void) | null = null;
  onNext: (() => void) | null = null;
  onMenu: (() => void) | null = null;

  constructor(uiRoot: HTMLElement) {
    super(uiRoot, "results-screen", true);
  }

  showSuccess(levelId: number, result: FinalScore, best: number, isBest: boolean, hasNext: boolean): void {
    const stars = ["", "", ""]
      .map((_, i) => `<span class="star${i < result.stars ? " earned pop" : ""}" style="animation-delay:${0.25 + i * 0.25}s">★</span>`)
      .join("");
    const lines = result.bonusLines
      .filter(([, v]) => v !== 0)
      .map(([label, v]) => `<div class="line"><span>${label}</span><span>${v > 0 ? "+" : ""}${v}</span></div>`)
      .join("");
    this.root.innerHTML = `
      <div class="panel">
        <div class="result-title">Level ${levelId} Complete!</div>
        ${result.perfect ? '<div class="perfect-tag">✨ PERFECT PARK ✨</div>' : ""}
        <div class="stars-row">${stars}</div>
        <div class="score-lines">
          ${lines}
          <div class="line total"><span>Score</span><span>${result.total}</span></div>
          <div class="line muted"><span>${isBest ? "New best!" : "Best"}</span><span>${best}</span></div>
        </div>
        <div class="btn-row">
          <button class="btn icon ghost" id="r-menu" aria-label="Menu">🏠</button>
          <button class="btn red" id="r-retry">↻ Retry</button>
          ${hasNext ? '<button class="btn primary" id="r-next">Next ▶</button>' : ""}
        </div>
      </div>
    `;
    this.wire(hasNext);
    this.show();
  }

  showFail(levelId: number, reason: string): void {
    this.root.innerHTML = `
      <div class="panel">
        <div class="result-title fail">Level ${levelId} Failed</div>
        <div class="score-lines"><div class="line muted"><span>${reason}</span><span></span></div></div>
        <div class="btn-row">
          <button class="btn icon ghost" id="r-menu" aria-label="Menu">🏠</button>
          <button class="btn primary" id="r-retry">↻ Try Again</button>
        </div>
      </div>
    `;
    this.wire(false);
    this.show();
  }

  private wire(hasNext: boolean): void {
    this.root.querySelector("#r-retry")!.addEventListener("click", () => this.onRetry?.());
    this.root.querySelector("#r-menu")!.addEventListener("click", () => this.onMenu?.());
    if (hasNext) this.root.querySelector("#r-next")?.addEventListener("click", () => this.onNext?.());
  }
}

// ────────────────────────────────────────────────────────── garage

export class GarageUI extends Screen {
  onAction: ((carId: number) => void) | null = null;
  onBack: (() => void) | null = null;

  private grid: HTMLElement;
  private coinsEl: HTMLElement;

  constructor(uiRoot: HTMLElement) {
    super(uiRoot, "garage-screen", true);
    this.root.innerHTML = `
      <div class="top-bar">
        <button class="btn icon ghost" id="g-back" aria-label="Back">←</button>
        <span class="screen-heading">Garage</span>
        <span class="pill"><span class="coin-ico"></span><span id="g-coins">0</span></span>
      </div>
      <div class="panel">
        <div class="car-grid" id="g-grid"></div>
      </div>
    `;
    this.grid = this.root.querySelector("#g-grid")!;
    this.coinsEl = this.root.querySelector("#g-coins")!;
    this.root.querySelector("#g-back")!.addEventListener("click", () => this.onBack?.());
  }

  refresh(save: SaveManager): void {
    this.coinsEl.textContent = String(save.data.coins);
    this.grid.innerHTML = "";
    CARS.forEach((car, id) => {
      const owned = save.data.ownedCars.includes(id);
      const selected = save.data.selectedCar === id;
      const card = document.createElement("button");
      card.className = `car-card${selected ? " selected" : ""}${owned ? " owned" : ""}`;
      const price = owned
        ? selected
          ? "Selected ✓"
          : "Owned"
        : `<span class="coin-ico"></span>${car.cost}`;
      card.innerHTML = `
        <span class="car-swatch" style="background:${car.body}"></span>
        <span class="car-name">${car.name}</span>
        <span class="car-price">${price}</span>
      `;
      card.addEventListener("click", () => this.onAction?.(id));
      this.grid.appendChild(card);
    });
  }
}

// ────────────────────────────────────────────────────────── settings & pause

export class SettingsUI extends Screen {
  onSound: ((on: boolean) => void) | null = null;
  onMusic: ((on: boolean) => void) | null = null;
  onBack: (() => void) | null = null;

  constructor(uiRoot: HTMLElement) {
    super(uiRoot, "settings-screen", true);
  }

  refresh(save: SaveManager): void {
    this.root.innerHTML = `
      <div class="panel">
        <h2 class="panel-title">Settings</h2>
        <div class="toggle-row"><span>🔊 Sound</span><button class="toggle${save.data.sound ? " on" : ""}" id="s-sound"></button></div>
        <div class="toggle-row"><span>🎵 Music</span><button class="toggle${save.data.music ? " on" : ""}" id="s-music"></button></div>
        <div class="spacer"></div>
        <button class="btn blue" id="s-back">Done</button>
      </div>
    `;
    const soundBtn = this.root.querySelector<HTMLElement>("#s-sound")!;
    const musicBtn = this.root.querySelector<HTMLElement>("#s-music")!;
    soundBtn.addEventListener("click", () => {
      const on = !soundBtn.classList.contains("on");
      soundBtn.classList.toggle("on", on);
      this.onSound?.(on);
    });
    musicBtn.addEventListener("click", () => {
      const on = !musicBtn.classList.contains("on");
      musicBtn.classList.toggle("on", on);
      this.onMusic?.(on);
    });
    this.root.querySelector("#s-back")!.addEventListener("click", () => this.onBack?.());
  }
}

export class PauseUI extends Screen {
  onResume: (() => void) | null = null;
  onRestart: (() => void) | null = null;
  onQuit: (() => void) | null = null;

  constructor(uiRoot: HTMLElement) {
    super(uiRoot, "pause-screen", true);
    this.root.innerHTML = `
      <div class="panel">
        <h2 class="panel-title">Paused</h2>
        <div class="btn-row" style="flex-direction:column;align-items:center">
          <button class="btn primary" id="p-resume">▶ Resume</button>
          <button class="btn blue" id="p-restart">↻ Restart Level</button>
          <button class="btn ghost" id="p-quit">🏠 Main Menu</button>
        </div>
      </div>
    `;
    this.root.querySelector("#p-resume")!.addEventListener("click", () => this.onResume?.());
    this.root.querySelector("#p-restart")!.addEventListener("click", () => this.onRestart?.());
    this.root.querySelector("#p-quit")!.addEventListener("click", () => this.onQuit?.());
  }
}
