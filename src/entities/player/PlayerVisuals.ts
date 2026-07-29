import type {
  MeshStandardMaterial,
  Object3D,
  Scene,
  Sprite,
  SpriteMaterial,
} from "three";
import { Mesh, Vector3 } from "three";

import { tuning } from "../../config/tuning";
import type { EventBus } from "../../core/EventBus";
import type { MaterialFactory } from "../../gfx/MaterialFactory";
import type { MeshFactory } from "../../gfx/MeshFactory";
import { TrailRibbon } from "../../gfx/TrailRibbon";

const BREATHE_AMPLITUDE = 0.015;
const BREATHE_PERIOD_SEC = 2.2;
const BREATHE_BLEND_LERP = 0.08;
const BLINK_MIN_DELAY_SEC = 3;
const BLINK_MAX_DELAY_SEC = 5;
const BLINK_DURATION_SEC = 0.11;
const BLINK_MIN_SCALE_Y = 0.12;
const SQUINT_MIN_SCALE_Y = 0.35;
const JUMP_STRETCH_X = 0.88;
const JUMP_STRETCH_Y = 1.14;
const JUMP_STRETCH_Z = 0.88;
const LAND_SQUASH_X = 1.14;
const LAND_SQUASH_Y = 0.85;
const LAND_SQUASH_Z = 1.14;
const PULSE_ATTACK_SEC = 0.09;
const PULSE_RETURN_SEC = 0.15;

const IDLE_SPEED_EPSILON = 0.3;
const EYE_TRACK_MIN_SPEED = 0.15;
const EYE_MOVE_LEAN_MAX = 0.55;

const DUST_POOL_SIZE = 8;
const DUST_MIN_COUNT = 4;
const DUST_MAX_COUNT = 6;
const DUST_LIFE_SEC = 0.35;
const DUST_SIZE_MIN = 0.16;
const DUST_SIZE_MAX = 0.26;
const DUST_EXPAND_RATIO = 1.1;
const DUST_SPEED_XZ_MIN = 1.0;
const DUST_SPEED_XZ_MAX = 1.8;
const DUST_SPEED_UP_MIN = 0.7;
const DUST_SPEED_UP_MAX = 1.4;
const DUST_IMPACT_SPEED_BASE = 0.6;
const DUST_IMPACT_SPEED_SPAN = 0.8;
const DUST_SPAWN_RADIUS_RATIO = 0.6;
const DUST_SPAWN_LIFT = 0.05;

const LERP_REFERENCE_HZ = 60;

const LCG_MULT = 1664525;
const LCG_INC = 1013904223;
const LCG_SEED = 0x51ab11ed;

const TWO_PI = Math.PI * 2;

