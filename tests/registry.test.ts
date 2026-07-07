import { describe, expect, it } from "vitest";

import type { LevelRecord, SaveManager } from "../src/core/SaveManager";
import type { LevelEntry } from "../src/levels/registry";
import {
  firstIncompleteLevel,
  firstIncompleteLevelIn,
  isUnlocked,
  isUnlockedIn,
  levelById,
  levels,
  nextLevelId,
  nextLevelIdIn,
} from "../src/levels/registry";
import type { LevelData } from "../src/levels/schema";

type SaveStub = Pick<SaveManager, "getLevel">;

function makeSave(completed: string[] = []): SaveStub {
  const store = new Map<string, LevelRecord>(
    completed.map((id) => [
      id,
      { completed: true, bestTimeMs: 1000, deaths: 0 },
    ]),
  );
  return { getLevel: (id: string) => store.get(id) };
}

function makeEntry(id: string, world = 1): LevelEntry {
  const data: LevelData = {
    id,
    name: `Level ${id}`,
    world,
    bounds: { x: 0, y: -10, z: -10, w: 40, h: 30, d: 20 },
    killY: -8,
    spawn: { x: 4, y: 1.5, z: 0 },
    portal: { x: 18, y: 1, z: 0, rotY: 90 },
    shards: [{ x: 10, y: 2, z: 0 }],
    terrain: [{ type: "box", x: 0, y: 0, z: -3, w: 20, h: 1, d: 6 }],
    hazards: [],
    intendedPath: "Roll right to the gate.",
  };
  return { id, name: data.name, world, data };
}

describe("levels registry", () => {
  it("contains level-01 as the first level, fully parsed", () => {
    expect(levels.length).toBeGreaterThanOrEqual(1);
    const first = levels[0];
    expect(first?.id).toBe("level-01");
    expect(first?.name).toBe("First Light");
    expect(first?.world).toBe(1);
    expect(first?.data.shards).toHaveLength(3);
    expect(first?.data.terrain).toHaveLength(4);
    expect(first?.data.killY).toBe(-8);
    expect(first?.data.intendedPath.length).toBeGreaterThan(0);
  });

  it("has unique ids and entries matching their level data", () => {
    const ids = levels.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of levels) {
      expect(entry.id).toBe(entry.data.id);
      expect(entry.name).toBe(entry.data.name);
      expect(entry.world).toBe(entry.data.world);
    }
  });

  it("levelById finds registered levels and returns undefined otherwise", () => {
    expect(levelById("level-01")?.name).toBe("First Light");
    expect(levelById("level-99")).toBeUndefined();
  });

  it("nextLevelId walks the full play order and ends in null", () => {
    const visited: string[] = [];
    let current: string | null = levels[0]?.id ?? null;
    while (current !== null) {
      expect(visited).not.toContain(current);
      visited.push(current);
      current = nextLevelId(current);
    }
    expect(visited).toEqual(levels.map((entry) => entry.id));
  });

  it("nextLevelId returns null for unknown ids", () => {
    expect(nextLevelId("level-99")).toBeNull();
  });

  it("isUnlocked: the first level is always unlocked", () => {
    expect(isUnlocked("level-01", makeSave())).toBe(true);
  });

  it("isUnlocked: unknown ids are never unlocked", () => {
    expect(isUnlocked("level-99", makeSave(["level-01"]))).toBe(false);
  });
});

describe("unlock chain (list-parameterized)", () => {
  const chain = [makeEntry("w1-a"), makeEntry("w1-b"), makeEntry("w1-c")];

  it("first level is unlocked on a fresh save", () => {
    expect(isUnlockedIn(chain, "w1-a", makeSave())).toBe(true);
  });

  it("later levels stay locked until the previous level is completed", () => {
    const fresh = makeSave();
    expect(isUnlockedIn(chain, "w1-b", fresh)).toBe(false);
    expect(isUnlockedIn(chain, "w1-c", fresh)).toBe(false);

    const afterFirst = makeSave(["w1-a"]);
    expect(isUnlockedIn(chain, "w1-b", afterFirst)).toBe(true);
    expect(isUnlockedIn(chain, "w1-c", afterFirst)).toBe(false);
  });

  it("only the immediately previous level gates an unlock", () => {
    const skipped = makeSave(["w1-b"]);
    expect(isUnlockedIn(chain, "w1-c", skipped)).toBe(true);
    expect(isUnlockedIn(chain, "w1-b", skipped)).toBe(false);
  });

  it("an incomplete record does not unlock the next level", () => {
    const store = new Map<string, LevelRecord>([
      ["w1-a", { completed: false, bestTimeMs: null, deaths: 0 }],
    ]);
    const save: SaveStub = { getLevel: (id: string) => store.get(id) };
    expect(isUnlockedIn(chain, "w1-b", save)).toBe(false);
  });

  it("nextLevelIdIn follows the chain and ends in null", () => {
    expect(nextLevelIdIn(chain, "w1-a")).toBe("w1-b");
    expect(nextLevelIdIn(chain, "w1-b")).toBe("w1-c");
    expect(nextLevelIdIn(chain, "w1-c")).toBeNull();
    expect(nextLevelIdIn(chain, "nope")).toBeNull();
  });
});

describe("firstIncompleteLevel", () => {
  const chain = [makeEntry("w1-a"), makeEntry("w1-b"), makeEntry("w1-c")];

  it("returns the first level on a fresh save", () => {
    expect(firstIncompleteLevelIn(chain, makeSave())?.id).toBe("w1-a");
    expect(firstIncompleteLevel(makeSave())?.id).toBe("level-01");
  });

  it("returns the next level after the completed prefix", () => {
    expect(firstIncompleteLevelIn(chain, makeSave(["w1-a"]))?.id).toBe("w1-b");
    expect(firstIncompleteLevelIn(chain, makeSave(["w1-a", "w1-b"]))?.id).toBe(
      "w1-c",
    );
  });

  it("skips completion gaps to the earliest incomplete level", () => {
    expect(firstIncompleteLevelIn(chain, makeSave(["w1-b"]))?.id).toBe("w1-a");
  });

  it("treats an incomplete record as not completed", () => {
    const store = new Map<string, LevelRecord>([
      ["w1-a", { completed: false, bestTimeMs: null, deaths: 0 }],
    ]);
    const save: SaveStub = { getLevel: (id: string) => store.get(id) };
    expect(firstIncompleteLevelIn(chain, save)?.id).toBe("w1-a");
  });

  it("returns null when every level is completed", () => {
    expect(
      firstIncompleteLevelIn(chain, makeSave(["w1-a", "w1-b", "w1-c"])),
    ).toBeNull();
  });

  it("always returns an unlocked level", () => {
    for (const completed of [
      [],
      ["w1-a"],
      ["w1-a", "w1-b"],
      ["w1-b"],
      ["w1-b", "w1-c"],
    ]) {
      const save = makeSave(completed);
      const entry = firstIncompleteLevelIn(chain, save);
      if (entry !== null) {
        expect(isUnlockedIn(chain, entry.id, save)).toBe(true);
      }
    }
  });
});
