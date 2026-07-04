import type { Scene } from "three";
import { BufferAttribute, BufferGeometry, Points } from "three";

import { tuning } from "../config/tuning";
import type { MaterialFactory } from "./MaterialFactory";

const PHASE_STEP = 2.4;
const BOB_PERIOD_SEC = 7;
const WANDER_RATIO = 0.6;
const WANDER_XZ = 0.5;

const LCG_MULT = 1664525;
const LCG_INC = 1013904223;

export interface MoteFieldOptions {
  scene: Scene;
  materials: MaterialFactory;
  bounds: {
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    d: number;
  };
}

export class MoteField {
  private readonly scene: Scene;
  private readonly points: Points;
  private readonly geometry: BufferGeometry;
  private readonly positions: Float32Array;
  private readonly basePositions: Float32Array;
  private clock = 0;

  constructor(opts: MoteFieldOptions) {
    this.scene = opts.scene;
    const count = tuning.moteCount;
    this.positions = new Float32Array(count * 3);
    this.basePositions = new Float32Array(count * 3);

    let state = 0x9e3779b9;
    const rand = (): number => {
      state = (Math.imul(state, LCG_MULT) + LCG_INC) >>> 0;
      return state / 2 ** 32;
    };

    const b = opts.bounds;
    for (let i = 0; i < count; i += 1) {
      const x = b.x + rand() * b.w;
      const y = b.y + rand() * b.h;
      const z = b.z + rand() * b.d;
      this.basePositions[i * 3] = x;
      this.basePositions[i * 3 + 1] = y;
      this.basePositions[i * 3 + 2] = z;
      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = z;
    }

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new BufferAttribute(this.positions, 3),
    );
    this.points = new Points(
      this.geometry,
      opts.materials.motePointsMaterial(),
    );
    this.points.name = "moteField";
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  setVisible(visible: boolean): void {
    this.points.visible = visible;
  }

  update(frameDtSec: number, drift: boolean): void {
    if (!drift || !this.points.visible) {
      return;
    }
    this.clock += frameDtSec;
    const bobOmega = (Math.PI * 2) / BOB_PERIOD_SEC;
    const wanderOmega = bobOmega * WANDER_RATIO;
    const count = this.basePositions.length / 3;
    for (let i = 0; i < count; i += 1) {
      const phase = i * PHASE_STEP;
      const t = this.clock;
      this.positions[i * 3] =
        (this.basePositions[i * 3] ?? 0) +
        Math.sin(t * wanderOmega + phase) * WANDER_XZ;
      this.positions[i * 3 + 1] =
        (this.basePositions[i * 3 + 1] ?? 0) +
        Math.sin(t * bobOmega + phase * 1.7) *
          tuning.moteDriftSpeed *
          BOB_PERIOD_SEC *
          0.25;
      this.positions[i * 3 + 2] =
        (this.basePositions[i * 3 + 2] ?? 0) +
        Math.cos(t * wanderOmega + phase * 0.6) * WANDER_XZ;
    }
    this.geometry.getAttribute("position").needsUpdate = true;
  }

  dispose(): void {
    this.scene.remove(this.points);
    this.geometry.dispose();
  }
}
