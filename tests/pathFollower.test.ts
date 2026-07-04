import { describe, expect, it } from "vitest";

import { PathFollower } from "../src/game/PathFollower";

function p(
  x: number,
  y: number,
  z: number,
): { x: number; y: number; z: number } {
  return { x, y, z };
}

function expectPosition(
  follower: PathFollower,
  x: number,
  y: number,
  z: number,
): void {
  expect(follower.position.x).toBeCloseTo(x, 6);
  expect(follower.position.y).toBeCloseTo(y, 6);
  expect(follower.position.z).toBeCloseTo(z, 6);
}

describe("PathFollower", () => {
  it("starts at waypoints[0] and lerps partway along a segment", () => {
    const follower = new PathFollower([p(0, 0, 0), p(3, 4, 0)], 1, "pingpong");
    expectPosition(follower, 0, 0, 0);
    follower.advance(2.5);
    expectPosition(follower, 1.5, 2, 0);
  });

  it("lands exactly on the far waypoint, then pingpongs back", () => {
    const follower = new PathFollower([p(0, 0, 0), p(10, 0, 0)], 5, "pingpong");
    follower.advance(2);
    expectPosition(follower, 10, 0, 0);
    follower.advance(1);
    expectPosition(follower, 5, 0, 0);
  });

  it("returns to the start after a full out-and-back cycle", () => {
    const follower = new PathFollower(
      [p(0, 0, 0), p(0, 0, 6)],
      1.5,
      "pingpong",
    );
    const steps = 40;
    for (let i = 0; i < steps; i += 1) {
      follower.advance(8 / steps);
    }
    expectPosition(follower, 0, 0, 0);
  });

  it("consumes several waypoints in one big advance and lands mid-segment", () => {
    const follower = new PathFollower(
      [p(0, 0, 0), p(4, 0, 0), p(4, 3, 0), p(10, 3, 0)],
      1,
      "pingpong",
    );
    follower.advance(9);
    expectPosition(follower, 6, 3, 0);
  });

  it("overshoots the far end and comes back down the last segment", () => {
    const follower = new PathFollower(
      [p(0, 0, 0), p(4, 0, 0), p(4, 3, 0), p(10, 3, 0)],
      2,
      "pingpong",
    );
    follower.advance(8);
    expectPosition(follower, 7, 3, 0);
  });

  it("loop mode wraps through the closing last→first segment", () => {
    const follower = new PathFollower(
      [p(0, 0, 0), p(6, 0, 0), p(6, 0, 8)],
      1,
      "loop",
    );
    follower.advance(19);
    expectPosition(follower, 3, 0, 4);
    follower.advance(5);
    expectPosition(follower, 0, 0, 0);
  });

  it("stays parked on a degenerate all-identical path without hanging", () => {
    const pingpong = new PathFollower(
      [p(2, 1, 3), p(2, 1, 3), p(2, 1, 3)],
      4,
      "pingpong",
    );
    pingpong.advance(1000);
    expectPosition(pingpong, 2, 1, 3);

    const loop = new PathFollower([p(2, 1, 3), p(2, 1, 3)], 4, "loop");
    loop.advance(1000);
    expectPosition(loop, 2, 1, 3);
  });

  it("reset() returns to waypoints[0] heading forward", () => {
    const follower = new PathFollower([p(0, 0, 0), p(10, 0, 0)], 1, "pingpong");
    follower.advance(12);
    expectPosition(follower, 8, 0, 0);
    follower.reset();
    expectPosition(follower, 0, 0, 0);
    follower.advance(3);
    expectPosition(follower, 3, 0, 0);
  });

  it("covers speed × dt along the polyline", () => {
    const slow = new PathFollower([p(0, 0, 0), p(100, 0, 0)], 2, "pingpong");
    const fast = new PathFollower([p(0, 0, 0), p(100, 0, 0)], 8, "pingpong");
    slow.advance(3);
    fast.advance(0.75);
    expectPosition(slow, 6, 0, 0);
    expectPosition(fast, 6, 0, 0);
  });

  it("throws on fewer than 2 waypoints", () => {
    expect(() => new PathFollower([], 1, "pingpong")).toThrowError(
      /at least 2 waypoints/,
    );
    expect(() => new PathFollower([p(1, 2, 3)], 1, "loop")).toThrowError(
      /at least 2 waypoints/,
    );
  });
});
