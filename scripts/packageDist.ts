import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DIST_DIR = fileURLToPath(new URL("../dist", import.meta.url));
const ZIP_PATH = fileURLToPath(new URL("../shardling.zip", import.meta.url));

const MAX_UNCOMPRESSED_BYTES = 15 * 1024 * 1024;

function mb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(3)} MB`;
}

function walkSize(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    total += entry.isDirectory() ? walkSize(full) : statSync(full).size;
  }
  return total;
}

if (!existsSync(DIST_DIR)) {
  console.error("packageDist — dist/ not found; run `npm run build` first.");
  process.exit(1);
}
if (!existsSync(join(DIST_DIR, "index.html"))) {
  console.error("packageDist — dist/index.html missing; build looks broken.");
  process.exit(1);
}

rmSync(ZIP_PATH, { force: true });

execFileSync(
  "zip",
  ["-r", "-q", "-X", ZIP_PATH, ".", "-x", ".DS_Store", "-x", "__MACOSX"],
  { cwd: DIST_DIR, stdio: "inherit" },
);

const uncompressed = walkSize(DIST_DIR);
const zipped = statSync(ZIP_PATH).size;

console.log("\nPackage report");
console.log("──────────────");
console.log(`Archive:        shardling.zip`);
console.log(`Zipped size:    ${mb(zipped)}`);
console.log(
  `Uncompressed:   ${mb(uncompressed)} / ${mb(MAX_UNCOMPRESSED_BYTES)} ceiling`,
);

if (uncompressed > MAX_UNCOMPRESSED_BYTES) {
  console.error("FAIL: uncompressed payload exceeds the portal ceiling.");
  process.exit(1);
}
console.log("Package ready for submission. OK\n");
