import { describe, expect, it } from "vitest";

import {
  cameraRelativeMoveVec,
  forwardXZFromYaw,
  projectForwardXZ,
} from "../src/core/cameraRelative";

const DEG_90 = Math.PI / 2;
const DEG_180 = Math.PI;
const DEG_270 = (3 * Math.PI) / 2;

function expectXZ(
  actual: { x: number; z: number },
  x: number,
  z: number,
): void {
  expect(actual.x).toBeCloseTo(x, 9);
  expect(actual.z).toBeCloseTo(z, 9);
}

describe("forwardXZFromYaw", () => {
  it("yaw 0 → -Z (three.js default camera forward)", () => {
    expectXZ(forwardXZFromYaw(0), 0, -1);
  });

  it("yaw 90° (counter-clockwise) → -X", () => {
    expectXZ(forwardXZFromYaw(DEG_90), -1, 0);
  });

  it("yaw 180° → +Z", () => {
    expectXZ(forwardXZFromYaw(DEG_180), 0, 1);
  });

  it("yaw 270° → +X", () => {
    expectXZ(forwardXZFromYaw(DEG_270), 1, 0);
  });
});

describe("cameraRelativeMoveVec", () => {
  const FULL_FORWARD = { x: 0, y: 1 };
  const FULL_STRAFE_RIGHT = { x: 1, y: 0 };

  const cases = [
    { yaw: 0, forward: [0, -1], right: [1, 0] },
    { yaw: DEG_90, forward: [-1, 0], right: [0, -1] },
    { yaw: DEG_180, forward: [0, 1], right: [-1, 0] },
    { yaw: DEG_270, forward: [1, 0], right: [0, 1] },
  ] as const;

  for (const { yaw, forward, right } of cases) {
    const deg = Math.round((yaw * 180) / Math.PI);

    it(`yaw ${deg}°: full forward input maps to camera forward`, () => {
      const move = cameraRelativeMoveVec(FULL_FORWARD, forwardXZFromYaw(yaw));
      expectXZ(move, forward[0], forward[1]);
    });

    it(`yaw ${deg}°: full strafe-right input maps to forward × up`, () => {
      const move = cameraRelativeMoveVec(
        FULL_STRAFE_RIGHT,
        forwardXZFromYaw(yaw),
      );
      expectXZ(move, right[0], right[1]);
    });
  }

  it("diagonal input normalizes to length 1", () => {
    const move = cameraRelativeMoveVec({ x: 1, y: 1 }, forwardXZFromYaw(0));
    expect(Math.hypot(move.x, move.z)).toBeCloseTo(1, 9);
    expectXZ(move, Math.SQRT1_2, -Math.SQRT1_2);
  });

  it("zero input returns exactly zero, never NaN", () => {
    const move = cameraRelativeMoveVec({ x: 0, y: 0 }, forwardXZFromYaw(0));
    expect(move.x).toBe(0);
    expect(move.z).toBe(0);
  });
});

describe("projectForwardXZ", () => {
  it("projects and normalizes a pitched forward onto XZ", () => {
    const result = projectForwardXZ(
      { x: -3, y: -4, z: 0 },
      { x: 0, y: 1, z: 0 },
    );
    expectXZ(result, -1, 0);
  });

  it("straight down falls back to +up.xz (push forward moves away from the viewer)", () => {
    const forward = projectForwardXZ(
      { x: 0, y: -1, z: 0 },
      { x: 0, y: 0, z: -1 },
    );
    expectXZ(forward, 0, -1);

    const move = cameraRelativeMoveVec({ x: 0, y: 1 }, forward);
    expectXZ(move, 0, -1);
  });

  it("straight down at yaw 90° preserves the -X heading", () => {
    const result = projectForwardXZ(
      { x: 0, y: -1, z: 0 },
      { x: -1, y: 0, z: 0 },
    );
    expectXZ(result, -1, 0);
  });

  it("straight up falls back to -up.xz (heading stays continuous)", () => {
    const result = projectForwardXZ({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 });
    expectXZ(result, 0, -1);
  });

  it("doubly-degenerate input returns the world default forward, never NaN", () => {
    const result = projectForwardXZ(
      { x: 0, y: -1, z: 0 },
      { x: 0, y: 1, z: 0 },
    );
    expect(Number.isNaN(result.x)).toBe(false);
    expect(Number.isNaN(result.z)).toBe(false);
    expectXZ(result, 0, -1);
  });
});
