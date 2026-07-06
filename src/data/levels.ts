/**
 * Data-driven level definitions.
 *
 * Coordinate system: arena centered at origin, X = right, Z = away from
 * camera. The car starts near -Z and usually parks near +Z.
 * All rotations in level data are DEGREES (converted at spawn time).
 * Rotation 0 means "long axis along Z".
 */

export interface SpotData {
  x: number;
  z: number;
  rotation: number; // degrees
  width: number;
  length: number;
}

export type LevelObjectData =
  | { type: "wall"; x: number; z: number; w: number; d: number; rot?: number; h?: number }
  | { type: "bumper"; x: number; z: number; radius?: number; force?: number }
  | { type: "coin"; x: number; z: number; value?: number }
  | { type: "ramp"; x: number; z: number; rot?: number; w?: number; l?: number }
  | { type: "hazard"; x: number; z: number; radius?: number }
  | { type: "decoy"; x: number; z: number; rotation?: number; width?: number; length?: number }
  | { type: "cone"; x: number; z: number };

export interface LevelData {
  id: number;
  world: string;
  name: string;
  hint?: string;
  ground: { width: number; depth: number };
  start: { x: number; z: number; angle: number }; // angle degrees, 0 = facing +Z
  target: SpotData;
  attempts: number;
  starScores: [number, number, number];
  objects: LevelObjectData[];
}

export interface WorldData {
  id: string;
  name: string;
  ground: string; // hex color
  accent: string;
}

export const WORLDS: WorldData[] = [
  { id: "sunny_lot", name: "Sunny Parking Lot", ground: "#8d9db6", accent: "#7ed957" },
  { id: "mall", name: "Shopping Mall Madness", ground: "#9b8db6", accent: "#ff8b5e" },
  { id: "rooftop", name: "Rooftop Garage", ground: "#7a8699", accent: "#55c8f5" },
];

