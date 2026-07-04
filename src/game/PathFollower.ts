import type { MoverMode, Vec3 } from "../levels/schema";

const EPSILON = 1e-9;

export class PathFollower {
  readonly position: { x: number; y: number; z: number };

  private readonly points: readonly Vec3[];
  private readonly speed: number;
  private readonly mode: MoverMode;
  private readonly segmentLengths: number[];
  private readonly totalLength: number;

  private segmentIndex = 0;
  private distanceIntoSegment = 0;
  private direction: 1 | -1 = 1;

  constructor(waypoints: readonly Vec3[], speedUps: number, mode: MoverMode) {
    if (waypoints.length < 2) {
      throw new Error("PathFollower: a path needs at least 2 waypoints");
    }
    this.points = waypoints;
    this.speed = speedUps;
    this.mode = mode;

    const segmentCount =
      mode === "loop" ? waypoints.length : waypoints.length - 1;
    this.segmentLengths = [];
    let total = 0;
    for (let i = 0; i < segmentCount; i += 1) {
      const a = this.pointAt(i);
      const b = this.pointAt(i + 1);
      const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      this.segmentLengths.push(length);
      total += length;
    }
    this.totalLength = total;

    const first = waypoints[0];
    if (!first) {
      throw new Error("PathFollower: unreachable — length checked above");
    }
    this.position = { x: first.x, y: first.y, z: first.z };
  }

  advance(dtSec: number): void {
    if (this.totalLength <= EPSILON || dtSec <= 0) {
      return;
    }
    let remaining = this.speed * dtSec;
    while (remaining > 0) {
      const length = this.segmentLengths[this.segmentIndex] ?? 0;
      const available =
        this.direction === 1
          ? length - this.distanceIntoSegment
          : this.distanceIntoSegment;
      if (remaining < available) {
        this.distanceIntoSegment += this.direction * remaining;
        break;
      }
      remaining -= available;
      this.stepSegment();
    }
    this.writePosition();
  }

  reset(): void {
    this.segmentIndex = 0;
    this.distanceIntoSegment = 0;
    this.direction = 1;
    this.writePosition();
  }

  private pointAt(i: number): Vec3 {
    const p = this.points[i % this.points.length];
    if (!p) {
      throw new Error("PathFollower: unreachable — index is wrapped");
    }
    return p;
  }

  private stepSegment(): void {
    const lastSegment = this.segmentLengths.length - 1;
    if (this.direction === 1) {
      if (this.segmentIndex < lastSegment) {
        this.segmentIndex += 1;
        this.distanceIntoSegment = 0;
      } else if (this.mode === "loop") {
        this.segmentIndex = 0;
        this.distanceIntoSegment = 0;
      } else {
        this.direction = -1;
        this.distanceIntoSegment = this.segmentLengths[this.segmentIndex] ?? 0;
      }
    } else if (this.segmentIndex > 0) {
      this.segmentIndex -= 1;
      this.distanceIntoSegment = this.segmentLengths[this.segmentIndex] ?? 0;
    } else {
      this.direction = 1;
      this.distanceIntoSegment = 0;
    }
  }

  private writePosition(): void {
    const a = this.pointAt(this.segmentIndex);
    const b = this.pointAt(this.segmentIndex + 1);
    const length = this.segmentLengths[this.segmentIndex] ?? 0;
    const t = length <= EPSILON ? 0 : this.distanceIntoSegment / length;
    this.position.x = a.x + (b.x - a.x) * t;
    this.position.y = a.y + (b.y - a.y) * t;
    this.position.z = a.z + (b.z - a.z) * t;
  }
}
