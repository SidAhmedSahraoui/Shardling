import type { Collider, RigidBody, World } from "@dimforge/rapier3d-compat";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d-compat";
import type { Mesh, Scene } from "three";
import { Group } from "three";

import { tuning } from "../config/tuning";
import type { EventBus } from "../core/EventBus";
import { pickupColliderGroups } from "../game/physics/groups";
import { removeBody } from "../game/physics/queries";
import type { MeshFactory } from "../gfx/MeshFactory";

function cubicOut(t: number): number {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

const BOB_AMPLITUDE = 0.1;
const BOB_PERIOD_SEC = 1.6;
const BOB_OMEGA = (Math.PI * 2) / BOB_PERIOD_SEC;
const BOB_PHASE_STEP_RAD = 2.4;
const SPIN_RAD_PER_SEC = 1.2;
const PICKUP_RADIUS = 0.6;

const POP_PEAK = 1.4;
const POP_PEAK_AT = 0.35;

export interface ShardOptions {
  world: World;
  scene: Scene;
  meshes: MeshFactory;
  bus: EventBus;
  position: { x: number; y: number; z: number };
  index: number;
  total: number;
}

export class Shard {
  readonly colliderHandle: number;

  private readonly world: World;
  private readonly scene: Scene;
  private readonly bus: EventBus;
  private readonly index: number;
  private readonly total: number;

  private readonly wrapper: Group;
  private readonly mesh: Mesh;
  private readonly body: RigidBody;
  private readonly collider: Collider;

  private readonly bobPhase: number;
  private timeSec = 0;
  private collectedFlag = false;
  private popAge = Infinity;

  constructor(opts: ShardOptions) {
    this.world = opts.world;
    this.scene = opts.scene;
    this.bus = opts.bus;
    this.index = opts.index;
    this.total = opts.total;
    this.bobPhase = opts.index * BOB_PHASE_STEP_RAD;

    this.wrapper = new Group();
    this.wrapper.name = "shard";
    this.mesh = opts.meshes.shard();
    this.wrapper.add(this.mesh);
    this.wrapper.position.set(
      opts.position.x,
      opts.position.y,
      opts.position.z,
    );
    this.scene.add(this.wrapper);

    this.body = this.world.createRigidBody(
      RigidBodyDesc.fixed().setTranslation(
        opts.position.x,
        opts.position.y,
        opts.position.z,
      ),
    );
    this.collider = this.world.createCollider(
      ColliderDesc.ball(PICKUP_RADIUS)
        .setSensor(true)
        .setCollisionGroups(pickupColliderGroups),
      this.body,
    );
    this.colliderHandle = this.collider.handle;
  }

  get collected(): boolean {
    return this.collectedFlag;
  }

  get position(): { x: number; y: number; z: number } {
    return this.wrapper.position;
  }

  update(frameDtSec: number): void {
    if (this.collectedFlag) {
      const popSec = tuning.collectPopMs / 1000;
      if (this.popAge >= popSec) {
        return;
      }
      this.popAge += frameDtSec;
      if (this.popAge >= popSec) {
        this.wrapper.visible = false;
        this.wrapper.scale.setScalar(1);
        return;
      }
      const u = this.popAge / popSec;
      const s =
        u < POP_PEAK_AT
          ? 1 + (POP_PEAK - 1) * cubicOut(u / POP_PEAK_AT)
          : POP_PEAK * (1 - cubicOut((u - POP_PEAK_AT) / (1 - POP_PEAK_AT)));
      this.wrapper.scale.setScalar(Math.max(s, 0.0001));
      this.mesh.rotation.y += SPIN_RAD_PER_SEC * 3 * frameDtSec;
      return;
    }
    this.timeSec += frameDtSec;
    this.mesh.position.y =
      Math.sin(this.timeSec * BOB_OMEGA + this.bobPhase) * BOB_AMPLITUDE;
    this.mesh.rotation.y += SPIN_RAD_PER_SEC * frameDtSec;
  }

  collect(instant = false): void {
    if (this.collectedFlag) {
      return;
    }
    this.collectedFlag = true;
    this.collider.setEnabled(false);
    if (instant) {
      this.popAge = Infinity;
      this.wrapper.visible = false;
    } else {
      this.popAge = 0;
    }
    this.bus.emit("shard:collected", { index: this.index, total: this.total });
  }

  reset(): void {
    this.collectedFlag = false;
    this.popAge = Infinity;
    this.wrapper.visible = true;
    this.wrapper.scale.setScalar(1);
    this.collider.setEnabled(true);
  }

  destroy(): void {
    removeBody(this.world, this.body);
    this.scene.remove(this.wrapper);
    this.mesh.geometry.dispose();
  }
}
