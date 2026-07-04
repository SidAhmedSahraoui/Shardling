import { readFileSync } from "node:fs";
import { join } from "node:path";

import { sanityCheckLevel } from "../src/levels/sanity";
import type { LevelData } from "../src/levels/schema";
import { parseLevel } from "../src/levels/schema";
import { LEVEL_DATA_DIR, listLevelFiles } from "./levelFiles";

const errors: string[] = [];

function fail(message: string): void {
  errors.push(message);
}

const files = listLevelFiles(LEVEL_DATA_DIR);
if (files.length === 0) {
  fail(
    "no level files found in src/levels/data — at least level-01 must exist",
  );
}

const parsedById = new Map<string, { file: string; level: LevelData }>();
for (const file of files) {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(LEVEL_DATA_DIR, file), "utf8"));
  } catch (error) {
    fail(
      `${file}: invalid JSON — ${error instanceof Error ? error.message : String(error)}`,
    );
    continue;
  }
  let level: LevelData;
  try {
    level = parseLevel(raw, file);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    continue;
  }
  const duplicate = parsedById.get(level.id);
  if (duplicate !== undefined) {
    fail(`duplicate level id "${level.id}" in ${duplicate.file} and ${file}`);
    continue;
  }
  for (const violation of sanityCheckLevel(level)) {
    fail(`${file} (${level.id}): ${violation}`);
  }
  parsedById.set(level.id, { file, level });
}

try {
  const { levels } = await import("../src/levels/registry");
  const registeredIds = new Set(levels.map((entry) => entry.id));
  if (registeredIds.size !== levels.length) {
    fail("registry.ts contains duplicate level ids");
  }
  for (const [id, { file }] of parsedById) {
    if (!registeredIds.has(id)) {
      fail(`${file} (${id}) is not registered in src/levels/registry.ts`);
    }
  }
  for (const entry of levels) {
    if (!parsedById.has(entry.id)) {
      fail(
        `registry.ts lists "${entry.id}" but no data file in src/levels/data defines it`,
      );
    }
  }
  if (errors.length === 0) {
    for (const entry of levels) {
      const { data } = entry;
      console.log(
        `OK ${entry.id} — "${entry.name}" (world ${entry.world}, ${data.shards.length} shards, ${data.terrain.length} terrain, ${data.hazards.length} hazards)`,
      );
    }
    console.log(`validate:levels — ${levels.length} level(s) valid.`);
  }
} catch (error) {
  fail(
    `failed to load src/levels/registry.ts: ${error instanceof Error ? error.message : String(error)}`,
  );
}

if (errors.length > 0) {
  console.error(`validate:levels — ${errors.length} problem(s):`);
  for (const message of errors) {
    console.error(`  ${message}`);
  }
  process.exitCode = 1;
}
