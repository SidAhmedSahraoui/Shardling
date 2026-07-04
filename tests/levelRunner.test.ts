import { describe, expect, it } from "vitest";

import type { GameEventName, GameEvents } from "../src/core/EventBus";
import { EventBus } from "../src/core/EventBus";
import { LevelRunner } from "../src/game/LevelRunner";

const DT_SEC = 1 / 60;

const LEVEL_ID = "test-level";
const SHARD_TOTAL = 3;

interface Recorded {
  type: GameEventName;
  payload: unknown;
}

function makeHarness(shardTotal = SHARD_TOTAL): {
  bus: EventBus;
  runner: LevelRunner;
  events: Recorded[];
  count: (type: GameEventName) => number;
  last: <K extends GameEventName>(type: K) => GameEvents[K] | undefined;
} {
  const bus = new EventBus();
  const events: Recorded[] = [];
  const record = (type: GameEventName): void => {
    bus.on(type, (payload) => {
      events.push({ type, payload });
    });
  };
  record("level:loaded");
  record("shards:complete");
  record("player:died");
  record("level:complete");

  const runner = new LevelRunner({ bus, levelId: LEVEL_ID, shardTotal });
  return {
    bus,
    runner,
    events,
    count: (type) => events.filter((e) => e.type === type).length,
    last: <K extends GameEventName>(type: K) =>
      events.filter((e) => e.type === type).at(-1)?.payload as
        GameEvents[K] | undefined,
  };
}

function tickFor(runner: LevelRunner, n: number): number {
  for (let i = 0; i < n; i += 1) {
    runner.tick(DT_SEC);
  }
  return n * DT_SEC * 1000;
}

function collectAll(runner: LevelRunner): void {
  for (let i = 0; i < runner.shardTotal; i += 1) {
    runner.notifyShardCollected();
  }
}

describe("LevelRunner — start & timer", () => {
  it("starts zeroed and emits level:loaded with the level id", () => {
    const h = makeHarness();
    h.runner.start();
    expect(h.events).toEqual([
      { type: "level:loaded", payload: { id: LEVEL_ID } },
    ]);
    expect(h.runner.timeMs).toBe(0);
    expect(h.runner.deaths).toBe(0);
    expect(h.runner.shardsCollected).toBe(0);
    expect(h.runner.completed).toBe(false);
  });

  it("accumulates time only after start()", () => {
    const h = makeHarness();
    tickFor(h.runner, 10);
    expect(h.runner.timeMs).toBe(0);
    h.runner.start();
    const expected = tickFor(h.runner, 10);
    expect(h.runner.timeMs).toBeCloseTo(expected, 6);
  });

  it("freezes while paused and resumes without losing time", () => {
    const h = makeHarness();
    h.runner.start();
    const before = tickFor(h.runner, 6);
    h.runner.setPaused(true);
    tickFor(h.runner, 60);
    expect(h.runner.timeMs).toBeCloseTo(before, 6);
    h.runner.setPaused(false);
    const after = tickFor(h.runner, 6);
    expect(h.runner.timeMs).toBeCloseTo(before + after, 6);
  });

  it("freezes permanently once completed", () => {
    const h = makeHarness();
    h.runner.start();
    const before = tickFor(h.runner, 12);
    collectAll(h.runner);
    h.runner.notifyPortalEntered();
    expect(h.runner.completed).toBe(true);
    tickFor(h.runner, 120);
    expect(h.runner.timeMs).toBeCloseTo(before, 6);
  });
});

describe("LevelRunner — shards", () => {
  it("counts shards up to the total and clamps beyond it", () => {
    const h = makeHarness();
    h.runner.start();
    expect(h.runner.shardTotal).toBe(SHARD_TOTAL);
    collectAll(h.runner);
    expect(h.runner.shardsCollected).toBe(SHARD_TOTAL);
    h.runner.notifyShardCollected();
    h.runner.notifyShardCollected();
    expect(h.runner.shardsCollected).toBe(SHARD_TOTAL);
  });

  it("emits shards:complete exactly once when the last shard lands", () => {
    const h = makeHarness();
    h.runner.start();
    h.runner.notifyShardCollected();
    h.runner.notifyShardCollected();
    expect(h.count("shards:complete")).toBe(0);
    expect(h.runner.allShardsCollected).toBe(false);
    h.runner.notifyShardCollected();
    expect(h.count("shards:complete")).toBe(1);
    expect(h.runner.allShardsCollected).toBe(true);
    h.runner.notifyShardCollected();
    expect(h.count("shards:complete")).toBe(1);
  });

  it("re-fires shards:complete after a death reset re-collect", () => {
    const h = makeHarness();
    h.runner.start();
    collectAll(h.runner);
    expect(h.count("shards:complete")).toBe(1);

    h.runner.notifyDeath("hazard");
    h.runner.notifyShardsReset();
    expect(h.runner.shardsCollected).toBe(0);
    expect(h.runner.allShardsCollected).toBe(false);

    collectAll(h.runner);
    expect(h.count("shards:complete")).toBe(2);
  });

  it("notifyShardsReset leaves timer and deaths untouched", () => {
    const h = makeHarness();
    h.runner.start();
    const elapsed = tickFor(h.runner, 30);
    h.runner.notifyShardCollected();
    h.runner.notifyDeath("fall");
    h.runner.notifyShardsReset();
    expect(h.runner.shardsCollected).toBe(0);
    expect(h.runner.deaths).toBe(1);
    expect(h.runner.timeMs).toBeCloseTo(elapsed, 6);
  });
});

