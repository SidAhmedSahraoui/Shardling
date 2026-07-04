import type { Collider, RigidBody, World } from "@dimforge/rapier3d-compat";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d-compat";
import type { Group, Mesh, Scene } from "three";
import { MeshStandardMaterial } from "three";

import { tuning } from "../../config/tuning";
import { terrainColliderGroups } from "../../game/physics/groups";
import { removeBody } from "../../game/physics/queries";
import type { MeshFactory } from "../../gfx/MeshFactory";
import type { CrumbleData } from "../../levels/schema";

const CRUMBLE_THICKNESS = 0.5;

const TINT_LIGHTEN = 1.45;

const SHAKE_AMPLITUDE = 0.05;
const SHAKE_HZ_A = 31;
const SHAKE_HZ_B = 47;

const COLLAPSE_DROP = 1.4;

const REDUCE_MOTION_SHAKE_OPACITY = 0.55;

const RESPAWN_CLEARANCE = 0.6;

type CrumbleState = "intact" | "shaking" | "collapsing" | "gone";

export interface CrumbleOptions {
  world: World;
  scene: Scene;
  meshes: MeshFactory;
  data: CrumbleData;
  reduceMotion: () => boolean;
}

export class Crumble {
  readonly colliderHandle: number;

  private readonly world: World;
  private readonly scene: Scene;
  private readonly reduceMotion: () => boolean;
  private readonly wrapper: Group;
  private readonly body: RigidBody;
  private readonly collider: Collider;
  private readonly ownedMaterials: MeshStandardMaterial[] = [];

  private readonly min: { x: number; y: number; z: number };
  private readonly max: { x: number; y: number; z: number };
  private readonly center: { x: number; y: number; z: number };

  private state: CrumbleState = "intact";
  private stateAge = 0;

  constructor(opts: CrumbleOptions) {
    this.world = opts.world;
    this.scene = opts.scene;
    this.reduceMotion = opts.reduceMotion;
    const { data } = opts;

    this.min = { x: data.x, y: data.y, z: data.z };
    this.max = {
      x: data.x + data.w,
      y: data.y + CRUMBLE_THICKNESS,
      z: data.z + data.d,
    };
    this.center = {
      x: data.x + data.w / 2,
      y: data.y + CRUMBLE_THICKNESS / 2,
      z: data.z + data.d / 2,
    };

    this.wrapper = opts.meshes.platform(data.w, CRUMBLE_THICKNESS, data.d);
    this.wrapper.name = "crumble";
    this.wrapper.position.set(this.center.x, this.center.y, this.center.z);
    this.wrapper.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) {
        return;
      }
      if (mesh.material instanceof MeshStandardMaterial) {
        const clone = mesh.material.clone();
        clone.color.multiplyScalar(TINT_LIGHTEN);
        clone.transparent = true;
        mesh.material = clone;
        this.ownedMaterials.push(clone);
      }
    });
    this.scene.add(this.wrapper);

    this.body = this.world.createRigidBody(
      RigidBodyDesc.fixed().setTranslation(
        this.center.x,
        this.center.y,
        this.center.z,
      ),
    );
    this.collider = this.world.createCollider(
      ColliderDesc.cuboid(data.w / 2, CRUMBLE_THICKNESS / 2, data.d / 2)
        .setFriction(tuning.friction)
        .setRestitution(tuning.restitution)
        .setCollisionGroups(terrainColliderGroups),
      this.body,
    );
    this.colliderHandle = this.collider.handle;
  }

  trigger(): void {
    if (this.state === "intact") {
      this.setState("shaking");
    }
  }

  physicsStep(
    dtSec: number,
    playerPos: { x: number; y: number; z: number },
  ): void {
    this.stateAge += dtSec;
    switch (this.state) {
      case "intact":
        break;
      case "shaking":
        if (this.stateAge >= tuning.crumbleShakeSec) {
          this.collider.setEnabled(false);
          this.setState("collapsing");
        }
        break;
      case "collapsing":
        if (this.stateAge >= tuning.crumbleCollapseSec) {
          this.setState("gone");
        }
        break;
      case "gone":
        if (
          this.stateAge >= tuning.crumbleRespawnSec &&
          !this.overlapsBall(playerPos)
        ) {
          this.restore();
        }
        break;
    }
  }

  update(frameDtSec: number): void {
    void frameDtSec;
    const reduce = this.reduceMotion();
    switch (this.state) {
      case "intact":
        break;
      case "shaking": {
        if (reduce) {
          this.setOpacity(REDUCE_MOTION_SHAKE_OPACITY);
          break;
        }
        const t = this.stateAge;
        this.wrapper.position.x =
          this.center.x + Math.sin(t * SHAKE_HZ_A) * SHAKE_AMPLITUDE;
        this.wrapper.position.z =
          this.center.z + Math.sin(t * SHAKE_HZ_B) * SHAKE_AMPLITUDE;
        break;
      }
      case "collapsing": {
        this.wrapper.position.x = this.center.x;
        this.wrapper.position.z = this.center.z;
        const p = Math.min(1, this.stateAge / tuning.crumbleCollapseSec);
        if (!reduce) {
          this.wrapper.position.y = this.center.y - COLLAPSE_DROP * p * p * p;
        }
        this.setOpacity(1 - p);
        break;
      }
      case "gone":
        this.wrapper.visible = false;
        break;
    }
  }

  reset(): void {
    this.restore();
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
    for (const material of this.ownedMaterials) {
      material.dispose();
    }
    this.ownedMaterials.length = 0;
  }

  private setState(state: CrumbleState): void {
    this.state = state;
    this.stateAge = 0;
  }

  private restore(): void {
    this.collider.setEnabled(true);
    this.wrapper.visible = true;
    this.wrapper.position.set(this.center.x, this.center.y, this.center.z);
    this.setOpacity(1);
    this.setState("intact");
  }

  private setOpacity(value: number): void {
    for (const material of this.ownedMaterials) {
      material.opacity = value;
    }
  }

  private overlapsBall(p: { x: number; y: number; z: number }): boolean {
    return (
      p.x > this.min.x - RESPAWN_CLEARANCE &&
      p.x < this.max.x + RESPAWN_CLEARANCE &&
      p.y > this.min.y - RESPAWN_CLEARANCE &&
      p.y < this.max.y + RESPAWN_CLEARANCE &&
      p.z > this.min.z - RESPAWN_CLEARANCE &&
      p.z < this.max.z + RESPAWN_CLEARANCE
    );
  }
}
