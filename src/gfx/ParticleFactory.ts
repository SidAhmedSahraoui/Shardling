import type { Scene, Sprite, SpriteMaterial } from "three";

import { tuning } from "../config/tuning";
import type { MeshFactory } from "./MeshFactory";

const SPARK_POOL = 24;
const EMBER_POOL = 20;
const PORTAL_POOL = 36;
const RING_POOL = 3;

const LIVE_BUDGET = 400;

const SPARK_LIFE_SEC = 0.5;
const SPARK_SIZE = 0.14;
const SPARK_SPEED_MIN = 2.2;
const SPARK_SPEED_MAX = 3.6;
const SPARK_UP_BIAS = 1.6;
const SPARK_GRAVITY = -7;

const EMBER_LIFE_SEC = 0.6;
const EMBER_SIZE_MIN = 0.1;
const EMBER_SIZE_MAX = 0.2;
const EMBER_SPEED_MIN = 1.8;
const EMBER_SPEED_MAX = 4.2;
const EMBER_GRAVITY = -5;

const PORTAL_LIFE_SEC = 1.1;
const PORTAL_SIZE = 0.11;
const PORTAL_SPIRAL_RADIUS = 1.7;
const PORTAL_SPIRAL_TURNS = 0.75;
const PORTAL_DRIFT_SPEED = 0.35;
const PORTAL_DRIFT_LIFE_SEC = 1.8;

const RING_START_SCALE = 0.35;
const RING_END_SCALE = 2.4;

const TWO_PI = Math.PI * 2;

const LCG_MULT = 1664525;
const LCG_INC = 1013904223;
const LCG_SEED = 0x5eed5eed;