describe("LevelRunner — death", () => {
  it("increments deaths and emits player:died with the cause", () => {
    const h = makeHarness();
    h.runner.start();
    h.runner.notifyDeath("hazard");
    expect(h.runner.deaths).toBe(1);
    expect(h.last("player:died")).toEqual({ cause: "hazard" });
    h.runner.notifyDeath("fall");
    expect(h.runner.deaths).toBe(2);
    expect(h.last("player:died")).toEqual({ cause: "fall" });
    expect(h.count("player:died")).toBe(2);
  });

  it("keeps the clock running through a death — deaths cost time (§1.1)", () => {
    const h = makeHarness();
    h.runner.start();
    const before = tickFor(h.runner, 6);
    h.runner.notifyDeath("fall");
    h.runner.notifyShardsReset();
    const after = tickFor(h.runner, 6);
    expect(h.runner.timeMs).toBeCloseTo(before + after, 6);
  });
});

describe("LevelRunner — portal gating & completion", () => {
  it("no-ops the portal while any shard is missing", () => {
    const h = makeHarness();
    h.runner.start();
    h.runner.notifyPortalEntered();
    h.runner.notifyShardCollected();
    h.runner.notifyShardCollected();
    h.runner.notifyPortalEntered();
    expect(h.runner.completed).toBe(false);
    expect(h.count("level:complete")).toBe(0);
  });

  it("completes once — a second portal entry is a no-op", () => {
    const h = makeHarness();
    h.runner.start();
    collectAll(h.runner);
    h.runner.notifyPortalEntered();
    h.runner.notifyPortalEntered();
    expect(h.runner.completed).toBe(true);
    expect(h.count("level:complete")).toBe(1);
  });

  it("emits a level:complete payload matching the getters", () => {
    const h = makeHarness();
    h.runner.start();
    tickFor(h.runner, 90);
    h.runner.notifyDeath("hazard");
    h.runner.notifyShardsReset();
    tickFor(h.runner, 30);
    collectAll(h.runner);
    h.runner.notifyPortalEntered();
    expect(h.last("level:complete")).toEqual({
      timeMs: h.runner.timeMs,
      deaths: h.runner.deaths,
    });
    expect(h.runner.deaths).toBe(1);
    expect(h.runner.timeMs).toBeCloseTo(120 * DT_SEC * 1000, 6);
  });
});

describe("LevelRunner — restart", () => {
  it("zeroes everything and re-emits level:loaded", () => {
    const h = makeHarness();
    h.runner.start();
    tickFor(h.runner, 60);
    collectAll(h.runner);
    h.runner.notifyDeath("hazard");
    h.runner.restart();

    expect(h.count("level:loaded")).toBe(2);
    expect(h.last("level:loaded")).toEqual({ id: LEVEL_ID });
    expect(h.runner.timeMs).toBe(0);
    expect(h.runner.deaths).toBe(0);
    expect(h.runner.shardsCollected).toBe(0);
    expect(h.runner.allShardsCollected).toBe(false);
    expect(h.runner.completed).toBe(false);
  });

  it("restart after completion re-arms the whole run", () => {
    const h = makeHarness();
    h.runner.start();
    collectAll(h.runner);
    h.runner.notifyPortalEntered();
    h.runner.restart();
    expect(h.runner.completed).toBe(false);

    const elapsed = tickFor(h.runner, 30);
    collectAll(h.runner);
    h.runner.notifyPortalEntered();
    expect(h.count("shards:complete")).toBe(2);
    expect(h.count("level:complete")).toBe(2);
    expect(h.last("level:complete")).toEqual({
      timeMs: h.runner.timeMs,
      deaths: 0,
    });
    expect(h.runner.timeMs).toBeCloseTo(elapsed, 6);
  });

  it("restart also clears a pause", () => {
    const h = makeHarness();
    h.runner.start();
    h.runner.setPaused(true);
    h.runner.restart();
    const elapsed = tickFor(h.runner, 6);
    expect(h.runner.timeMs).toBeCloseTo(elapsed, 6);
  });
});

describe("LevelRunner — destroy", () => {
  it("stops the clock and leaves the bus untouched (runner never subscribes)", () => {
    const h = makeHarness();
    h.runner.start();
    h.runner.destroy();
    tickFor(h.runner, 60);
    expect(h.runner.timeMs).toBe(0);

    let pings = 0;
    h.bus.on("ui:click", () => {
      pings += 1;
    });
    h.bus.emit("ui:click");
    expect(pings).toBe(1);
  });
});
