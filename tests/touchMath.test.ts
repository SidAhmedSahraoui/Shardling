import { describe, expect, it } from "vitest";

import { clampNubOffset, stickVecFromOffset } from "../src/core/touchMath";

const RADIUS = 60;
const DEAD = 20;

function expectVec(
  actual: { x: number; y: number },
  x: number,
  y: number,
): void {
  expect(actual.x).toBeCloseTo(x, 9);
  expect(actual.y).toBeCloseTo(y, 9);
}

describe("stickVecFromOffset", () => {
  it("zero offset → zero vector", () => {
    expectVec(stickVecFromOffset(0, 0, RADIUS, DEAD), 0, 0);
  });

  it("inside the dead zone → exactly zero (resting thumb never creeps)", () => {
    expectVec(stickVecFromOffset(10, -14, RADIUS, DEAD), 0, 0);
  });

  it("exactly on the dead-zone rim → still zero", () => {
    expectVec(stickVecFromOffset(DEAD, 0, RADIUS, DEAD), 0, 0);
  });

  it("just past the dead zone → tiny vector in the drag direction", () => {
    const v = stickVecFromOffset(21, 0, RADIUS, DEAD);
    expectVec(v, (21 - DEAD) / (RADIUS - DEAD), 0);
  });

  it("at the base rim → unit magnitude", () => {
    expectVec(stickVecFromOffset(RADIUS, 0, RADIUS, DEAD), 1, 0);
  });

  it("far past the rim → clamped to unit magnitude, direction kept", () => {
    expectVec(stickVecFromOffset(0, 500, RADIUS, DEAD), 0, -1);
  });

  it("screen-up (negative dy) maps to forward (positive y)", () => {
    expectVec(stickVecFromOffset(0, -RADIUS, RADIUS, DEAD), 0, 1);
  });

  it("diagonal drag preserves direction and ramps magnitude", () => {
    const v = stickVecFromOffset(30, -30, RADIUS, DEAD);
    const dist = Math.hypot(30, 30);
    const mag = (dist - DEAD) / (RADIUS - DEAD);
    expectVec(v, (30 / dist) * mag, (30 / dist) * mag);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(mag, 9);
  });

  it("mid-band magnitude ramps linearly across the live band", () => {
    const v = stickVecFromOffset(40, 0, RADIUS, DEAD);
    expectVec(v, 0.5, 0);
  });

  it("degenerate config (deadZone ≥ radius) snaps to full strength, no NaN", () => {
    const v = stickVecFromOffset(30, 0, 20, 20);
    expectVec(v, 1, 0);
    expect(Number.isFinite(v.x)).toBe(true);
  });

  it("reuses the out parameter", () => {
    const out = { x: 9, y: 9 };
    const v = stickVecFromOffset(RADIUS, 0, RADIUS, DEAD, out);
    expect(v).toBe(out);
    expectVec(out, 1, 0);
  });
});

describe("clampNubOffset", () => {
  it("inside the rim → identity (screen-space, y NOT flipped)", () => {
    expectVec(clampNubOffset(15, 25, RADIUS), 15, 25);
  });

  it("outside the rim → scaled back onto it", () => {
    const v = clampNubOffset(0, 120, RADIUS);
    expectVec(v, 0, RADIUS);
  });

  it("diagonal clamp lands on the rim", () => {
    const v = clampNubOffset(300, -400, RADIUS);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(RADIUS, 9);
    expectVec(v, RADIUS * 0.6, -RADIUS * 0.8);
  });

  it("zero offset → zero", () => {
    expectVec(clampNubOffset(0, 0, RADIUS), 0, 0);
  });
});
