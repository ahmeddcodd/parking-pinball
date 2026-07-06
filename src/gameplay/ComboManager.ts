import { TUNING } from "../data/tuning";

export type ComboEvent = "bumper" | "wall" | "ramp" | "coin";

/**
 * Chains stylish events into a rising multiplier with arcade names.
 * The chain drops if too much time passes between events.
 */
export class ComboManager {
  chain = 0;
  private timer = 0;

  /** Fired when the chain hits a milestone worth shouting about. */
  onComboName: ((name: string, chain: number) => void) | null = null;
  onChainChange: ((chain: number, multiplier: number) => void) | null = null;

  get multiplier(): number {
    return Math.min(1 + this.chain * 0.25, TUNING.combo.maxMultiplier);
  }

  reset(): void {
    this.chain = 0;
    this.timer = 0;
    this.onChainChange?.(0, 1);
  }

  add(event: ComboEvent): void {
    this.chain++;
    this.timer = TUNING.combo.window;
    this.onChainChange?.(this.chain, this.multiplier);

    const name = this.nameFor(event, this.chain);
    if (name) this.onComboName?.(name, this.chain);
  }

  private nameFor(event: ComboEvent, chain: number): string | null {
    if (event === "ramp") return "RAMP HERO!";
    if (event === "bumper") {
      if (chain === 2) return "DOUBLE BOUNCE!";
      if (chain === 3) return "TRIPLE TAP!";
      if (chain === 5) return "MEGA BOUNCE!";
      if (chain >= 7 && chain % 2 === 1) return "PINBALL WIZARD!";
      return null;
    }
    if (event === "wall" && chain >= 3 && chain % 3 === 0) return "WALL KISS!";
    if (event === "coin" && chain >= 4 && chain % 4 === 0) return "COIN FRENZY!";
    return null;
  }

  update(dt: number): void {
    if (this.chain === 0) return;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.chain = 0;
      this.onChainChange?.(0, 1);
    }
  }
}
