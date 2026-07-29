import type { RigidBody, World } from "@dimforge/rapier3d-compat";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d-compat";
import type { Group, Mesh, Object3D, Scene } from "three";

import { tuning } from "../config/tuning";
import {
  terrainColliderGroups,
  triggerColliderGroups,
} from "../game/physics/groups";
import { removeBody } from "../game/physics/queries";
import type { MeshFactory } from "../gfx/MeshFactory";

const PAD_RADIUS = 0.6;
const PAD_SOLID_HEIGHT = 0.34;

const SENSOR_RADIUS = 0.55;
const SENSOR_HALF_HEIGHT = 0.3;

const SQUASH_SEC = 0.22;
const SQUASH_DEPTH = 0.65;

export interface BouncerOptions {
  world: World;
  scene: Scene;
  meshes: MeshFactory;
  position: { x: number; y: number; z: number };
  worldIndex?: number;
}

export class Bouncer {
  readonly colliderHandle: number;
  readonly padColliderHandle: number;

  private readonly world: World;
  private readonly scene: Scene;
  private readonly wrapper: Group;
  private readonly pad: Object3D;
  private readonly body: RigidBody;

  private squashAge = SQUASH_SEC;

  constructor(opts: BouncerOptions) {
    this.world = opts.world;
    this.scene = opts.scene;
    const { position } = opts;

    this.wrapper = opts.meshes.bouncer();
    opts.meshes.applyWorldTheme(this.wrapper, opts.worldIndex);
    const pad = this.wrapper.getObjectByName("pad");
    if (!pad) {
      throw new Error("Bouncer: factory bouncer is missing its pad child");
    }
    this.pad = pad;
    this.wrapper.position.set(position.x, position.y, position.z);
    this.scene.add(this.wrapper);

    this.body = this.world.createRigidBody(
      RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z),
    );
    const padCollider = this.world.createCollider(
      ColliderDesc.cylinder(PAD_SOLID_HEIGHT / 2, PAD_RADIUS)
        .setTranslation(0, PAD_SOLID_HEIGHT / 2, 0)
        .setFriction(tuning.friction)
        .setRestitution(tuning.restitution)
        .setCollisionGroups(terrainColliderGroups),
      this.body,
    );
    this.padColliderHandle = padCollider.handle;
    const sensor = this.world.createCollider(
      ColliderDesc.cylinder(SENSOR_HALF_HEIGHT, SENSOR_RADIUS)
        .setTranslation(0, PAD_SOLID_HEIGHT + SENSOR_HALF_HEIGHT, 0)
        .setSensor(true)
        .setCollisionGroups(triggerColliderGroups),
      this.body,
    );
    this.colliderHandle = sensor.handle;
  }

  squash(): void {
    this.squashAge = 0;
  }

  update(frameDtSec: number, reduceMotion: boolean): void {
    if (this.squashAge >= SQUASH_SEC) {
      this.pad.scale.y = 1;
      return;
    }
    this.squashAge += frameDtSec;
    if (reduceMotion) {
      this.pad.scale.y = 1;
      return;
    }
    const p = Math.min(1, this.squashAge / SQUASH_SEC);
    this.pad.scale.y = 1 - SQUASH_DEPTH * Math.sin(Math.PI * p);
  }

  destroy(): void {
    removeBody(this.world, this.body);
    this.scene.remove(this.wrapper);
    this.wrapper.traverse((obj) => {
      const mesh = obj as Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
      }
    });
  }
}
