import { afterEach, describe, expect, it, vi } from "vitest";

import { EventBus } from "../src/core/EventBus";
import { SaveManager, type StorageLike } from "../src/core/SaveManager";
import { isCrazyGamesHost } from "../src/sdk/crazyGamesSdk";
import { PortalBridge } from "../src/sdk/PortalBridge";
import { NullSdk, type PortalSdk } from "../src/sdk/PortalSdk";

function memStorage(seed?: Record<string, string>): StorageLike {
  const map = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

class FakeSdk implements PortalSdk {
  starts = 0;
  stops = 0;
  celebrations = 0;
  midgameAds = 0;
  cloudSaves: string[] = [];
  cloudBlob: string | null = null;

  init(): Promise<void> {
    return Promise.resolve();
  }
  gameplayStart(): void {
    this.starts += 1;
  }
  gameplayStop(): void {
    this.stops += 1;
  }
  celebrate(): void {
    this.celebrations += 1;
  }
  midgameAd(): Promise<void> {
    this.midgameAds += 1;
    return Promise.resolve();
  }
  rewardedAd(): Promise<boolean> {
    return Promise.resolve(true);
  }
  cloudSave(data: string): Promise<void> {
    this.cloudSaves.push(data);
    return Promise.resolve();
  }
  cloudLoad(): Promise<string | null> {
    return Promise.resolve(this.cloudBlob);
  }
}

const VALID_CLOUD_BLOB = JSON.stringify({
  version: 1,
  settings: { volume: 0.5, muted: true, reduceMotion: true, camSensitivity: 1 },
  levels: { "level-01": { completed: true, bestTimeMs: 1234, deaths: 0 } },
});

describe("NullSdk", () => {
  it("every method is inert and resolves", async () => {
    const sdk: PortalSdk = new NullSdk();
    await expect(sdk.init()).resolves.toBeUndefined();
    expect(sdk.gameplayStart()).toBeUndefined();
    expect(sdk.gameplayStop()).toBeUndefined();
    expect(sdk.celebrate()).toBeUndefined();
    await expect(sdk.midgameAd()).resolves.toBeUndefined();
    await expect(sdk.rewardedAd()).resolves.toBe(false);
    await expect(sdk.cloudSave("x")).resolves.toBeUndefined();
    await expect(sdk.cloudLoad()).resolves.toBeNull();
  });
});

describe("isCrazyGamesHost", () => {
  it("matches crazygames.com and its subdomains only", () => {
    expect(isCrazyGamesHost("crazygames.com")).toBe(true);
    expect(isCrazyGamesHost("games.crazygames.com")).toBe(true);
    expect(isCrazyGamesHost("shardling.crazygames.com")).toBe(true);
  });
  it("rejects local/dev/other hosts (they get NullSdk)", () => {
    expect(isCrazyGamesHost("localhost")).toBe(false);
    expect(isCrazyGamesHost("127.0.0.1")).toBe(false);
    expect(isCrazyGamesHost("example.com")).toBe(false);
    expect(isCrazyGamesHost("crazygames.com.evil.com")).toBe(false);
    expect(isCrazyGamesHost("notcrazygames.com")).toBe(false);
    expect(isCrazyGamesHost("")).toBe(false);
  });
});

describe("PortalBridge — gameplay lifecycle", () => {
  it("starts on level load, stops on pause, re-starts on resume", () => {
    const sdk = new FakeSdk();
    const bus = new EventBus();
    const save = new SaveManager(memStorage());
    new PortalBridge({ sdk, bus, save });

    bus.emit("level:loaded", { id: "level-01" });
    expect(sdk.starts).toBe(1);
    bus.emit("game:paused");
    expect(sdk.stops).toBe(1);
    bus.emit("game:resumed");
    expect(sdk.starts).toBe(2);
  });

  it("is transition-guarded: no doubled start or redundant stop", () => {
    const sdk = new FakeSdk();
    const bus = new EventBus();
    const save = new SaveManager(memStorage());
    new PortalBridge({ sdk, bus, save });

    bus.emit("level:loaded", { id: "level-01" });
    bus.emit("level:loaded", { id: "level-01" });
    expect(sdk.starts).toBe(1);
    bus.emit("game:paused");
    bus.emit("game:paused");
    expect(sdk.stops).toBe(1);
  });

  it("celebrates and stops on level complete", () => {
    const sdk = new FakeSdk();
    const bus = new EventBus();
    const save = new SaveManager(memStorage());
    new PortalBridge({ sdk, bus, save });

    bus.emit("level:loaded", { id: "level-01" });
    bus.emit("level:complete", { timeMs: 1000, deaths: 0 });
    expect(sdk.celebrations).toBe(1);
    expect(sdk.stops).toBe(1);
  });

  it("unsubscribes on destroy", () => {
    const sdk = new FakeSdk();
    const bus = new EventBus();
    const save = new SaveManager(memStorage());
    const bridge = new PortalBridge({ sdk, bus, save });
    bus.emit("level:loaded", { id: "level-01" });
    bridge.destroy();
    const before = sdk.starts;
    bus.emit("level:loaded", { id: "level-02" });
    expect(sdk.starts).toBe(before);
  });
});

describe("PortalBridge — midgame ad cadence", () => {
  it("offers a midgame ad on every 3rd completion only", async () => {
    const sdk = new FakeSdk();
    const bus = new EventBus();
    const save = new SaveManager(memStorage());
    const bridge = new PortalBridge({ sdk, bus, save });

    const complete = async (): Promise<void> => {
      bus.emit("level:loaded", { id: "l" });
      bus.emit("level:complete", { timeMs: 1, deaths: 0 });
      await bridge.adBetweenLevels();
    };
    await complete();
    await complete();
    expect(sdk.midgameAds).toBe(0);
    await complete();
    expect(sdk.midgameAds).toBe(1);
    await complete();
    await complete();
    expect(sdk.midgameAds).toBe(1);
    await complete();
    expect(sdk.midgameAds).toBe(2);
  });
});

describe("PortalBridge — cloud save", () => {
  it("mirrors every persist to the cloud", () => {
    const sdk = new FakeSdk();
    const bus = new EventBus();
    const save = new SaveManager(memStorage());
    new PortalBridge({ sdk, bus, save });

    save.updateSettings({ volume: 0.3 });
    expect(sdk.cloudSaves.length).toBeGreaterThanOrEqual(1);
    const lastBlob = sdk.cloudSaves.at(-1);
    expect(lastBlob).toBeDefined();
    const last = JSON.parse(lastBlob ?? "") as {
      settings: { volume: number };
    };
    expect(last.settings.volume).toBeCloseTo(0.3, 5);
  });

  it("local save wins on conflict and is backed up to the cloud", async () => {
    const sdk = new FakeSdk();
    sdk.cloudBlob = VALID_CLOUD_BLOB;
    const bus = new EventBus();
    const local = JSON.stringify({
      version: 1,
      settings: {
        volume: 0.9,
        muted: false,
        reduceMotion: false,
        camSensitivity: 1,
      },
      levels: {},
    });
    const save = new SaveManager(memStorage({ "shardling:v1": local }));
    const bridge = new PortalBridge({ sdk, bus, save });

    const adopted = await bridge.restoreCloudSave(save);
    expect(adopted).toBe(false);
    expect(save.getSettings().volume).toBeCloseTo(0.9, 5);
    expect(sdk.cloudSaves.length).toBe(1);
  });

  it("adopts the cloud save on a device with no local save", async () => {
    const sdk = new FakeSdk();
    sdk.cloudBlob = VALID_CLOUD_BLOB;
    const bus = new EventBus();
    const save = new SaveManager(memStorage());
    const bridge = new PortalBridge({ sdk, bus, save });

    const adopted = await bridge.restoreCloudSave(save);
    expect(adopted).toBe(true);
    expect(save.getLevel("level-01")?.bestTimeMs).toBe(1234);
    expect(save.getSettings().reduceMotion).toBe(true);
  });

  it("ignores a corrupt cloud blob (stays on defaults)", async () => {
    const sdk = new FakeSdk();
    sdk.cloudBlob = "{ not valid json";
    const bus = new EventBus();
    const save = new SaveManager(memStorage());
    const bridge = new PortalBridge({ sdk, bus, save });

    const adopted = await bridge.restoreCloudSave(save);
    expect(adopted).toBe(false);
    expect(save.getLevel("level-01")).toBeUndefined();
  });
});

describe("SaveManager — cloud methods", () => {
  it("hasLocalSave reflects whether a valid blob was loaded", () => {
    expect(new SaveManager(memStorage()).hasLocalSave()).toBe(false);
    const seeded = new SaveManager(
      memStorage({ "shardling:v1": VALID_CLOUD_BLOB }),
    );
    expect(seeded.hasLocalSave()).toBe(true);
  });

  it("a corrupt local blob does not count as a local save", () => {
    const save = new SaveManager(memStorage({ "shardling:v1": "garbage" }));
    expect(save.hasLocalSave()).toBe(false);
  });

  it("adoptCloudBlob replaces state and marks a local save present", () => {
    const save = new SaveManager(memStorage());
    expect(save.adoptCloudBlob(VALID_CLOUD_BLOB)).toBe(true);
    expect(save.hasLocalSave()).toBe(true);
    expect(save.getLevel("level-01")?.bestTimeMs).toBe(1234);
  });

  it("adoptCloudBlob rejects a bad blob without touching state", () => {
    const save = new SaveManager(memStorage());
    save.updateSettings({ volume: 0.42 });
    expect(save.adoptCloudBlob("nope")).toBe(false);
    expect(save.getSettings().volume).toBeCloseTo(0.42, 5);
  });

  it("a throwing cloud mirror never breaks a persist", () => {
    const save = new SaveManager(memStorage());
    save.setCloudMirror(() => {
      throw new Error("portal store exploded");
    });
    expect(() => save.updateSettings({ volume: 0.1 })).not.toThrow();
    expect(save.getSettings().volume).toBeCloseTo(0.1, 5);
  });
});

describe("selectPortalSdk fallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it("returns an inert SDK when not on a portal host", async () => {
    vi.stubGlobal("location", { hostname: "localhost" });
    const { selectPortalSdk } = await import("../src/sdk/crazyGamesSdk");
    const sdk = await selectPortalSdk();
    await expect(sdk.cloudLoad()).resolves.toBeNull();
    expect(sdk.gameplayStart()).toBeUndefined();
  });
});