function cubicOut(t: number): number {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

interface Particle {
  sprite: Sprite;
  age: number;
  life: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  spiral: boolean;
  cx: number;
  cy: number;
  cz: number;
  angle0: number;
  radius0: number;
}

export interface ParticleFactoryOptions {
  scene: Scene;
  meshes: MeshFactory;
}

export class ParticleFactory {
  private readonly scene: Scene;
  private readonly sparks: Particle[] = [];
  private readonly embers: Particle[] = [];
  private readonly portalMotes: Particle[] = [];
  private readonly rings: Particle[] = [];
  private readonly ringMaterials: SpriteMaterial[] = [];

  private live = 0;
  private lcgState = LCG_SEED;
  private portalEmitCarry = 0;

  constructor(opts: ParticleFactoryOptions) {
    this.scene = opts.scene;
    const makePool = (
      kind: "spark" | "ember" | "portalMote",
      count: number,
      size: number,
      into: Particle[],
    ): void => {
      for (let i = 0; i < count; i += 1) {
        const sprite = opts.meshes.particleSprite(kind, size);
        sprite.visible = false;
        this.scene.add(sprite);
        into.push({
          sprite,
          age: Infinity,
          life: 1,
          vx: 0,
          vy: 0,
          vz: 0,
          size,
          spiral: false,
          cx: 0,
          cy: 0,
          cz: 0,
          angle0: 0,
          radius0: 0,
        });
      }
    };
    makePool("spark", SPARK_POOL, SPARK_SIZE, this.sparks);
    makePool("ember", EMBER_POOL, EMBER_SIZE_MIN, this.embers);
    makePool("portalMote", PORTAL_POOL, PORTAL_SIZE, this.portalMotes);

    for (let i = 0; i < RING_POOL; i += 1) {
      const sprite = opts.meshes.particleSprite("ring", RING_START_SCALE);
      const cloned = sprite.material.clone();
      sprite.material = cloned;
      this.ringMaterials.push(cloned);
      sprite.visible = false;
      this.scene.add(sprite);
      this.rings.push({
        sprite,
        age: Infinity,
        life: 1,
        vx: 0,
        vy: 0,
        vz: 0,
        size: RING_START_SCALE,
        spiral: false,
        cx: 0,
        cy: 0,
        cz: 0,
        angle0: 0,
        radius0: 0,
      });
    }
  }

  get liveCount(): number {
    return this.live;
  }

  spawnCollectSparks(x: number, y: number, z: number): void {
    for (let i = 0; i < tuning.collectSparkCount; i += 1) {
      const p = this.takeDead(this.sparks);
      if (!p) {
        return;
      }
      const angle = this.rand() * TWO_PI;
      const speed =
        SPARK_SPEED_MIN + this.rand() * (SPARK_SPEED_MAX - SPARK_SPEED_MIN);
      this.arm(p, x, y, z, SPARK_LIFE_SEC);
      p.vx = Math.sin(angle) * speed;
      p.vy = this.rand() * SPARK_UP_BIAS + speed * 0.3;
      p.vz = Math.cos(angle) * speed;
      p.size = SPARK_SIZE;
    }
  }

  spawnCollectRing(x: number, y: number, z: number): void {
    const p = this.takeDead(this.rings);
    if (!p) {
      return;
    }
    this.arm(p, x, y, z, tuning.collectRingMs / 1000);
    p.size = RING_START_SCALE;
  }

  spawnSootBurst(x: number, y: number, z: number): void {
    for (let i = 0; i < tuning.sootBurstCount; i += 1) {
      const p = this.takeDead(this.embers);
      if (!p) {
        return;
      }
      const yaw = this.rand() * TWO_PI;
      const pitch = (this.rand() - 0.3) * Math.PI * 0.8;
      const speed =
        EMBER_SPEED_MIN + this.rand() * (EMBER_SPEED_MAX - EMBER_SPEED_MIN);
      this.arm(p, x, y, z, EMBER_LIFE_SEC);
      p.vx = Math.cos(pitch) * Math.sin(yaw) * speed;
      p.vy = Math.sin(pitch) * speed + 1.2;
      p.vz = Math.cos(pitch) * Math.cos(yaw) * speed;
      p.size = EMBER_SIZE_MIN + this.rand() * (EMBER_SIZE_MAX - EMBER_SIZE_MIN);
    }
  }

  emitPortal(
    frameDtSec: number,
    x: number,
    y: number,
    z: number,
    active: boolean,
  ): void {
    const rate = active
      ? tuning.portalSpiralRatePerSec
      : tuning.portalDriftRatePerSec;
    this.portalEmitCarry += rate * frameDtSec;
    while (this.portalEmitCarry >= 1) {
      this.portalEmitCarry -= 1;
      const p = this.takeDead(this.portalMotes);
      if (!p) {
        return;
      }
      const angle = this.rand() * TWO_PI;
      if (active) {
        this.arm(p, x, y, z, PORTAL_LIFE_SEC);
        p.spiral = true;
        p.cx = x;
        p.cy = y;
        p.cz = z;
        p.angle0 = angle;
        p.radius0 = PORTAL_SPIRAL_RADIUS * (0.85 + this.rand() * 0.3);
      } else {
        this.arm(
          p,
          x + Math.sin(angle) * PORTAL_SPIRAL_RADIUS * this.rand(),
          y + (this.rand() - 0.5) * 1.6,
          z + Math.cos(angle) * PORTAL_SPIRAL_RADIUS * this.rand(),
          PORTAL_DRIFT_LIFE_SEC,
        );
        p.vy = PORTAL_DRIFT_SPEED * (0.5 + this.rand() * 0.5);
      }
      p.size = PORTAL_SIZE;
    }
  }

  update(frameDtSec: number): void {
    this.updatePool(this.sparks, frameDtSec, SPARK_GRAVITY);
    this.updatePool(this.embers, frameDtSec, EMBER_GRAVITY);
    this.updatePool(this.portalMotes, frameDtSec, 0);
    this.updateRings(frameDtSec);
  }

  clear(): void {
    for (const pool of [
      this.sparks,
      this.embers,
      this.portalMotes,
      this.rings,
    ]) {
      for (const p of pool) {
        if (p.age < p.life) {
          p.age = Infinity;
          p.sprite.visible = false;
        }
      }
    }
    this.live = 0;
    this.portalEmitCarry = 0;
  }

  dispose(): void {
    this.clear();
    for (const pool of [
      this.sparks,
      this.embers,
      this.portalMotes,
      this.rings,
    ]) {
      for (const p of pool) {
        this.scene.remove(p.sprite);
      }
      pool.length = 0;
    }
    for (const material of this.ringMaterials) {
      material.dispose();
    }
    this.ringMaterials.length = 0;
  }

  private arm(
    p: Particle,
    x: number,
    y: number,
    z: number,
    lifeSec: number,
  ): void {
    p.age = 0;
    p.life = lifeSec;
    p.vx = 0;
    p.vy = 0;
    p.vz = 0;
    p.spiral = false;
    p.sprite.position.set(x, y, z);
    p.sprite.visible = true;
    this.live += 1;
  }

  private takeDead(pool: Particle[]): Particle | null {
    if (this.live >= LIVE_BUDGET) {
      return null;
    }
    for (const p of pool) {
      if (p.age >= p.life) {
        return p;
      }
    }
    return null;
  }

  private updatePool(pool: Particle[], dt: number, gravity: number): void {
    for (const p of pool) {
      if (p.age >= p.life) {
        continue;
      }
      p.age += dt;
      if (p.age >= p.life) {
        p.sprite.visible = false;
        this.live -= 1;
        continue;
      }
      const u = p.age / p.life;
      if (p.spiral) {
        const radius = p.radius0 * (1 - cubicOut(u));
        const angle = p.angle0 + PORTAL_SPIRAL_TURNS * TWO_PI * u;
        p.sprite.position.set(
          p.cx + Math.sin(angle) * radius,
          p.cy + (this.hash01(p.angle0) - 0.5) * 0.7 * (1 - u),
          p.cz + Math.cos(angle) * radius,
        );
      } else {
        p.vy += gravity * dt;
        p.sprite.position.x += p.vx * dt;
        p.sprite.position.y += p.vy * dt;
        p.sprite.position.z += p.vz * dt;
      }
      const s = p.size * (u < 0.4 ? 1 : 1 - cubicOut((u - 0.4) / 0.6));
      p.sprite.scale.set(s, s, 1);
    }
  }

  private updateRings(dt: number): void {
    for (const p of this.rings) {
      if (p.age >= p.life) {
        continue;
      }
      p.age += dt;
      const material = p.sprite.material;
      if (p.age >= p.life) {
        p.sprite.visible = false;
        material.opacity = 1;
        this.live -= 1;
        continue;
      }
      const u = cubicOut(p.age / p.life);
      const s = RING_START_SCALE + (RING_END_SCALE - RING_START_SCALE) * u;
      p.sprite.scale.set(s, s, 1);
      material.opacity = 1 - u;
    }
  }

  private rand(): number {
    this.lcgState = (Math.imul(this.lcgState, LCG_MULT) + LCG_INC) >>> 0;
    return this.lcgState / 2 ** 32;
  }

  private hash01(seed: number): number {
    const n = Math.sin(seed * 127.1) * 43758.5453;
    return n - Math.floor(n);
  }
}
