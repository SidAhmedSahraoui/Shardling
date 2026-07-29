import type { RigidBody, World } from "@dimforge/rapier3d-compat";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d-compat";
import type { Group, Mesh, Scene } from "three";

import { tuning } from "../config/tuning";
import type { EventBus } from "../core/EventBus";
import {
  terrainColliderGroups,
  triggerColliderGroups,
} from "../game/physics/groups";
import { removeBody } from "../game/physics/queries";
import type { MaterialFactory } from "../gfx/MaterialFactory";
import type { MeshFactory } from "../gfx/MeshFactory";
import { setPortalActive } from "../gfx/MeshFactory";

const PORTAL_BASE_WIDTH = 3.2;
const PORTAL_BASE_DEPTH = 1.4;
const PORTAL_BASE_HEIGHT = 0.3;
const PORTAL_PILLAR_HEIGHT = 2.2;
const PORTAL_PILLAR_X = 1.4;
const PORTAL_PILLAR_WIDTH = 0.35;

const SENSOR_HALF_WIDTH = PORTAL_PILLAR_X - PORTAL_PILLAR_WIDTH / 2;
const SENSOR_HALF_HEIGHT = PORTAL_PILLAR_HEIGHT / 2;
const SENSOR_CENTER_Y = PORTAL_BASE_HEIGHT + SENSOR_HALF_HEIGHT;
const SENSOR_HALF_DEPTH = 0.3;

const DEG_TO_RAD = Math.PI / 180;

const RING_CENTER_LIFT = 1.42;

export interface PortalOptions {
  world: World;
  scene: Scene;
  meshes: MeshFactory;
  materials: MaterialFactory;
  bus: EventBus;
  position: { x: number; y: number; z: number };
  rotYDeg: number;
  worldIndex?: number;
}

export class Portal {
  readonly colliderHandle: number;

  private readonly world: World;
  private readonly scene: Scene;
  private readonly materials: MaterialFactory;
  private readonly group: Group;
  private readonly body: RigidBody;
  private activeFlag = false;

  constructor(opts: PortalOptions) {
    this.world = opts.world;
    this.scene = opts.scene;
    this.materials = opts.materials;

    this.group = opts.meshes.portal();
    opts.meshes.applyWorldTheme(this.group, opts.worldIndex);
    this.group.position.set(opts.position.x, opts.position.y, opts.position.z);
    this.group.rotation.y = opts.rotYDeg * DEG_TO_RAD;
    this.scene.add(this.group);
    this.ringCenterOut.x = opts.position.x;
    this.ringCenterOut.y = opts.position.y + RING_CENTER_LIFT;
    this.ringCenterOut.z = opts.position.z;

    const halfYaw = (opts.rotYDeg * DEG_TO_RAD) / 2;
    this.body = this.world.createRigidBody(
      RigidBodyDesc.fixed()
        .setTranslation(opts.position.x, opts.position.y, opts.position.z)
        .setRotation({
          x: 0,
          y: Math.sin(halfYaw),
          z: 0,
          w: Math.cos(halfYaw),
        }),
    );
    const collider = this.world.createCollider(
      ColliderDesc.cuboid(
        SENSOR_HALF_WIDTH,
        SENSOR_HALF_HEIGHT,
        SENSOR_HALF_DEPTH,
      )
        .setTranslation(0, SENSOR_CENTER_Y, 0)
        .setSensor(true)
        .setCollisionGroups(triggerColliderGroups),
      this.body,
    );
    this.colliderHandle = collider.handle;

    this.world.createCollider(
      ColliderDesc.cuboid(
        PORTAL_BASE_WIDTH / 2,
        PORTAL_BASE_HEIGHT / 2,
        PORTAL_BASE_DEPTH / 2,
      )
        .setTranslation(0, PORTAL_BASE_HEIGHT / 2, 0)
        .setFriction(tuning.friction)
        .setRestitution(tuning.restitution)
        .setCollisionGroups(terrainColliderGroups),
      this.body,
    );
    for (const side of [-1, 1]) {
      this.world.createCollider(
        ColliderDesc.cuboid(
          PORTAL_PILLAR_WIDTH / 2,
          PORTAL_PILLAR_HEIGHT / 2,
          PORTAL_PILLAR_WIDTH / 2,
        )
          .setTranslation(
            side * PORTAL_PILLAR_X,
            PORTAL_BASE_HEIGHT + PORTAL_PILLAR_HEIGHT / 2,
            0,
          )
          .setFriction(tuning.friction)
          .setRestitution(tuning.restitution)
          .setCollisionGroups(terrainColliderGroups),
        this.body,
      );
    }
  }

  get active(): boolean {
    return this.activeFlag;
  }

  get ringCenter(): { x: number; y: number; z: number } {
    return this.ringCenterOut;
  }
  private readonly ringCenterOut = { x: 0, y: 0, z: 0 };

  setActive(v: boolean): void {
    if (v === this.activeFlag) {
      return;
    }
    this.activeFlag = v;
    setPortalActive(this.group, v, this.materials);
  }

  update(frameDtSec: number): void {
    void frameDtSec;
  }

  destroy(): void {
    removeBody(this.world, this.body);
    this.scene.remove(this.group);
    this.group.traverse((obj) => {
      const mesh = obj as Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
      }
    });
  }
}
