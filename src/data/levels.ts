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
  // ── 1 · straight shot, but the mouth is guarded ──────────────────
  {
    id: 1,
    world: "sunny_lot",
    name: "First Park",
    hint: "Drag back, aim at the glowing spot, release!",
    ground: { width: 10, depth: 16 },
    start: { x: 0, z: -5.8, angle: 0 },
    target: { x: 0, z: 5.4, rotation: 0, width: 2.6, length: 4.0 },
    attempts: 3,
    starScores: [1000, 1700, 2300],
    objects: [
      // pillars narrow the approach: straight is right, but not *any* straight
      { type: "wall", x: -2.5, z: 3.0, w: 0.5, d: 1.6 },
      { type: "wall", x: 2.5, z: 3.0, w: 0.5, d: 1.6 },
      { type: "coin", x: 0, z: 0 },
      { type: "coin", x: 0, z: 2.0 },
      { type: "cone", x: -3.6, z: 0.5 },
      { type: "cone", x: 3.6, z: 0.5 },
    ],
  },

  // ── 2 · bumper redirect: the direct lane is walled off ───────────
  {
    id: 2,
    world: "sunny_lot",
    name: "Bounce In",
    hint: "Blocked head-on. Kiss the bumper to swing across.",
    ground: { width: 11, depth: 16 },
    start: { x: -3.0, z: -5.8, angle: 0 },
    target: { x: 3.3, z: 5.4, rotation: 0, width: 2.5, length: 4.0 },
    attempts: 3,
    starScores: [1000, 1750, 2400],
    objects: [
      { type: "bumper", x: -0.8, z: 0.2, force: 15 },
      // baffle blocks the lazy straight lane, but the bay mouth stays open
      { type: "wall", x: 1.0, z: 0.4, w: 0.5, d: 3.4 },
      { type: "coin", x: 1.8, z: 2.4 },
      { type: "coin", x: 2.8, z: 3.4 },
      { type: "cone", x: -4.0, z: 3.2 },
      { type: "cone", x: -3.0, z: 3.8 },
    ],
  },

  // ── 3 · coin trail around a long barrier ─────────────────────────
  {
    id: 3,
    world: "sunny_lot",
    name: "Coin Trail",
    hint: "Ride the wall around. The middle is sealed.",
    ground: { width: 12, depth: 16 },
    start: { x: 3.8, z: -5.8, angle: 0 },
    target: { x: -3.6, z: 5.4, rotation: 0, width: 2.5, length: 4.0 },
    attempts: 3,
    starScores: [1100, 1900, 2600],
    objects: [
      // central spine forces the long way round, but leaves room to swing wide
      { type: "wall", x: 1.2, z: 0.4, w: 5.4, d: 0.55 },
      { type: "coin", x: 4.6, z: -2.5 },
      { type: "coin", x: 5.0, z: -0.3 },
      { type: "coin", x: 4.6, z: 2.0 },
      { type: "coin", x: 3.0, z: 3.8 },
      { type: "coin", x: 0.6, z: 4.8 },
      { type: "coin", x: -1.6, z: 5.0 },
      { type: "hazard", x: -4.4, z: -1.4, radius: 1.1 },
      { type: "cone", x: -4.6, z: 1.4 },
    ],
  },

  // ── 4 · power control: short lane, pits at the back ──────────────
  {
    id: 4,
    world: "sunny_lot",
    name: "Soft Touch",
    hint: "Gently! Overshoot and you drop straight in.",
    ground: { width: 10, depth: 14 },
    start: { x: 0, z: -4.8, angle: 0 },
    target: { x: 0, z: 1.0, rotation: 0, width: 2.5, length: 3.8 },
    attempts: 3,
    starScores: [1000, 1800, 2500],
    objects: [
      // wall-to-wall pits: overshooting drops the car at any angle
      { type: "hazard", x: -3.0, z: 4.6, radius: 1.3 },
      { type: "hazard", x: -1.0, z: 5.0, radius: 1.3 },
      { type: "hazard", x: 1.0, z: 5.0, radius: 1.3 },
      { type: "hazard", x: 3.0, z: 4.6, radius: 1.3 },
      // funnel: only a well-judged, near-straight shot threads it
      { type: "wall", x: -2.0, z: -0.8, w: 0.5, d: 2.0, rot: 25 },
      { type: "wall", x: 2.0, z: -0.8, w: 0.5, d: 2.0, rot: -25 },
      { type: "coin", x: 0, z: -2.4 },
      { type: "coin", x: 0, z: 1.0 },
      { type: "cone", x: -3.6, z: 1.0 },
      { type: "cone", x: 3.6, z: 1.0 },
    ],
  },

  // ── 5 · ramp jump over a fence, land in a narrow bay ─────────────
  {
    id: 5,
    world: "sunny_lot",
    name: "Ramp It",
    hint: "Hit the ramp fast and straight to clear the fence!",
    ground: { width: 11, depth: 18 },
    start: { x: 0, z: -6.8, angle: 0 },
    target: { x: 0, z: 6.4, rotation: 0, width: 2.7, length: 4.0 },
    attempts: 3,
    starScores: [1200, 2000, 2700],
    objects: [
      { type: "ramp", x: 0, z: -1.2, rot: 0, w: 2.6, l: 2.2 },
      { type: "wall", x: 0, z: 1.2, w: 11, d: 0.5, h: 0.85 },
      // miss the ramp and you're funnelled into a pit
      { type: "hazard", x: -3.6, z: -1.0, radius: 1.2 },
      { type: "hazard", x: 3.6, z: -1.0, radius: 1.2 },
      // landing zone is fenced: overshoot bounces back
      { type: "wall", x: -2.4, z: 4.6, w: 0.5, d: 2.4 },
      { type: "wall", x: 2.4, z: 4.6, w: 0.5, d: 2.4 },
      { type: "coin", x: 0, z: 0.4 },
      { type: "coin", x: 0, z: 2.4 },
      { type: "coin", x: 0, z: 3.8 },
      { type: "cone", x: -1.8, z: -1.2 },
      { type: "cone", x: 1.8, z: -1.2 },
    ],
  },

  // ── 6 · dense bumper field, target behind the storm ──────────────
  {
    id: 6,
    world: "sunny_lot",
    name: "Pinball Alley",
    hint: "Chaos. Ride the bounces into the bay!",
    ground: { width: 12, depth: 18 },
    start: { x: 0, z: -6.8, angle: 0 },
    target: { x: 0, z: 6.6, rotation: 0, width: 2.5, length: 3.8 },
    attempts: 3,
    starScores: [1300, 2200, 3100],
    objects: [
      { type: "bumper", x: -2.6, z: -2.0 },
      { type: "bumper", x: 2.6, z: -2.0 },
      { type: "bumper", x: 0, z: 0.4 },
      { type: "bumper", x: -3.0, z: 2.4 },
      { type: "bumper", x: 3.0, z: 2.4 },
      // guard rails so the bay must be entered from the front
      { type: "wall", x: -2.4, z: 6.6, w: 0.5, d: 3.0 },
      { type: "wall", x: 2.4, z: 6.6, w: 0.5, d: 3.0 },
      { type: "coin", x: -1.3, z: -0.8 },
      { type: "coin", x: 1.3, z: -0.8 },
      { type: "coin", x: 0, z: 2.6 },
    ],
  },

  // ── 7 · true bank shot: front totally sealed ─────────────────────
  {
    id: 7,
    world: "sunny_lot",
    name: "Bank Shot",
    hint: "No way through. Bank off the side wall!",
    ground: { width: 12, depth: 16 },
    start: { x: 0, z: -5.8, angle: 0 },
    target: { x: 0, z: 5.2, rotation: 90, width: 2.5, length: 3.8 },
    attempts: 3,
    starScores: [1100, 1900, 2700],
    objects: [
      // shield seals the direct line; the flanks stay open for a bank shot
      { type: "wall", x: 0, z: 2.4, w: 6.2, d: 0.55 },
      { type: "coin", x: -4.8, z: 0.6 },
      { type: "coin", x: 4.8, z: 0.6 },
      { type: "coin", x: -3.4, z: 4.0 },
      { type: "coin", x: 3.4, z: 4.0 },
      { type: "cone", x: 0, z: -0.6 },
    ],
  },

  // ── 8 · tight pit slalom with a moving-gate feel ─────────────────
  {
    id: 8,
    world: "sunny_lot",
    name: "Pothole Alley",
    hint: "Mind the holes! Thread every gap.",
    ground: { width: 11, depth: 18 },
    start: { x: 0, z: -6.8, angle: 0 },
    target: { x: 0, z: 6.6, rotation: 0, width: 2.6, length: 3.8 },
    attempts: 3,
    starScores: [1100, 1900, 2700],
    objects: [
      // three staggered chicanes; each gap is barely wider than the car
      { type: "hazard", x: -1.7, z: -2.6, radius: 1.35 },
      { type: "hazard", x: 3.2, z: -2.2, radius: 1.2 },
      { type: "hazard", x: 2.2, z: 0.6, radius: 1.35 },
      { type: "hazard", x: -3.2, z: 1.0, radius: 1.2 },
      { type: "hazard", x: -1.9, z: 3.6, radius: 1.35 },
      { type: "hazard", x: 3.0, z: 3.8, radius: 1.2 },
      { type: "wall", x: -4.6, z: -0.6, w: 0.5, d: 2.0 },
      { type: "wall", x: 4.6, z: 2.2, w: 0.5, d: 2.0 },
      { type: "coin", x: 0.7, z: -2.4 },
      { type: "coin", x: -0.5, z: 0.6 },
      { type: "coin", x: 0.6, z: 3.4 },
    ],
  },

  // ── 9 · decoy: the trap sits on the natural line ─────────────────
  {
    id: 9,
    world: "sunny_lot",
    name: "The Decoy",
    hint: "Park in the GREEN spot. The grey one is a trap!",
    ground: { width: 12, depth: 18 },
    start: { x: 0, z: -6.8, angle: 0 },
    target: { x: -3.6, z: 6.4, rotation: 0, width: 2.5, length: 3.8 },
    attempts: 3,
    starScores: [1100, 1900, 2700],
    objects: [
      // decoy straight ahead, right where a lazy shot lands
      { type: "decoy", x: 0.8, z: 5.6, rotation: 0 },
      { type: "decoy", x: 4.2, z: 3.0, rotation: 90 },
      // bumper is the only clean way to swing left
      { type: "bumper", x: -1.4, z: 1.2, force: 15 },
      { type: "wall", x: -5.0, z: 2.0, w: 0.5, d: 3.0 },
      { type: "hazard", x: 2.6, z: 0.0, radius: 1.2 },
      { type: "coin", x: -3.4, z: 3.4 },
      { type: "coin", x: -4.0, z: 4.8 },
      { type: "cone", x: 4.6, z: -1.0 },
    ],
  },

  // ── 10 · perfect-park gauntlet ───────────────────────────────────
  {
    id: 10,
    world: "sunny_lot",
    name: "Parking Wizard",
    hint: "Tight spot, guarded. Line it up for a PERFECT park!",
    ground: { width: 12, depth: 18 },
    start: { x: 0, z: -6.8, angle: 0 },
    target: { x: 0, z: 6.2, rotation: 0, width: 2.1, length: 3.6 },
    attempts: 3,
    starScores: [1400, 2300, 3200],
    objects: [
      // bumper gate guarding the bay mouth
      { type: "bumper", x: -1.7, z: 2.6, radius: 0.55 },
      { type: "bumper", x: 1.7, z: 2.6, radius: 0.55 },
      // narrow bay walls
      { type: "wall", x: -1.95, z: 6.2, w: 0.5, d: 4.0 },
      { type: "wall", x: 1.95, z: 6.2, w: 0.5, d: 4.0 },
      // pits pinch the run-up
      { type: "hazard", x: -3.4, z: -1.8, radius: 1.15 },
      { type: "hazard", x: 3.4, z: -1.8, radius: 1.15 },
      { type: "hazard", x: -4.2, z: 3.2, radius: 1.1 },
      { type: "hazard", x: 4.2, z: 3.2, radius: 1.1 },
      { type: "coin", x: 0, z: -3.0 },
      { type: "coin", x: 0, z: 0.0 },
      { type: "coin", x: 0, z: 4.4 },
    ],
  },
];

export function getWorld(id: string): WorldData {
  return WORLDS.find((w) => w.id === id) ?? WORLDS[0];
}
