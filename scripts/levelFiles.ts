import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const LEVEL_DATA_DIR = fileURLToPath(
  new URL("../src/levels/data", import.meta.url),
);

export function listLevelFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort();
}
