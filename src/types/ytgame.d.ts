/**
 * Ambient declarations for the YouTube Playables SDK.
 *
 * The SDK is delivered by a plain <script> tag in index.html and exposes a
 * global `ytgame` namespace — there is no npm package to import. Mirrors the
 * official index.d.ts:
 * https://www.youtube.com/playablesportal/static/youtube_ytgame_web_deploy_mpm_files/index.d.ts
 *
 * `ytgame` is absent entirely when the page is served outside YouTube, so
 * every access must be guarded (see core/Playables.ts).
 */
declare namespace ytgame {
  const enum SdkErrorType {
    UNKNOWN = 0,
    API_UNAVAILABLE = 1,
    INVALID_PARAMS = 2,
    SIZE_LIMIT_EXCEEDED = 3,
  }

  class SdkError extends Error {
    errorType: SdkErrorType;
  }

  const IN_PLAYABLES_ENV: boolean;
}

declare namespace ytgame.game {
  /** Signal that the first frame has rendered. Required, or the game never shows. */
  function firstFrameReady(): void;
  /** Signal that the game is interactive. Must not be called over a loading screen. */
  function gameReady(): void;
  /** Resolves with whatever string was last passed to saveData (or ""). */
  function loadData(): Promise<string>;
  /** Persist a well-formed UTF-16 string, max 3 MiB. */
  function saveData(data: string): Promise<void>;
}

declare namespace ytgame.system {
  function isAudioEnabled(): boolean;
  /** Returns an unsubscribe function. */
  function onAudioEnabledChange(callback: (isAudioEnabled: boolean) => void): () => void;
  /** Returns an unsubscribe function. The game may be evicted without resuming. */
  function onPause(callback: () => void): () => void;
  /** Returns an unsubscribe function. */
  function onResume(callback: () => void): () => void;
}

declare namespace ytgame.engagement {
  interface Score {
    /** Must be an integer, no larger than Number.MAX_SAFE_INTEGER. */
    value: number;
  }
  /** YouTube surfaces the highest value ever sent. Pick one dimension. */
  function sendScore(score: Score): Promise<void>;
}

declare namespace ytgame.health {
  function logError(): void;
  function logWarning(): void;
}
