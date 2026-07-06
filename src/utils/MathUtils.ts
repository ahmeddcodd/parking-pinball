export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Frame-rate independent exponential smoothing toward a target. */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-rate * dt));
}

/** Wrap an angle to (-PI, PI]. */
export function wrapAngle(a: number): number {
  a = a % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

/** Shortest signed difference between two angles. */
export function angleDiff(a: number, b: number): number {
  return wrapAngle(a - b);
}

/** Smooth an angle toward a target along the shortest arc. */
export function dampAngle(current: number, target: number, rate: number, dt: number): number {
  return current + angleDiff(target, current) * (1 - Math.exp(-rate * dt));
}

/**
 * Alignment error (radians, 0..PI/2) between two headings where facing
 * either direction of the parking spot counts as aligned.
 */
export function alignmentError(yaw: number, spotRotation: number): number {
  let d = Math.abs(wrapAngle(yaw - spotRotation));
  if (d > Math.PI / 2) d = Math.PI - d;
  return d;
}

export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function degToRad(d: number): number {
  return (d * Math.PI) / 180;
}

export function radToDeg(r: number): number {
  return (r * 180) / Math.PI;
}
