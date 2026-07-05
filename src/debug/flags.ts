interface UrlFlags {
  readonly debug: boolean;
  readonly nojuice: boolean;
  readonly unlockAll: boolean;
}

let cached: UrlFlags | null = null;

function readFlags(): UrlFlags {
  if (cached === null) {
    const search = typeof window === "undefined" ? "" : window.location.search;
    const params = new URLSearchParams(search);
    cached = {
      debug: params.get("debug") === "1",
      nojuice: params.get("nojuice") === "1",
      unlockAll: params.get("unlockall") === "1",
    };
  }
  return cached;
}

export function isDebugEnabled(): boolean {
  return readFlags().debug;
}

export function isJuiceDisabled(): boolean {
  return readFlags().nojuice;
}

/**
 * `?unlockall=1` — testing affordance: every level is playable from the level
 * select regardless of saved progress. Display/gating only; it never writes to
 * the save, so removing the flag restores the real unlock chain untouched.
 */
export function isAllLevelsUnlocked(): boolean {
  return readFlags().unlockAll;
}
