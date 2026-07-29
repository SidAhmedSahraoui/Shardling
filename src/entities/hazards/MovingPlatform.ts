import type { RigidBody, World } from "@dimforge/rapier3d-compat";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d-compat";
import type { Group, Mesh, Scene } from "three";
import { Vector3 } from "three";

import { tuning } from "../../config/tuning";
import { PathFollower } from "../../game/PathFollower";
import { terrainColliderGroups } from "../../game/physics/groups";
import { removeBody } from "../../game/physics/queries";
import type { MeshFactory } from "../../gfx/MeshFactory";
import type { PlatformData } from "../../levels/schema";

const PLATFORM_THICKNESS = 0.5;

export interface MovingPlatformOptions {
  world: World;
  scene: Scene;
  meshes: MeshFactory;
  data: PlatformData;
  worldIndex?: number;
}

export class MovingPlatform {
  readonly colliderHandle: number;
  readonly velocity = { x: 0, y: 0, z: 0 };

  private readonly world: World;
  private readonly scene: Scene;
  private readonly wrapper: Group;
  private readonly body: RigidBody;
  private readonly follower: PathFollower;

  private readonly halfW: number;
  private readonly halfD: number;

  private readonly prevPos = new Vector3();
  private readonly currPos = new Vector3();
  private readonly nextScratch = { x: 0, y: 0, z: 0 };

  constructor(opts: MovingPlatformOptions) {
    this.world = opts.world;
    this.scene = opts.scene;
    const { data } = opts;
    this.halfW = data.w / 2;
    this.halfD = data.d / 2;

    this.follower = new PathFollower(data.path, data.speed, data.mode);

    this.wrapper = opts.meshes.platform(data.w, PLATFORM_THICKNESS, data.d);
    opts.meshes.applyWorldTheme(this.wrapper, opts.worldIndex);
    this.wrapper.name = "movingPlatform";
    this.currPos.set(
      this.follower.position.x + this.halfW,
      this.follower.position.y + PLATFORM_THICKNESS / 2,
      this.follower.position.z + this.halfD,
    );
    this.prevPos.copy(this.currPos);
    this.wrapper.position.copy(this.currPos);
    this.scene.add(this.wrapper);

    this.body = this.world.createRigidBody(
      RigidBodyDesc.kinematicPositionBased().setTranslation(
        this.currPos.x,
        this.currPos.y,
        this.currPos.z,
      ),
    );
    const collider = this.world.createCollider(
      ColliderDesc.cuboid(this.halfW, PLATFORM_THICKNESS / 2, this.halfD)
        .setFriction(tuning.friction)
        .setRestitution(tuning.restitution)
        .setCollisionGroups(terrainColliderGroups),
      this.body,
    );
    this.colliderHandle = collider.handle;
  }

  physicsStep(dtSec: number): void {
    this.follower.advance(dtSec);
    this.prevPos.copy(this.currPos);
    this.currPos.set(
      this.follower.position.x + this.halfW,
      this.follower.position.y + PLATFORM_THICKNESS / 2,
      this.follower.position.z + this.halfD,
    );
    this.velocity.x = (this.currPos.x - this.prevPos.x) / dtSec;
    this.velocity.y = (this.currPos.y - this.prevPos.y) / dtSec;
    this.velocity.z = (this.currPos.z - this.prevPos.z) / dtSec;
    this.nextScratch.x = this.currPos.x;
    this.nextScratch.y = this.currPos.y;
    this.nextScratch.z = this.currPos.z;
    this.body.setNextKinematicTranslation(this.nextScratch);
  }

  render(alpha: number): void {
    this.wrapper.position.lerpVectors(this.prevPos, this.currPos, alpha);
  }

  reset(): void {
    this.follower.reset();
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.velocity.z = 0;
    this.currPos.set(
      this.follower.position.x + this.halfW,
      this.follower.position.y + PLATFORM_THICKNESS / 2,
      this.follower.position.z + this.halfD,
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
