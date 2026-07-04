interface UrlFlags {
  readonly debug: boolean;
  readonly nojuice: boolean;
}

let cached: UrlFlags | null = null;

function readFlags(): UrlFlags {
  if (cached === null) {
    const search = typeof window === "undefined" ? "" : window.location.search;
    const params = new URLSearchParams(search);
    cached = {
      debug: params.get("debug") === "1",
      nojuice: params.get("nojuice") === "1",
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