function cubicOut(t: number): number {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function wrapAngle(a: number): number {
  let r = a % TWO_PI;
  if (r > Math.PI) {
    r -= TWO_PI;
  } else if (r < -Math.PI) {
    r += TWO_PI;
  }
  return r;
}

function frameLerp(perFrame: number, dtSec: number): number {
  return 1 - Math.pow(1 - perFrame, dtSec * LERP_REFERENCE_HZ);
}

interface DustParticle {
  sprite: Sprite;
  vx: number;
  vy: number;
  vz: number;
  size: number;
}

export interface PlayerVisualsOptions {
  target: Object3D;
  eyeWrapper: Object3D;
  scene: Scene;
  meshes: MeshFactory;
  materials: MaterialFactory;
  bus: EventBus;
  reduceMotion: () => boolean;
  noJuice: () => boolean;
  getVelocity: () => { x: number; y: number; z: number };
  getGrounded: () => boolean;
  getCameraYaw: () => number;
}

export class PlayerVisuals {
  private readonly target: Object3D;
  private readonly eyeWrapper: Object3D;
  private readonly eyes: Object3D[];
  private readonly veinMaterial: MeshStandardMaterial;
  private readonly trail: TrailRibbon;
  private readonly reduceMotion: () => boolean;
  private readonly scene: Scene;
  private readonly noJuice: () => boolean;
  private readonly getVelocity: PlayerVisualsOptions["getVelocity"];
  private readonly getGrounded: () => boolean;
  private readonly getCameraYaw: () => number;
  private readonly unsubs: (() => void)[];

  private readonly dust: DustParticle[];
  private readonly dustMaterial: SpriteMaterial;
  private readonly dustBaseOpacity: number;
  private dustAlive = 0;
  private dustAge = 0;
  private pendingImpact = -1;

  private pulseActive = false;
  private pulseAge = 0;
  private pulseX = 1;
  private pulseY = 1;
  private pulseZ = 1;

  private breatheClock = 0;
  private breatheBlend = 0;

  private blinkClock = 0;
  private blinkAge = 0;
  private blinking = false;
  private nextBlinkDelay: number;

  private eyeTargetYaw = 0;
  private squintAge = Infinity;

  private lcgState = LCG_SEED;

  private readonly worldPos = new Vector3();

  constructor(opts: PlayerVisualsOptions) {
    this.target = opts.target;
    this.eyeWrapper = opts.eyeWrapper;
    this.scene = opts.scene;
    this.noJuice = opts.noJuice;
    this.getVelocity = opts.getVelocity;
    this.getGrounded = opts.getGrounded;
    this.getCameraYaw = opts.getCameraYaw;

    this.reduceMotion = opts.reduceMotion;
    this.eyes = [];
    opts.eyeWrapper.traverse((obj) => {
      if (obj.name === "eye") {
        this.eyes.push(obj);
      }
    });
    if (this.eyes.length === 0) {
      throw new Error("PlayerVisuals: eyeWrapper has no 'eye' children");
    }
    this.eyeTargetYaw = this.eyeWrapper.rotation.y;

    const body = opts.target.getObjectByName("body");
    if (!(body instanceof Mesh)) {
      throw new Error("PlayerVisuals: player root has no 'body' mesh");
    }
    this.veinMaterial = body.material as MeshStandardMaterial;

    this.trail = new TrailRibbon({
      scene: opts.scene,
      materials: opts.materials,
    });

    this.dust = [];
    for (let i = 0; i < DUST_POOL_SIZE; i += 1) {
      const sprite = opts.meshes.particleSprite("dust", DUST_SIZE_MIN);
      sprite.visible = false;
      opts.scene.add(sprite);
      this.dust.push({ sprite, vx: 0, vy: 0, vz: 0, size: DUST_SIZE_MIN });
    }
    const first = this.dust[0];
    if (!first) {
      throw new Error("PlayerVisuals: empty dust pool");
    }
    this.dustMaterial = first.sprite.material;
    this.dustBaseOpacity = this.dustMaterial.opacity;

    this.nextBlinkDelay = this.randRange(
      BLINK_MIN_DELAY_SEC,
      BLINK_MAX_DELAY_SEC,
    );

    this.unsubs = [
      opts.bus.on("player:jumped", () => {
        this.onJumped();
      }),
      opts.bus.on("player:landed", (e) => {
        this.onLanded(e.impact);
      }),
      opts.bus.on("shard:collected", () => {
        if (!this.noJuice()) {
          this.squintAge = 0;
        }
      }),
    ];
  }

  update(frameDtSec: number): void {
    const v = this.getVelocity();
    const speedXZ = Math.hypot(v.x, v.z);

    const camYaw = this.getCameraYaw();
    if (speedXZ > EYE_TRACK_MIN_SPEED) {
      const moveYaw = Math.atan2(v.x, v.z);
      const lean = clamp01(speedXZ / tuning.maxSpeedXZ) * EYE_MOVE_LEAN_MAX;
      this.eyeTargetYaw = camYaw + wrapAngle(moveYaw - camYaw) * lean;
    } else {
      this.eyeTargetYaw = camYaw;
    }
    const yawK = frameLerp(tuning.eyeTrackLerp, frameDtSec);
    this.eyeWrapper.rotation.y = wrapAngle(
      this.eyeWrapper.rotation.y +
        wrapAngle(this.eyeTargetYaw - this.eyeWrapper.rotation.y) * yawK,
    );

    if (this.noJuice()) {
      this.neutralizeJuice();
      return;
    }

    const pitchTarget =
      clamp01(Math.abs(v.y) / tuning.eyePitchVyFull) *
      tuning.eyePitchMaxRad *
      (v.y >= 0 ? -1 : 1);
    this.eyeWrapper.rotation.x +=
      (pitchTarget - this.eyeWrapper.rotation.x) * yawK;

    const veinT = clamp01(speedXZ / tuning.veinSpeedFull);
    this.veinMaterial.emissiveIntensity =
      tuning.veinEmissiveIdle +
      (tuning.veinEmissiveMax - tuning.veinEmissiveIdle) * veinT;

    this.target.getWorldPosition(this.worldPos);
    this.trail.setVisible(!this.reduceMotion());
    this.trail.update(
      frameDtSec,
      this.worldPos.x,
      this.worldPos.y,
      this.worldPos.z,
      speedXZ,
    );

    this.breatheClock += frameDtSec;
    if (this.breatheClock >= BREATHE_PERIOD_SEC) {
      this.breatheClock -= BREATHE_PERIOD_SEC;
    }
    const idle = this.getGrounded() && speedXZ < IDLE_SPEED_EPSILON ? 1 : 0;
    this.breatheBlend +=
      (idle - this.breatheBlend) * frameLerp(BREATHE_BLEND_LERP, frameDtSec);
    const breathe =
      1 +
      BREATHE_AMPLITUDE *
        this.breatheBlend *
        Math.sin((this.breatheClock / BREATHE_PERIOD_SEC) * TWO_PI);

    let amount = 0;
    if (this.pulseActive) {
      this.pulseAge += frameDtSec;
      amount = this.pulseAmount();
    }
    this.target.scale.set(
      breathe * (1 + (this.pulseX - 1) * amount),
      breathe * (1 + (this.pulseY - 1) * amount),
      breathe * (1 + (this.pulseZ - 1) * amount),
    );

    this.updateBlink(frameDtSec);

    if (this.pendingImpact >= 0) {
      this.spawnDust(this.pendingImpact);
      this.pendingImpact = -1;
    }
    this.updateDust(frameDtSec);
  }

  destroy(): void {
    for (const unsub of this.unsubs) {
      unsub();
    }
    this.unsubs.length = 0;
    this.endDustBurst();
    for (const d of this.dust) {
      this.scene.remove(d.sprite);
    }
    this.trail.destroy();
    this.veinMaterial.emissiveIntensity = tuning.veinEmissiveIdle;
    this.target.scale.set(1, 1, 1);
    this.setEyeScaleY(1);
    this.eyeWrapper.rotation.x = 0;
  }

  private onJumped(): void {
    if (this.noJuice()) {
      return;
    }
    this.startPulse(JUMP_STRETCH_X, JUMP_STRETCH_Y, JUMP_STRETCH_Z);
  }

  private onLanded(impact: number): void {
    if (this.noJuice()) {
      return;
    }
    this.startPulse(LAND_SQUASH_X, LAND_SQUASH_Y, LAND_SQUASH_Z);
    this.pendingImpact = clamp01(impact);
  }

  private startPulse(x: number, y: number, z: number): void {
    this.pulseX = x;
    this.pulseY = y;
    this.pulseZ = z;
    this.pulseAge = 0;
    this.pulseActive = true;
  }

  private pulseAmount(): number {
    if (this.pulseAge < PULSE_ATTACK_SEC) {
      return cubicOut(this.pulseAge / PULSE_ATTACK_SEC);
    }
    const r = (this.pulseAge - PULSE_ATTACK_SEC) / PULSE_RETURN_SEC;
    if (r >= 1) {
      this.pulseActive = false;
      return 0;
    }
    return 1 - cubicOut(r);
  }

  private updateBlink(frameDtSec: number): void {
    let scaleY = 1;

    if (this.squintAge < tuning.eyeSquintSec) {
      this.squintAge += frameDtSec;
      const s = clamp01(this.squintAge / tuning.eyeSquintSec);
      scaleY = SQUINT_MIN_SCALE_Y + (1 - SQUINT_MIN_SCALE_Y) * cubicOut(s);
    }

    if (!this.blinking) {
      this.blinkClock += frameDtSec;
      if (this.blinkClock >= this.nextBlinkDelay) {
        this.blinking = true;
        this.blinkAge = 0;
      }
    }
    if (this.blinking) {
      this.blinkAge += frameDtSec;
      const u = this.blinkAge / BLINK_DURATION_SEC;
      if (u >= 1) {
        this.blinking = false;
        this.blinkClock = 0;
        this.nextBlinkDelay = this.randRange(
          BLINK_MIN_DELAY_SEC,
          BLINK_MAX_DELAY_SEC,
        );
      } else {
        scaleY = Math.min(
          scaleY,
          1 - (1 - BLINK_MIN_SCALE_Y) * Math.sin(Math.PI * u),
        );
      }
    }

    this.setEyeScaleY(scaleY);
  }

  private setEyeScaleY(scaleY: number): void {
    for (const eye of this.eyes) {
      eye.scale.y = scaleY;
    }
  }

  private spawnDust(impact: number): void {
    this.target.getWorldPosition(this.worldPos);
    const baseX = this.worldPos.x;
    const baseY = this.worldPos.y - tuning.ballRadius + DUST_SPAWN_LIFT;
    const baseZ = this.worldPos.z;
    const spawnRadius = tuning.ballRadius * DUST_SPAWN_RADIUS_RATIO;

    const count =
      DUST_MIN_COUNT + Math.round(impact * (DUST_MAX_COUNT - DUST_MIN_COUNT));
    const speedMult = DUST_IMPACT_SPEED_BASE + impact * DUST_IMPACT_SPEED_SPAN;

    for (let i = 0; i < this.dust.length; i += 1) {
      const d = this.dust[i];
      if (!d) {
        break;
      }
      if (i >= count) {
        d.sprite.visible = false;
        continue;
      }
      const angle = this.rand() * TWO_PI;
      const speedXZ =
        (DUST_SPEED_XZ_MIN +
          this.rand() * (DUST_SPEED_XZ_MAX - DUST_SPEED_XZ_MIN)) *
        speedMult;
      d.vx = Math.sin(angle) * speedXZ;
      d.vz = Math.cos(angle) * speedXZ;
      d.vy =
        (DUST_SPEED_UP_MIN +
          this.rand() * (DUST_SPEED_UP_MAX - DUST_SPEED_UP_MIN)) *
        speedMult;
      d.size = DUST_SIZE_MIN + this.rand() * (DUST_SIZE_MAX - DUST_SIZE_MIN);
      d.sprite.position.set(
        baseX + Math.sin(angle) * spawnRadius,
        baseY,
        baseZ + Math.cos(angle) * spawnRadius,
      );
      d.sprite.scale.set(d.size, d.size, 1);
      d.sprite.visible = true;
    }

    this.dustAlive = count;
    this.dustAge = 0;
    this.dustMaterial.opacity = this.dustBaseOpacity;
  }

  private updateDust(frameDtSec: number): void {
    if (this.dustAlive === 0) {
      return;
    }
    this.dustAge += frameDtSec;
    const u = this.dustAge / DUST_LIFE_SEC;
    if (u >= 1) {
      this.endDustBurst();
      return;
    }
    this.dustMaterial.opacity = this.dustBaseOpacity * (1 - u * u);
    const grow = 1 + DUST_EXPAND_RATIO * cubicOut(u);
    for (let i = 0; i < this.dustAlive; i += 1) {
      const d = this.dust[i];
      if (!d) {
        break;
      }
      d.sprite.position.x += d.vx * frameDtSec;
      d.sprite.position.y += d.vy * frameDtSec;
      d.sprite.position.z += d.vz * frameDtSec;
      const size = d.size * grow;
      d.sprite.scale.set(size, size, 1);
    }
  }

  private endDustBurst(): void {
    for (let i = 0; i < this.dustAlive; i += 1) {
      const d = this.dust[i];
      if (!d) {
        break;
      }
      d.sprite.visible = false;
    }
    this.dustAlive = 0;
    this.dustMaterial.opacity = this.dustBaseOpacity;
  }

  private neutralizeJuice(): void {
    if (this.dustAlive > 0) {
      this.endDustBurst();
    }
    this.pulseActive = false;
    this.pendingImpact = -1;
    this.blinking = false;
    this.blinkClock = 0;
    this.breatheBlend = 0;
    this.squintAge = Infinity;
    this.trail.setVisible(false);
    this.veinMaterial.emissiveIntensity = tuning.veinEmissiveIdle;
    this.target.scale.set(1, 1, 1);
    this.setEyeScaleY(1);
    this.eyeWrapper.rotation.x = 0;
  }

  private rand(): number {
    this.lcgState = (Math.imul(this.lcgState, LCG_MULT) + LCG_INC) >>> 0;
    return this.lcgState / 2 ** 32;
  }

  private randRange(min: number, max: number): number {
    return min + this.rand() * (max - min);
  }
}
