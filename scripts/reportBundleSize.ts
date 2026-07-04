import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const MAX_INITIAL_GZIP_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_DIST_BYTES = 15 * 1024 * 1024;

const DIST_DIR = fileURLToPath(new URL("../dist", import.meta.url));

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function mb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(3)} MB`;
}

if (!existsSync(DIST_DIR)) {
  console.error(
    "reportBundleSize — dist/ not found; run `npm run build` first.",
  );
  process.exit(1);
}

const allFiles = walk(DIST_DIR);
const totalDistBytes = allFiles.reduce(
  (sum, file) => sum + statSync(file).size,
  0,
);

const payloadFiles = allFiles.filter(
  (file) => file.endsWith(".js") || file.endsWith(".wasm"),
);
let initialGzipBytes = 0;

console.log("\nBundle size report");
console.log("──────────────────");
for (const file of payloadFiles) {
  const raw = readFileSync(file);
  const gzipped = gzipSync(raw).length;
  initialGzipBytes += gzipped;
  const rel = file.slice(DIST_DIR.length + 1);
  console.log(`${rel}: ${mb(raw.length)} raw → ${mb(gzipped)} gzip`);
}
console.log(
  `Initial JS+WASM (gzip): ${mb(initialGzipBytes)} / ${mb(MAX_INITIAL_GZIP_BYTES)} budget`,
);
console.log(
  `Total dist:             ${mb(totalDistBytes)} / ${mb(MAX_TOTAL_DIST_BYTES)} budget`,
);

let failed = false;
if (initialGzipBytes > MAX_INITIAL_GZIP_BYTES) {
  console.error("FAIL: initial JS+WASM payload exceeds the 4 MB gzip budget.");
  failed = true;
}
if (totalDistBytes > MAX_TOTAL_DIST_BYTES) {
  console.error("FAIL: total dist exceeds the 15 MB budget.");
  failed = true;
}
if (failed) {
  process.exitCode = 1;
} else {
  console.log("Bundle size within budget. OK\n");
}