export const LEVELS: LevelData[] = [
  // ── 1 · straight shot ────────────────────────────────────────────
  {
    id: 1,
    world: "sunny_lot",
    name: "First Park",
    hint: "Drag back, aim at the glowing spot, release!",
    ground: { width: 10, depth: 16 },
    start: { x: 0, z: -5.8, angle: 0 },
    target: { x: 0, z: 5.4, rotation: 0, width: 2.8, length: 4.2 },
    attempts: 3,
    starScores: [1000, 1700, 2300],
    objects: [
      { type: "coin", x: 0, z: 0 },
      { type: "cone", x: -2.6, z: 2.5 },
      { type: "cone", x: 2.6, z: 2.5 },
    ],
  },

  // ── 2 · one bumper redirect ──────────────────────────────────────
  {
    id: 2,
    world: "sunny_lot",
    name: "Bounce In",
    hint: "Use the bumper — or curve around it.",
    ground: { width: 11, depth: 16 },
    start: { x: -2.5, z: -5.8, angle: 0 },
    target: { x: 3.2, z: 5.2, rotation: 0, width: 2.7, length: 4.2 },
    attempts: 3,
    starScores: [1000, 1750, 2400],
    objects: [
      { type: "bumper", x: -0.5, z: 0.6 },
      { type: "coin", x: 1.4, z: 2.6 },
      { type: "coin", x: 2.3, z: 3.6 },
      { type: "cone", x: -3.8, z: 3 },
      { type: "cone", x: -2.8, z: 3.6 },
    ],
  },

  // ── 3 · coins guide the route ────────────────────────────────────
  {
    id: 3,
    world: "sunny_lot",
    name: "Coin Trail",
    hint: "Follow the coins off the wall.",
    ground: { width: 12, depth: 16 },
    start: { x: 3.5, z: -5.8, angle: 0 },
    target: { x: -3.4, z: 5.2, rotation: 0, width: 2.7, length: 4.2 },
    attempts: 3,
    starScores: [1100, 1900, 2600],
    objects: [
      { type: "coin", x: 4.2, z: -2.5 },
      { type: "coin", x: 4.8, z: -0.5 },
      { type: "coin", x: 4.4, z: 1.6 },
      { type: "coin", x: 3.0, z: 3.2 },
      { type: "coin", x: 1.0, z: 4.2 },
      { type: "coin", x: -1.2, z: 4.7 },
      { type: "wall", x: 0.5, z: 0.5, w: 3.4, d: 0.6 },
      { type: "cone", x: -4.4, z: 0 },
    ],
  },

  // ── 4 · power control ────────────────────────────────────────────
  {
    id: 4,
    world: "sunny_lot",
    name: "Soft Touch",
    hint: "Gently! Overshoot and you hit the oil.",
    ground: { width: 10, depth: 14 },
    start: { x: 0, z: -4.8, angle: 0 },
    target: { x: 0, z: 1.2, rotation: 0, width: 2.8, length: 4.0 },
    attempts: 3,
    starScores: [1000, 1800, 2500],
    objects: [
      { type: "hazard", x: -1.6, z: 4.8, radius: 1.2 },
      { type: "hazard", x: 1.6, z: 4.8, radius: 1.2 },
      { type: "hazard", x: 0, z: 5.6, radius: 1.2 },
      { type: "coin", x: 0, z: -2 },
      { type: "cone", x: -2.8, z: 1.2 },
      { type: "cone", x: 2.8, z: 1.2 },
    ],
  },

  // ── 5 · ramp jump ────────────────────────────────────────────────
  {
    id: 5,
    world: "sunny_lot",
    name: "Ramp It",
    hint: "Hit the ramp fast to clear the fence!",
    ground: { width: 11, depth: 18 },
    start: { x: 0, z: -6.8, angle: 0 },
    target: { x: 0, z: 6.2, rotation: 0, width: 3.0, length: 4.2 },
    attempts: 3,
    starScores: [1200, 2000, 2700],
    objects: [
      { type: "ramp", x: 0, z: -1.2, rot: 0, w: 3.2, l: 2.2 },
      { type: "wall", x: 0, z: 1.2, w: 11, d: 0.5, h: 0.75 },
      { type: "coin", x: 0, z: 0.4 },
      { type: "coin", x: 0, z: 2.2 },
      { type: "coin", x: 0, z: 3.6 },
      { type: "cone", x: -3.4, z: -1.2 },
      { type: "cone", x: 3.4, z: -1.2 },
    ],
  },

  // ── 6 · bumper combo alley ───────────────────────────────────────
  {
    id: 6,
    world: "sunny_lot",
    name: "Pinball Alley",
    hint: "More bounces, more points!",
    ground: { width: 12, depth: 18 },
    start: { x: 0, z: -6.8, angle: 0 },
    target: { x: 0, z: 6.4, rotation: 0, width: 2.7, length: 4.0 },
    attempts: 3,
    starScores: [1300, 2200, 3100],
    objects: [
      { type: "bumper", x: -2.4, z: -1.5 },
      { type: "bumper", x: 2.4, z: -1.5 },
      { type: "bumper", x: 0, z: 1.0 },
      { type: "bumper", x: -2.8, z: 3.2 },
      { type: "bumper", x: 2.8, z: 3.2 },
      { type: "coin", x: -1.2, z: -0.2 },
      { type: "coin", x: 1.2, z: -0.2 },
      { type: "coin", x: 0, z: 2.6 },
    ],
  },

  // ── 7 · rebound bank shot ────────────────────────────────────────
  {
    id: 7,
    world: "sunny_lot",
    name: "Bank Shot",
    hint: "The front is blocked. Bounce off a wall!",
    ground: { width: 12, depth: 16 },
    start: { x: 0, z: -5.8, angle: 0 },
    target: { x: 0, z: 5.0, rotation: 90, width: 2.6, length: 4.0 },
    attempts: 3,
    starScores: [1100, 1900, 2700],
    objects: [
      { type: "wall", x: 0, z: 2.4, w: 5.4, d: 0.55 },
      { type: "coin", x: -4.6, z: 0.5 },
      { type: "coin", x: 4.6, z: 0.5 },
      { type: "coin", x: -3.6, z: 3.8 },
      { type: "coin", x: 3.6, z: 3.8 },
      { type: "cone", x: 0, z: -0.5 },
    ],
  },

  // ── 8 · hazard slalom ────────────────────────────────────────────
  {
    id: 8,
    world: "sunny_lot",
    name: "Oil Slalom",
    hint: "Oil means game over. Thread the gap!",
    ground: { width: 11, depth: 18 },
    start: { x: 0, z: -6.8, angle: 0 },
    target: { x: 0, z: 6.4, rotation: 0, width: 2.8, length: 4.0 },
    attempts: 3,
    starScores: [1100, 1900, 2700],
    objects: [
      { type: "hazard", x: -2.0, z: -2.0, radius: 1.35 },
      { type: "hazard", x: 2.4, z: 0.4, radius: 1.35 },
      { type: "hazard", x: -2.2, z: 2.8, radius: 1.35 },
      { type: "coin", x: 0.6, z: -2.2 },
      { type: "coin", x: -0.4, z: 0.4 },
      { type: "coin", x: 0.8, z: 2.9 },
      { type: "cone", x: 4.2, z: -3 },
    ],
  },

  // ── 9 · decoy parking spot ───────────────────────────────────────
  {
    id: 9,
    world: "sunny_lot",
    name: "The Decoy",
    hint: "Park in the GREEN spot. The grey one is a trap!",
    ground: { width: 12, depth: 18 },
    start: { x: 0, z: -6.8, angle: 0 },
    target: { x: -3.4, z: 6.2, rotation: 0, width: 2.7, length: 4.0 },
    attempts: 3,
    starScores: [1100, 1900, 2700],
    objects: [
      { type: "decoy", x: 0.6, z: 3.4, rotation: 0 },
      { type: "bumper", x: -2.6, z: 0.8 },
      { type: "coin", x: -3.6, z: 3.2 },
      { type: "coin", x: -4.0, z: 4.4 },
      { type: "cone", x: 3.8, z: 0 },
      { type: "cone", x: 4.4, z: 1 },
    ],
  },

  // ── 10 · perfect parking challenge ───────────────────────────────
  {
    id: 10,
    world: "sunny_lot",
    name: "Parking Wizard",
    hint: "Tight spot. Line it up for a PERFECT park!",
    ground: { width: 12, depth: 18 },
    start: { x: 0, z: -6.8, angle: 0 },
    target: { x: 0, z: 6.0, rotation: 0, width: 2.2, length: 3.8 },
    attempts: 3,
    starScores: [1400, 2300, 3200],
    objects: [
      { type: "bumper", x: -1.9, z: 2.4, radius: 0.6 },
      { type: "bumper", x: 1.9, z: 2.4, radius: 0.6 },
      { type: "wall", x: -2.1, z: 6.0, w: 0.5, d: 4.2 },
      { type: "wall", x: 2.1, z: 6.0, w: 0.5, d: 4.2 },
      { type: "hazard", x: -3.6, z: -1.4, radius: 1.1 },
      { type: "hazard", x: 3.6, z: -1.4, radius: 1.1 },
      { type: "coin", x: 0, z: -2.4 },
      { type: "coin", x: 0, z: 0.2 },
      { type: "coin", x: 0, z: 2.8 },
    ],
  },
];

export function getWorld(id: string): WorldData {
  return WORLDS.find((w) => w.id === id) ?? WORLDS[0];
}
