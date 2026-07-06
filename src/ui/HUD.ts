/**
 * In-game HUD: attempts, score, coins, combo badge, power meter,
 * pause/retry buttons and the big center banner. Pure DOM.
 */
export class HUD {
  onRetry: (() => void) | null = null;
  onPause: (() => void) | null = null;

  private root: HTMLElement;
  private scoreEl: HTMLElement;
  private coinsEl: HTMLElement;
  private attemptsEl: HTMLElement;
  private levelNameEl: HTMLElement;
  private hintEl: HTMLElement;
  private powerWrap: HTMLElement;
  private powerFill: HTMLElement;
  private comboEl: HTMLElement;
  private bannerEl: HTMLElement;
  private bannerTimer = 0;

  constructor(uiRoot: HTMLElement) {
    this.root = document.createElement("div");
    this.root.id = "hud";
    this.root.classList.add("hidden");
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-left">
          <button class="btn icon ghost" id="hud-pause" aria-label="Pause">⏸</button>
          <span class="pill" id="hud-attempts">🚗🚗🚗</span>
        </div>
        <div class="hud-right">
          <span class="pill"><span class="coin-ico"></span><span id="hud-coins">0</span></span>
          <span class="pill" id="hud-score">0</span>
        </div>
      </div>
      <div id="hud-level-name"></div>
      <div id="combo-badge"></div>
      <div id="banner"></div>
      <div id="hud-hint" class="hidden"></div>
      <div id="power-wrap"><div id="power-fill"></div></div>
      <div class="hud-bottom">
        <span></span>
        <button class="btn red" id="hud-retry">↻ Retry</button>
      </div>
    `;
    uiRoot.appendChild(this.root);

    this.scoreEl = this.root.querySelector("#hud-score")!;
    this.coinsEl = this.root.querySelector("#hud-coins")!;
    this.attemptsEl = this.root.querySelector("#hud-attempts")!;
    this.levelNameEl = this.root.querySelector("#hud-level-name")!;
    this.hintEl = this.root.querySelector("#hud-hint")!;
    this.powerWrap = this.root.querySelector("#power-wrap")!;
    this.powerFill = this.root.querySelector("#power-fill")!;
    this.comboEl = this.root.querySelector("#combo-badge")!;
    this.bannerEl = this.root.querySelector("#banner")!;

    this.root.querySelector("#hud-retry")!.addEventListener("click", () => this.onRetry?.());
    this.root.querySelector("#hud-pause")!.addEventListener("click", () => this.onPause?.());
  }

  show(): void {
    this.root.classList.remove("hidden");
  }

  hide(): void {
    this.root.classList.add("hidden");
    this.banner("");
  }

  setLevelInfo(id: number, name: string, hint?: string): void {
    this.levelNameEl.textContent = `Level ${id} · ${name}`;
    this.levelNameEl.classList.add("show");
    window.setTimeout(() => this.levelNameEl.classList.remove("show"), 2600);
    if (hint) {
      this.hintEl.textContent = hint;
      this.hintEl.classList.remove("hidden");
    } else {
      this.hintEl.classList.add("hidden");
    }
  }

  hideHint(): void {
    this.hintEl.classList.add("hidden");
  }

  setScore(v: number): void {
    this.scoreEl.textContent = String(v);
  }

  setCoins(v: number): void {
    this.coinsEl.textContent = String(v);
  }

  setAttempts(left: number, total: number): void {
    this.attemptsEl.textContent = "🚗".repeat(left) + "▫".repeat(Math.max(0, total - left));
  }

  /** p in 0..1 shows the meter; negative hides it. */
  setPower(p: number): void {
    if (p < 0) {
      this.powerWrap.classList.remove("show");
      return;
    }
    this.powerWrap.classList.add("show");
    this.powerFill.style.width = `${Math.round(p * 100)}%`;
  }

  setCombo(chain: number, multiplier: number): void {
    if (chain < 2) {
      this.comboEl.classList.remove("show");
      return;
    }
    this.comboEl.textContent = `COMBO ×${multiplier.toFixed(2).replace(/\.?0+$/, "")} (${chain})`;
    this.comboEl.classList.add("show");
  }

  banner(text: string): void {
    window.clearTimeout(this.bannerTimer);
    if (!text) {
      this.bannerEl.classList.remove("show");
      return;
    }
    this.bannerEl.textContent = text;
    this.bannerEl.classList.add("show");
    this.bannerTimer = window.setTimeout(() => this.bannerEl.classList.remove("show"), 1400);
  }
}
