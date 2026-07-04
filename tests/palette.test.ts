import { describe, expect, it } from "vitest";

import { palette } from "../src/config/palette";

describe("palette", () => {
  it("holds valid 24-bit colors for every token", () => {
    const { worldAccents, ...tokens } = palette;
    for (const [name, value] of Object.entries(tokens)) {
      expect(Number.isInteger(value), `${name} must be an integer`).toBe(true);
      expect(
        value,
        `${name} must be within 24-bit range`,
      ).toBeGreaterThanOrEqual(0x000000);
      expect(value, `${name} must be within 24-bit range`).toBeLessThanOrEqual(
        0xffffff,
      );
    }
    for (const value of worldAccents) {
      expect(value).toBeGreaterThanOrEqual(0x000000);
      expect(value).toBeLessThanOrEqual(0xffffff);
    }
  });

  it("defines one accent per world (4 worlds)", () => {
    expect(palette.worldAccents).toHaveLength(4);
  });
});
