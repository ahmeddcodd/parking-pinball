/**
 * Versioned localStorage save. Kept compact and behind one API so a
 * platform save system (YouTube Playables) can replace the backend later.
 */
export interface SaveData {
  version: number;
  unlockedLevel: number; // highest playable level id
  stars: Record<number, number>; // levelId -> 0..3
  scores: Record<number, number>; // levelId -> best score
  coins: number;
  ownedCars: number[];
  selectedCar: number;
  sound: boolean;
  music: boolean;
}

const KEY = "parking-pinball-save";
const VERSION = 1;

function defaults(): SaveData {
  return {
    version: VERSION,
    unlockedLevel: 1,
    stars: {},
    scores: {},
    coins: 0,
    ownedCars: [0],
    selectedCar: 0,
    sound: true,
    music: true,
  };
}

export class SaveManager {
  data: SaveData;

  constructor() {
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const parsed = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null || parsed.version !== VERSION) {
        return defaults();
      }
      return { ...defaults(), ...parsed };
    } catch {
      return defaults();
    }
  }

  save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // storage unavailable (private mode etc.) — play without persistence
    }
  }

  /** Record a level result; returns true if it beat the previous best. */
  recordResult(levelId: number, stars: number, score: number, totalLevels: number): boolean {
    const d = this.data;
    const prevBest = d.scores[levelId] ?? 0;
    if (stars > (d.stars[levelId] ?? 0)) d.stars[levelId] = stars;
    const isBest = score > prevBest;
    if (isBest) d.scores[levelId] = score;
    if (levelId >= d.unlockedLevel && levelId < totalLevels) {
      d.unlockedLevel = levelId + 1;
    }
    this.save();
    return isBest;
  }

  addCoins(amount: number): void {
    this.data.coins += amount;
    this.save();
  }

  buyCar(carId: number, cost: number): boolean {
    if (this.data.ownedCars.includes(carId)) return true;
    if (this.data.coins < cost) return false;
    this.data.coins -= cost;
    this.data.ownedCars.push(carId);
    this.save();
    return true;
  }

  selectCar(carId: number): void {
    if (this.data.ownedCars.includes(carId)) {
      this.data.selectedCar = carId;
      this.save();
    }
  }
}
