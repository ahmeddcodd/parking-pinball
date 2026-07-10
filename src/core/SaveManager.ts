/**
 * Versioned save, persisted to YouTube's cloud storage.
 *
 * There is deliberately NO localStorage path: on Playables the cloud is the
 * only sanctioned store, and off-platform (local dev, plain web host) the SDK
 * is inert, so we fall back to an in-memory store that resets on reload.
 *
 * Writes are coalesced. Callers still mutate `data` and call `save()` exactly
 * as before, but `save()` only marks the state dirty and schedules a flush —
 * so `addCoins()` + `recordResult()` back-to-back become one network write.
 * `flush()` forces the write immediately (used when YouTube pauses us and may
 * evict the game before a timer would ever fire).
 */
import { inPlayables, loadData, saveData } from "./Playables";

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

const VERSION = 1;

/** How long to wait for further mutations before writing. */
const FLUSH_DELAY_MS = 250;

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

/** Storage backend. Both implementations swallow their own failures. */
interface SaveBackend {
  load(): Promise<string | null>;
  save(payload: string): Promise<void>;
}

/** YouTube cloud storage. */
class CloudBackend implements SaveBackend {
  load(): Promise<string | null> {
    return loadData();
  }
  async save(payload: string): Promise<void> {
    await saveData(payload); // resolves false on failure; already logged
  }
}

/** Off-platform fallback. Progress lives for the session only. */
class MemoryBackend implements SaveBackend {
  private blob: string | null = null;
  async load(): Promise<string | null> {
    return this.blob;
  }
  async save(payload: string): Promise<void> {
    this.blob = payload;
  }
}

function parse(raw: string | null): SaveData {
  if (!raw) return defaults();
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || parsed.version !== VERSION) {
      return defaults();
    }
    return { ...defaults(), ...parsed };
  } catch {
    return defaults();
  }
}

export class SaveManager {
  data: SaveData;

  private backend: SaveBackend;
  private timer: number | null = null;
  private dirty = false;
  /** Serialises writes so a slow flush can't be overtaken by a newer one. */
  private writing: Promise<void> = Promise.resolve();

  private constructor(backend: SaveBackend, data: SaveData) {
    this.backend = backend;
    this.data = data;
  }

  /**
   * Load the save before the game is constructed. Cloud reads are async, and
   * Game reads `data` synchronously from its constructor onward.
   */
  static async create(): Promise<SaveManager> {
    const backend: SaveBackend = inPlayables ? new CloudBackend() : new MemoryBackend();
    const raw = await backend.load();
    return new SaveManager(backend, parse(raw));
  }

  /** Mark dirty and schedule a coalesced write. */
  save(): void {
    this.dirty = true;
    if (this.timer !== null) return;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.write();
    }, FLUSH_DELAY_MS);
  }

  /**
   * Write right now, cancelling any pending timer. Returns the in-flight
   * write so callers may await it, but never rejects. Safe to call from a
   * synchronous platform callback that may be followed by eviction.
   */
  flush(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    return this.write();
  }

  private write(): Promise<void> {
    if (!this.dirty) return this.writing;
    this.dirty = false;
    const payload = JSON.stringify(this.data);
    this.writing = this.writing.then(() => this.backend.save(payload)).catch(() => {});
    return this.writing;
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
