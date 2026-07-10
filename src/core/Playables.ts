/**
 * The only module that touches the YouTube Playables SDK.
 *
 * Outside YouTube the `ytgame` global is missing entirely (or present but
 * inert), so every entry point is guarded and every call is wrapped: a
 * missing SDK, an inert SDK, or a rejected promise must never break the
 * game. Keeping this boundary in one file also means the whole integration
 * can be exercised by stubbing a single global.
 */

/** Is the SDK present AND are we actually embedded in YouTube? */
export const inPlayables: boolean = (() => {
  try {
    return typeof ytgame !== "undefined" && ytgame.IN_PLAYABLES_ENV === true;
  } catch {
    return false;
  }
})();

/** SDK object exists (may be inert). Some calls are safe even off-YouTube. */
function hasSdk(): boolean {
  return typeof ytgame !== "undefined";
}

/** Best-effort diagnostic. Rate-limited by the platform; never throws. */
export function logError(): void {
  try {
    if (hasSdk() && ytgame.health) ytgame.health.logError();
  } catch {
    /* diagnostics must never break the game */
  }
}

function logWarning(): void {
  try {
    if (hasSdk() && ytgame.health) ytgame.health.logWarning();
  } catch {
    /* ignore */
  }
}

// ─────────────────────────────────────────────────────────── lifecycle

let firstFrameSent = false;
let gameReadySent = false;

/**
 * Tell YouTube the first frame has painted. Required — without it the game
 * is never shown to the user. Idempotent.
 */
export function firstFrameReady(): void {
  if (firstFrameSent || !inPlayables) return;
  firstFrameSent = true;
  try {
    ytgame.game.firstFrameReady();
  } catch {
    logError();
  }
}

/**
 * Tell YouTube the game is interactive. Must come after firstFrameReady and
 * only once no loading screen is visible (certification requirement).
 * Idempotent.
 */
export function gameReady(): void {
  if (gameReadySent || !inPlayables) return;
  if (!firstFrameSent) firstFrameReady(); // enforce ordering
  gameReadySent = true;
  try {
    ytgame.game.gameReady();
  } catch {
    logError();
  }
}

// ──────────────────────────────────────────────────────────── storage

/**
 * Load the saved blob. Resolves to null when there is nothing stored, the
 * SDK is absent, or the platform rejects (SdkError) — callers fall back to
 * defaults so a storage outage still yields a playable game.
 */
export async function loadData(): Promise<string | null> {
  if (!inPlayables) return null;
  try {
    const raw = await ytgame.game.loadData();
    return raw ? raw : null;
  } catch {
    logError();
    return null;
  }
}

/**
 * Persist a blob. Never rejects — failures are logged and swallowed, since
 * a lost save must not surface as an unhandled rejection mid-game.
 */
export async function saveData(payload: string): Promise<boolean> {
  if (!inPlayables) return false;
  try {
    await ytgame.game.saveData(payload);
    return true;
  } catch {
    logError();
    return false;
  }
}

// ────────────────────────────────────────────────────────────── audio

/**
 * YouTube's audio state. Authoritative: when this is false the game must be
 * silent regardless of the player's own sound settings. Defaults to `true`
 * off-platform so local play isn't mute.
 */
export function isAudioEnabled(): boolean {
  if (!inPlayables) return true;
  try {
    return ytgame.system.isAudioEnabled();
  } catch {
    logWarning();
    return true;
  }
}

type Unsubscribe = () => void;
const noop: Unsubscribe = () => {};

export function onAudioEnabledChange(cb: (enabled: boolean) => void): Unsubscribe {
  if (!inPlayables) return noop;
  try {
    return ytgame.system.onAudioEnabledChange(cb) ?? noop;
  } catch {
    logError();
    return noop;
  }
}

// ────────────────────────────────────────────────────────────── pause

/**
 * YouTube is pausing us. The callback gets only a short window before the
 * game may be evicted, and there is NO guarantee onResume ever fires — so
 * the handler must persist state immediately rather than defer it.
 */
export function onPause(cb: () => void): Unsubscribe {
  if (!inPlayables) return noop;
  try {
    return ytgame.system.onPause(cb) ?? noop;
  } catch {
    logError();
    return noop;
  }
}

export function onResume(cb: () => void): Unsubscribe {
  if (!inPlayables) return noop;
  try {
    return ytgame.system.onResume(cb) ?? noop;
  } catch {
    logError();
    return noop;
  }
}
