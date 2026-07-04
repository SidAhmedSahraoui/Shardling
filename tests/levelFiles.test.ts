import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LEVEL_DATA_DIR, listLevelFiles } from "../scripts/levelFiles";

describe("listLevelFiles", () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it("returns an empty list for a directory with no level JSON", () => {
    tempDir = mkdtempSync(join(tmpdir(), "shardling-levels-"));
    expect(listLevelFiles(tempDir)).toEqual([]);
  });

  it("returns only .json files, sorted by name", () => {
    tempDir = mkdtempSync(join(tmpdir(), "shardling-levels-"));
    writeFileSync(join(tempDir, "level-02.json"), "{}");
    writeFileSync(join(tempDir, "level-01.json"), "{}");
    writeFileSync(join(tempDir, "notes.txt"), "not a level");
    mkdirSync(join(tempDir, "nested"));

    expect(listLevelFiles(tempDir)).toEqual(["level-01.json", "level-02.json"]);
  });

  it("resolves the real level data directory without throwing", () => {
    expect(() => listLevelFiles(LEVEL_DATA_DIR)).not.toThrow();
  });
});
