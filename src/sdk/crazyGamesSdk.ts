import { NullSdk, type PortalSdk } from "./PortalSdk";

const SDK_SRC = "https://sdk.crazygames.com/crazygames-sdk-v3.js";

const LOAD_TIMEOUT_MS = 8000;

const INIT_TIMEOUT_MS = 8000;

const AD_TIMEOUT_MS = 12000;

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const done = (value: T): void => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    const timer = setTimeout(() => {
      done(fallback);
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        done(value);
      },
      () => {
        clearTimeout(timer);
        done(fallback);
      },
    );
  });
}

const CLOUD_KEY = "shardling:v1";

interface CrazyAdCallbacks {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (error: unknown) => void;
}
interface CrazyGamesGlobal {
  SDK?: {
    init?: () => Promise<void>;
    game?: {
      gameplayStart?: () => void;
      gameplayStop?: () => void;
      happytime?: () => void;
    };
    ad?: {
      requestAd?: (type: string, callbacks: CrazyAdCallbacks) => void;
    };
    data?: {
      getItem?: (key: string) => string | null;
      setItem?: (key: string, value: string) => void;
      removeItem?: (key: string) => void;
    };
  };
}

function crazyGlobal(): CrazyGamesGlobal["SDK"] | undefined {
  return (globalThis as { CrazyGames?: CrazyGamesGlobal }).CrazyGames?.SDK;
}

interface ScriptLike {
  src: string;
  async: boolean;
  addEventListener: (type: string, listener: () => void) => void;
}
interface DocumentLike {
  head: { appendChild: (node: ScriptLike) => void } | null;
  createElement: (tag: "script") => ScriptLike;
}

export function isCrazyGamesHost(
  hostname: string = (globalThis as { location?: { hostname?: string } })
    .location?.hostname ?? "",
): boolean {
  return hostname === "crazygames.com" || hostname.endsWith(".crazygames.com");
}

function loadSdkScript(): Promise<boolean> {
  const doc = (globalThis as { document?: DocumentLike }).document;
  if (!doc?.head) {
    return Promise.resolve(false);
  }
  const head = doc.head;
  if (crazyGlobal()) {
    return Promise.resolve(true);
  }
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean): void => {
      if (!settled) {
        settled = true;
        resolve(ok);
      }
    };
    const timer = setTimeout(() => {
      finish(false);
    }, LOAD_TIMEOUT_MS);
    try {
      const script = doc.createElement("script");
      script.src = SDK_SRC;
      script.async = true;
      script.addEventListener("load", () => {
        clearTimeout(timer);
        finish(Boolean(crazyGlobal()));
      });
      script.addEventListener("error", () => {
        clearTimeout(timer);
        finish(false);
      });
      head.appendChild(script);
    } catch {
      clearTimeout(timer);
      finish(false);
    }
  });
}

class CrazyGamesSdk implements PortalSdk {
  init(): Promise<void> {
    let call: Promise<void>;
    try {
      call = Promise.resolve(crazyGlobal()?.init?.());
    } catch {
      return Promise.resolve();
    }
    return withTimeout(
      call.then(
        () => undefined,
        () => undefined,
      ),
      INIT_TIMEOUT_MS,
      undefined,
    );
  }

  gameplayStart(): void {
    try {
      crazyGlobal()?.game?.gameplayStart?.();
    } catch {}
  }

  gameplayStop(): void {
    try {
      crazyGlobal()?.game?.gameplayStop?.();
    } catch {}
  }

  celebrate(): void {
    try {
      crazyGlobal()?.game?.happytime?.();
    } catch {}
  }

  midgameAd(): Promise<void> {
    return this.requestAd("midgame").then(() => undefined);
  }

  rewardedAd(): Promise<boolean> {
    return this.requestAd("rewarded");
  }

  private requestAd(type: "midgame" | "rewarded"): Promise<boolean> {
    const ad = crazyGlobal()?.ad;
    if (!ad?.requestAd) {
      return Promise.resolve(false);
    }
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const done = (ok: boolean): void => {
        if (!settled) {
          settled = true;
          resolve(ok);
        }
      };
      const timer = setTimeout(() => {
        done(false);
      }, AD_TIMEOUT_MS);
      try {
        ad.requestAd?.(type, {
          adFinished: () => {
            clearTimeout(timer);
            done(true);
          },
          adError: () => {
            clearTimeout(timer);
            done(false);
          },
        });
      } catch {
        clearTimeout(timer);
        done(false);
      }
    });
  }

  cloudSave(data: string): Promise<void> {
    try {
      crazyGlobal()?.data?.setItem?.(CLOUD_KEY, data);
    } catch {}
    return Promise.resolve();
  }

  cloudLoad(): Promise<string | null> {
    try {
      return Promise.resolve(crazyGlobal()?.data?.getItem?.(CLOUD_KEY) ?? null);
    } catch {
      return Promise.resolve(null);
    }
  }
}

export async function selectPortalSdk(): Promise<PortalSdk> {
  if (!isCrazyGamesHost()) {
    const sdk = new NullSdk();
    await sdk.init();
    return sdk;
  }
  const loaded = await loadSdkScript();
  if (!loaded) {
    const sdk = new NullSdk();
    await sdk.init();
    return sdk;
  }
  const sdk = new CrazyGamesSdk();
  await sdk.init();
  return sdk;
}
