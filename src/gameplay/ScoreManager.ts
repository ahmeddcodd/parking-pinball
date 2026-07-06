import { TUNING } from "../data/tuning";

const S = TUNING.score;

export interface AttemptTally {
  coins: number;
  coinScore: number;
  bumperScore: number;
  rampScore: number;
  crashPenalty: number;
  crashed: boolean;
  attemptIndex: number; // 0 = first try
}

export interface FinalScore {
  total: number;
  base: number;
  bonusLines: Array<[string, number]>;
  stars: number;
  coins: number;
  perfect: boolean;
}

/**
 * Per-attempt score tally + end-of-level breakdown and star rating.
 */
export class ScoreManager {
  tally: AttemptTally = this.freshTally(0);

  freshTally(attemptIndex: number): AttemptTally {
    return {
      coins: 0,
      coinScore: 0,
      bumperScore: 0,
      rampScore: 0,
      crashPenalty: 0,
      crashed: false,
      attemptIndex,
    };
  }

  startAttempt(attemptIndex: number): void {
    this.tally = this.freshTally(attemptIndex);
  }

  addCoin(value: number): void {
    this.tally.coins++;
    this.tally.coinScore += value;
  }

  addBumper(comboMultiplier: number): number {
    const pts = Math.round(S.bumperHit * comboMultiplier);
    this.tally.bumperScore += pts;
    return pts;
  }

  addRamp(): number {
    this.tally.rampScore += S.rampJump;
    return S.rampJump;
  }

  addCrash(): void {
    this.tally.crashed = true;
    this.tally.crashPenalty = Math.min(S.maxCrashPenalty, this.tally.crashPenalty + S.crashPenalty);
  }

  /** Live score shown on the HUD during an attempt. */
  get liveScore(): number {
    const t = this.tally;
    return Math.max(0, t.coinScore + t.bumperScore + t.rampScore - t.crashPenalty);
  }

  finalize(alignDeg: number, perfect: boolean, starScores: [number, number, number]): FinalScore {
    const t = this.tally;
    const lines: Array<[string, number]> = [];

    lines.push(["Parked", S.parkBase]);
    if (t.coins > 0) lines.push([`Coins ×${t.coins}`, t.coinScore]);
    if (t.bumperScore > 0) lines.push(["Bumper combos", t.bumperScore]);
    if (t.rampScore > 0) lines.push(["Ramp jumps", t.rampScore]);

    if (perfect) {
      lines.push(["PERFECT PARK", S.perfectPark + S.perfectAlign]);
    } else if (alignDeg <= TUNING.parking.perfectAlignDeg) {
      lines.push(["Perfect alignment", S.perfectAlign]);
    } else if (alignDeg <= TUNING.parking.goodAlignDeg) {
      lines.push(["Good alignment", S.goodAlign]);
    }

    if (t.attemptIndex === 0) lines.push(["First try!", S.firstTry]);
    if (!t.crashed) lines.push(["No damage", S.noDamage]);
    if (t.crashPenalty > 0) lines.push(["Crashes", -t.crashPenalty]);

    let total = lines.reduce((sum, [, v]) => sum + v, 0);
    if (t.attemptIndex > 0) {
      total = Math.round(total * Math.pow(S.extraAttemptFactor, t.attemptIndex));
      lines.push([`Attempt ${t.attemptIndex + 1} used`, 0]);
    }
    total = Math.max(0, total);

    let stars = 1;
    if (total >= starScores[1]) stars = 2;
    if (total >= starScores[2] || perfect) stars = 3;

    return { total, base: S.parkBase, bonusLines: lines, stars, coins: t.coins, perfect };
  }
}
