import type { RigidBody, World } from "@dimforge/rapier3d-compat";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d-compat";
import type { Group, Mesh, Object3D, Scene } from "three";
import { Vector3 } from "three";

import { tuning } from "../../config/tuning";
import { PathFollower } from "../../game/PathFollower";
import { hazardColliderGroups } from "../../game/physics/groups";
import { removeBody } from "../../game/physics/queries";
import type { MeshFactory } from "../../gfx/MeshFactory";
import type { BladeData } from "../../levels/schema";

const SENSOR_HALF_HEIGHT = 0.2;

const DEFAULT_MODE = "pingpong";

export interface BladeOptions {
  world: World;
  scene: Scene;
  meshes: MeshFactory;
  data: BladeData;
}

export class Blade {
  readonly colliderHandle: number;

  private readonly world: World;
  private readonly scene: Scene;
  private readonly wrapper: Group;
  private readonly disc: Object3D;
  private readonly body: RigidBody;
  private readonly follower: PathFollower | null;

  private readonly prevPos = new Vector3();
  private readonly currPos = new Vector3();
  private readonly nextScratch = { x: 0, y: 0, z: 0 };

  constructor(opts: BladeOptions) {
    this.world = opts.world;
    this.scene = opts.scene;
    const { data } = opts;

    this.follower = data.path
      ? new PathFollower(data.path, data.speed ?? 1, data.mode ?? DEFAULT_MODE)
      : null;

    const start = this.follower ? this.follower.position : data;
    this.currPos.set(start.x, start.y, start.z);
    this.prevPos.copy(this.currPos);

    this.wrapper = opts.meshes.blade(data.r);
    const disc = this.wrapper.getObjectByName("disc");
    if (!disc) {
      throw new Error("Blade: factory blade is missing its disc child");
    }
    this.disc = disc;
    this.wrapper.position.copy(this.currPos);
    this.scene.add(this.wrapper);

    this.body = this.world.createRigidBody(
      (this.follower
        ? RigidBodyDesc.kinematicPositionBased()
        : RigidBodyDesc.fixed()
      ).setTranslation(this.currPos.x, this.currPos.y, this.currPos.z),
    );
    const collider = this.world.createCollider(
      ColliderDesc.cylinder(SENSOR_HALF_HEIGHT, data.r)
        .setSensor(true)
        .setCollisionGroups(hazardColliderGroups),
      this.body,
    );
    this.colliderHandle = collider.handle;
  }

  physicsStep(dtSec: number): void {
    if (!this.follower) {
      return;
    }
    this.follower.advance(dtSec);
    this.prevPos.copy(this.currPos);
    this.currPos.set(
      this.follower.position.x,
      this.follower.position.y,
      this.follower.position.z,
    );
    this.nextScratch.x = this.currPos.x;
    this.nextScratch.y = this.currPos.y;
    this.nextScratch.z = this.currPos.z;
    this.body.setNextKinematicTranslation(this.nextScratch);
  }

  update(frameDtSec: number, alpha: number): void {
    this.disc.rotation.y +=
      frameDtSec * tuning.bladeSpinRevPerSec * Math.PI * 2;
    if (this.follower) {
      this.wrapper.position.lerpVectors(this.prevPos, this.currPos, alpha);
    }
  }

  reset(): void {
    if (!this.follower) {
      return;
    }
    this.follower.reset();
    this.currPos.set(
      this.follower.position.x,
      this.follower.position.y,
      this.follower.position.z,
    );
    this.prevPos.copy(this.currPos);
    this.nextScratch.x = this.currPos.x;
    this.nextScratch.y = this.currPos.y;
    this.nextScratch.z = this.currPos.z;
    this.body.setTranslation(this.nextScratch, true);
    this.wrapper.position.copy(this.currPos);
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
