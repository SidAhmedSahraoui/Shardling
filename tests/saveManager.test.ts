import { describe, expect, it } from "vitest";

import { tuning } from "../src/config/tuning";
import {
  SAVE_KEY,
  SaveManager,
  type StorageLike,
} from "../src/core/SaveManager";

interface StubStorage extends StorageLike {
  store: Map<string, string>;
}

function createStub(initial?: Record<string, string>): StubStorage {
  const store = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    store,
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

describe("SaveManager", () => {
  it("starts from tuning defaults on an empty store", () => {
    const save = new SaveManager(createStub());
    expect(save.getSettings()).toEqual({
      volume: tuning.defaultVolume,
      muted: false,
      reduceMotion: false,
      camSensitivity: tuning.defaultCamSensitivity,
    });
    expect(save.getLevel("level-01")).toBeUndefined();
  });

  it("constructs without a store in a DOM-less environment", () => {
    expect(() => new SaveManager()).not.toThrow();
  });

  it("roundtrips mutations through a fresh instance over the same store", () => {
    const stub = createStub();
    const first = new SaveManager(stub);
    first.updateSettings({ volume: 0.25, muted: true, camSensitivity: 1.5 });
    first.recordLevelCompletion("level-01", { timeMs: 42_000, deaths: 3 });

    const second = new SaveManager(stub);
    expect(second.getSettings()).toEqual(first.getSettings());
    expect(second.getLevel("level-01")).toEqual({
      completed: true,
      bestTimeMs: 42_000,
      deaths: 3,
    });
  });

  it("clamps volume to 0..1 and camSensitivity to the tuning range", () => {
    const save = new SaveManager(createStub());
    expect(save.updateSettings({ volume: 3 }).volume).toBe(1);
    expect(save.updateSettings({ volume: -1 }).volume).toBe(0);
    expect(save.updateSettings({ camSensitivity: 99 }).camSensitivity).toBe(
      tuning.camSensitivityMax,
    );
    expect(save.updateSettings({ camSensitivity: 0 }).camSensitivity).toBe(
      tuning.camSensitivityMin,
    );
  });

  it("keeps the best time and its run's deaths across completions", () => {
    const save = new SaveManager(createStub());
    expect(
      save.recordLevelCompletion("level-02", { timeMs: 30_000, deaths: 5 }),
    ).toEqual({ newBest: true });
    expect(
      save.recordLevelCompletion("level-02", { timeMs: 40_000, deaths: 0 }),
    ).toEqual({ newBest: false });
    expect(save.getLevel("level-02")).toEqual({
      completed: true,
      bestTimeMs: 30_000,
      deaths: 5,
    });
    expect(
      save.recordLevelCompletion("level-02", { timeMs: 20_000, deaths: 1 }),
    ).toEqual({ newBest: true });
    expect(save.getLevel("level-02")).toEqual({
      completed: true,
      bestTimeMs: 20_000,
      deaths: 1,
    });
  });

  it.each([
    ["garbage JSON", "{not json!!"],
    ["wrong shape (array)", "[1,2,3]"],
    ["wrong shape (string)", '"hello"'],
    ["partial object", '{"version":1,"settings":{"volume":0.5}}'],
    ["bad field types", '{"version":1,"settings":null,"levels":[]}'],
  ])("recovers to defaults from corrupt data: %s", (_label, raw) => {
    const stub = createStub({ [SAVE_KEY]: raw });
    let save: SaveManager | undefined;
    expect(() => {
      save = new SaveManager(stub);
    }).not.toThrow();
    expect(save?.getSettings()).toEqual({
      volume: tuning.defaultVolume,
      muted: false,
      reduceMotion: false,
      camSensitivity: tuning.defaultCamSensitivity,
    });
  });

  it("migrates a v0 blob (no camSensitivity) preserving everything else", () => {
    const v0 = {
      version: 0,
      settings: { volume: 0.5, muted: true, reduceMotion: true },
      levels: {
        "level-01": { completed: true, bestTimeMs: 12_345, deaths: 2 },
      },
    };
    const stub = createStub({ [SAVE_KEY]: JSON.stringify(v0) });
    const save = new SaveManager(stub);

    expect(save.getSettings()).toEqual({
      volume: 0.5,
      muted: true,
      reduceMotion: true,
      camSensitivity: tuning.defaultCamSensitivity,
    });
    expect(save.getLevel("level-01")).toEqual({
      completed: true,
      bestTimeMs: 12_345,
      deaths: 2,
    });

    save.updateSettings({});
    const persisted = JSON.parse(stub.store.get(SAVE_KEY) ?? "{}") as {
      version: number;
    };
    expect(persisted.version).toBe(1);
  });

  it("falls back to defaults for an unknown future version", () => {
    const future = {
      version: 99,
      settings: {
        volume: 0.1,
        muted: true,
        reduceMotion: true,
        camSensitivity: 2,
      },
      levels: {},
    };
    const stub = createStub({ [SAVE_KEY]: JSON.stringify(future) });
    const save = new SaveManager(stub);
    expect(save.getSettings()).toEqual({
      volume: tuning.defaultVolume,
      muted: false,
      reduceMotion: false,
      camSensitivity: tuning.defaultCamSensitivity,
    });
  });

  it("survives a store whose writes always throw, keeping in-memory state", () => {
    const throwing: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
      removeItem: () => {
        throw new Error("quota exceeded");
      },
    };
    const save = new SaveManager(throwing);
    expect(() => save.updateSettings({ volume: 0.3 })).not.toThrow();
    expect(save.getSettings().volume).toBe(0.3);
    expect(() =>
      save.recordLevelCompletion("level-03", { timeMs: 1_000, deaths: 0 }),
    ).not.toThrow();
    expect(save.getLevel("level-03")?.bestTimeMs).toBe(1_000);
    expect(() => save.reset()).not.toThrow();
    expect(save.getSettings().volume).toBe(tuning.defaultVolume);
  });

  it("reset() clears storage and returns to defaults", () => {
    const stub = createStub();
    const save = new SaveManager(stub);
    save.updateSettings({ muted: true });
    save.recordLevelCompletion("level-01", { timeMs: 5_000, deaths: 0 });
    save.reset();
    expect(save.getSettings().muted).toBe(false);
    expect(save.getLevel("level-01")).toBeUndefined();
    expect(stub.store.has(SAVE_KEY)).toBe(false);
  });

  it("returns defensive copies that do not alias internal state", () => {
    const save = new SaveManager(createStub());
    const settings = save.getSettings();
    settings.volume = 0;
    expect(save.getSettings().volume).toBe(tuning.defaultVolume);

    save.recordLevelCompletion("level-01", { timeMs: 9_000, deaths: 1 });
    const record = save.getLevel("level-01");
    if (record) {
      record.deaths = 99;
    }
    expect(save.getLevel("level-01")?.deaths).toBe(1);
  });
  it("refuses non-finite completion results instead of poisoning the save", () => {
    const stub = createStub();
    const save = new SaveManager(stub);
    save.recordLevelCompletion("level-01", { timeMs: 5_000, deaths: 2 });

    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(
        save.recordLevelCompletion("level-01", { timeMs: bad, deaths: 0 }),
      ).toEqual({ newBest: false });
      expect(
        save.recordLevelCompletion("level-01", { timeMs: 1_000, deaths: bad }),
      ).toEqual({ newBest: false });
    }
    expect(save.getLevel("level-01")).toEqual({
      completed: true,
      bestTimeMs: 5_000,
      deaths: 2,
    });

    const reloaded = new SaveManager(stub);
    expect(reloaded.getLevel("level-01")?.bestTimeMs).toBe(5_000);
  });

  it("clamps out-of-range stored settings on load instead of wiping the save", () => {
    const stub = createStub({
      [SAVE_KEY]: JSON.stringify({
        version: 1,
        settings: {
          volume: 4,
          muted: true,
          reduceMotion: false,
          camSensitivity: 99,
        },
        levels: {
          "level-01": { completed: true, bestTimeMs: 7_000, deaths: 3 },
        },
      }),
    });
    const save = new SaveManager(stub);
    expect(save.getLevel("level-01")?.bestTimeMs).toBe(7_000);
    expect(save.getSettings().muted).toBe(true);
    expect(save.getSettings().volume).toBe(1);
    expect(save.getSettings().camSensitivity).toBe(tuning.camSensitivityMax);
  });
});
