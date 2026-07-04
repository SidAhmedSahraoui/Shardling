/// <reference types="vitest/config" />
import { readFileSync } from "node:fs";

import { defineConfig } from "vite";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

export default defineConfig({
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 4096,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
