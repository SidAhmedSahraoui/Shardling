import type { SaveManager } from "../core/SaveManager";
import level01 from "./data/level-01.json";
import level02 from "./data/level-02.json";
import level03 from "./data/level-03.json";
import level04 from "./data/level-04.json";
import level05 from "./data/level-05.json";
import level06 from "./data/level-06.json";
import level07 from "./data/level-07.json";
import level08 from "./data/level-08.json";
import level09 from "./data/level-09.json";
import level10 from "./data/level-10.json";
import level11 from "./data/level-11.json";
import level12 from "./data/level-12.json";
import level13 from "./data/level-13.json";
import level14 from "./data/level-14.json";
import level15 from "./data/level-15.json";
import level16 from "./data/level-16.json";
import level17 from "./data/level-17.json";
import level18 from "./data/level-18.json";
import level19 from "./data/level-19.json";
import level20 from "./data/level-20.json";
import { sanityCheckLevel } from "./sanity";
import type { LevelData } from "./schema";
import { parseLevel } from "./schema";

export interface LevelEntry {
  id: string;
  name: string;
  world: number;
  data: LevelData;
}

const registered: readonly { raw: unknown; source: string }[] = [
  { raw: level01, source: "level-01.json" },
  { raw: level02, source: "level-02.json" },
  { raw: level03, source: "level-03.json" },
  { raw: level04, source: "level-04.json" },
  { raw: level05, source: "level-05.json" },
  { raw: level06, source: "level-06.json" },
  { raw: level07, source: "level-07.json" },
  { raw: level08, source: "level-08.json" },
  { raw: level09, source: "level-09.json" },
  { raw: level10, source: "level-10.json" },
  { raw: level11, source: "level-11.json" },
  { raw: level12, source: "level-12.json" },
  { raw: level13, source: "level-13.json" },
  { raw: level14, source: "level-14.json" },
  { raw: level15, source: "level-15.json" },
  { raw: level16, source: "level-16.json" },
  { raw: level17, source: "level-17.json" },
  { raw: level18, source: "level-18.json" },
  { raw: level19, source: "level-19.json" },
  { raw: level20, source: "level-20.json" },
];

export const levels: readonly LevelEntry[] = registered.map(
  ({ raw, source }) => {
    const data = parseLevel(raw, source);
    const violations = sanityCheckLevel(data);
    if (violations.length > 0) {
      throw new Error(`${source}: ${violations.join("; ")}`);
    }
    return { id: data.id, name: data.name, world: data.world, data };
  },
);

export function levelById(id: string): LevelEntry | undefined {
  return levels.find((entry) => entry.id === id);
}

export function nextLevelId(id: string): string | null {
  return nextLevelIdIn(levels, id);
}

export function isUnlocked(
  id: string,
  save: Pick<SaveManager, "getLevel">,
): boolean {
  return isUnlockedIn(levels, id, save);
}

export function firstIncompleteLevel(
  save: Pick<SaveManager, "getLevel">,
): LevelEntry | null {
  return firstIncompleteLevelIn(levels, save);
}

export function firstIncompleteLevelIn(
  entries: readonly LevelEntry[],
  save: Pick<SaveManager, "getLevel">,
): LevelEntry | null {
  return (
    entries.find((entry) => save.getLevel(entry.id)?.completed !== true) ?? null
  );
}

export function nextLevelIdIn(
  entries: readonly LevelEntry[],
  id: string,
): string | null {
  const index = entries.findIndex((entry) => entry.id === id);
  if (index === -1) {
    return null;
  }
  return entries[index + 1]?.id ?? null;
}

export function isUnlockedIn(
  entries: readonly LevelEntry[],
  id: string,
  save: Pick<SaveManager, "getLevel">,
): boolean {
  const index = entries.findIndex((entry) => entry.id === id);
  if (index === -1) {
    return false;
  }
  if (index === 0) {
    return true;
  }
  const previous = entries[index - 1];
  if (previous === undefined) {
    return false;
  }
  return save.getLevel(previous.id)?.completed === true;
}
