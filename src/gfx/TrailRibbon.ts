import type { Scene } from "three";
import { BufferAttribute, BufferGeometry, Color, Points } from "three";

import { palette } from "../config/palette";
import { tuning } from "../config/tuning";
import type { MaterialFactory } from "./MaterialFactory";

export interface TrailRibbonOptions {
  scene: Scene;
  materials: MaterialFactory;
}

export class TrailRibbon {
  private readonly scene: Scene;
  private readonly points: Points;
  private readonly geometry: BufferGeometry;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly ages: Float32Array;
  private readonly live: Uint8Array;
  private readonly base = new Color(palette.eye);

  private head = 0;
  private lastX = 0;
  private lastY = 0;
  private lastZ = 0;
  private seeded = false;

  constructor(opts: TrailRibbonOptions) {
    this.scene = opts.scene;
    const count = tuning.trailPointCount;
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.ages = new Float32Array(count);
    this.live = new Uint8Array(count);

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new BufferAttribute(this.positions, 3),
    );
    this.geometry.setAttribute("color", new BufferAttribute(this.colors, 3));
    this.points = new Points(
      this.geometry,
      opts.materials.trailPointsMaterial(),
    );
    this.points.name = "trail";
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.scene.add(this.points);
  }

  setVisible(visible: boolean): void {
    this.points.visible = visible;
    if (!visible) {
      this.clear();
    }
  }

  clear(): void {
    this.live.fill(0);
    this.colors.fill(0);
    this.head = 0;
    this.seeded = false;
    const attr = this.geometry.getAttribute("color") as BufferAttribute;
    attr.needsUpdate = true;
  }

  update(
    frameDtSec: number,
    x: number,
    y: number,
    z: number,
    speed: number,
  ): void {
    if (!this.points.visible) {
      return;
    }

    if (!this.seeded) {
      this.lastX = x;
      this.lastY = y;
      this.lastZ = z;
      this.seeded = true;
    }

    if (speed >= tuning.trailMinSpeed) {
      const dx = x - this.lastX;
      const dy = y - this.lastY;
      const dz = z - this.lastZ;
      if (
        dx * dx + dy * dy + dz * dz >=
        tuning.trailSpacing * tuning.trailSpacing
      ) {
        const i = this.head;
        this.positions[i * 3] = x;
        this.positions[i * 3 + 1] = y;
        this.positions[i * 3 + 2] = z;
        this.ages[i] = 0;
        this.live[i] = 1;
        this.head = (this.head + 1) % tuning.trailPointCount;
        this.lastX = x;
        this.lastY = y;
        this.lastZ = z;
        const posAttr = this.geometry.getAttribute(
          "position",
        ) as BufferAttribute;
        posAttr.needsUpdate = true;
      }
    } else {
      this.lastX = x;
      this.lastY = y;
      this.lastZ = z;
    }

    let anyLive = false;
    for (let i = 0; i < tuning.trailPointCount; i += 1) {
      if (this.live[i] === 0) {
        continue;
      }
      const age = (this.ages[i] ?? 0) + frameDtSec;
      this.ages[i] = age;
      const u = age / tuning.trailLifeSec;
      if (u >= 1) {
        this.live[i] = 0;
        this.colors[i * 3] = 0;
        this.colors[i * 3 + 1] = 0;
        this.colors[i * 3 + 2] = 0;
        continue;
      }
      anyLive = true;
      const fade = (1 - u) * (1 - u);
      this.colors[i * 3] = this.base.r * fade;
      this.colors[i * 3 + 1] = this.base.g * fade;
      this.colors[i * 3 + 2] = this.base.b * fade;
    }
    const colorAttr = this.geometry.getAttribute("color") as BufferAttribute;
    colorAttr.needsUpdate = true;
    if (!anyLive) {
      this.head = 0;
    }
  }

  destroy(): void {
    this.scene.remove(this.points);
    this.geometry.dispose();
  }
}
