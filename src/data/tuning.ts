/**
 * Every gameplay-feel constant in one place.
 * Tune here, not inside systems.
 */
export const TUNING = {
  physics: {
    fixedStep: 1 / 120, // s — physics substep
    gravity: -22, // u/s² — snappier than real gravity, toy scale
    carRadius: 0.45, // collision circle radius
    groundDamping: 0.42, // velocity retained per second on ground (range ≈ v0 / 0.87)
    airDamping: 0.985,
    stopSpeed: 0.35, // below this the car settles
    stopSettleTime: 0.35, // s below stopSpeed before "stopped"
    maxSpeed: 30,
    wallRestitution: 0.62,
    wallCrashSpeed: 9, // impact speed that counts as a "crash"
    headingTurnRate: 10, // how fast the visual car turns to face velocity
    spinDecay: 4, // angular velocity decay
    maxSpin: 9, // rad/s clamp (anti-spin)
    outOfBoundsY: -6, // fell below arena → fail
    fallEdgeMargin: 0.1, // how far past ground edge before falling
  },

  launch: {
    minDrag: 0.06, // fraction of screen min-dimension before a launch is valid
    maxDrag: 0.42, // drag distance for full power
    minPower: 5, // launch speed at minimum valid drag
    maxPower: 22, // launch speed at full drag
    powerCurve: 1.35, // >1 → finer control at low power
    aimDotCount: 9,
    aimDotSpacing: 0.62,
  },

  parking: {
    maxParkSpeed: 1.6, // must be slower than this inside the spot
    dwellTime: 0.6, // s inside + slow before success
    insideInset: 0.9, // fraction of spot half-size the center must be within
    magnetK: 6, // spring pull toward spot center (assist)
    magnetC: 4.5, // spring damping (≈ critically damped)
    magnetMaxSpeed: 3.5, // assist engages below this speed
    entryBrake: 0.45, // extra damping while entering the spot fast
    perfectCenterDist: 0.55,
    perfectAlignDeg: 10,
    goodAlignDeg: 25,
    okAlignDeg: 40, // beyond this: parked but sloppy (still succeeds)
  },

  bumper: {
    defaultRadius: 0.7,
    defaultForce: 13,
    cooldown: 0.25, // s between impulses from the same bumper
    minExitSpeed: 8, // guaranteed speed leaving a bumper
  },

  ramp: {
    minSpeed: 4, // slower than this: no jump
    liftFactor: 0.55, // vy = speed * liftFactor
    boost: 1.05, // forward speed multiplier on takeoff
    landAbsorb: 0.55, // horizontal speed kept after landing a jump
  },

  attempt: {
    maxTime: 12, // s before the attempt times out
    stuckSpeed: 0.9,
    stuckTime: 2.5, // s barely moving (outside spot) → resolve
    failResetDelay: 0.9, // s to show the funny result before reset
  },

  score: {
    parkBase: 1000,
    coin: 10,
    firstTry: 700,
    perfectAlign: 500,
    goodAlign: 250,
    bumperHit: 50, // × combo multiplier
    rampJump: 200,
    noDamage: 300,
    perfectPark: 500,
    crashPenalty: 100,
    maxCrashPenalty: 300,
    extraAttemptFactor: 0.85, // final score × this per extra attempt used
  },

  combo: {
    window: 2.2, // s between events to keep the chain
    maxMultiplier: 5,
  },

  camera: {
    alpha: -Math.PI / 2, // look "up" the arena (+z away from camera)
    beta: 0.92, // ~53° from vertical — isometric-ish
    followLerp: 4.2,
    radiusLerp: 3.0,
    speedZoom: 0.28, // extra radius per unit of speed
    minRadius: 10,
    shakeDecay: 6,
    successZoomFactor: 0.72,
  },

  effects: {
    slowMoScale: 0.3,
    slowMoDuration: 1.1, // s (real time)
    hitShake: 0.22,
    crashShake: 0.5,
  },
} as const;
