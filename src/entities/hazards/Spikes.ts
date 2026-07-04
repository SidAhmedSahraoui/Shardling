import type { RigidBody, World } from "@dimforge/rapier3d-compat";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d-compat";
import type { Mesh, Scene } from "three";
import { Group } from "three";

import { hazardColliderGroups } from "../../game/physics/groups";
import { removeBody } from "../../game/physics/queries";
import type { MeshFactory } from "../../gfx/MeshFactory";

const TOOTH_HEIGHT = 0.45;

export type SpikesFace = "up" | "down" | "+x" | "-x" | "+z" | "-z";

export interface SpikesData {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  face: SpikesFace;
}

export interface SpikesOptions {
  world: World;
  scene: Scene;
  meshes: MeshFactory;
  data: SpikesData;
}

export class Spikes {
  readonly colliderHandle: number;

  private readonly world: World;
  private readonly scene: Scene;
  private readonly wrapper: Group;
  private readonly strip: Mesh;
  private readonly body: RigidBody;

  constructor(opts: SpikesOptions) {
    this.world = opts.world;
    this.scene = opts.scene;
    const { x, y, z, w, d, face } = opts.data;

    this.wrapper = new Group();
    this.wrapper.name = "spikes";
    this.strip = opts.meshes.spikeStrip(w, d);
    this.wrapper.add(this.strip);

    switch (face) {
      case "up":
        this.wrapper.position.set(x + w / 2, y, z + d / 2);
        break;
      case "down":
        this.wrapper.position.set(x + w / 2, y, z + d / 2);
        this.wrapper.rotation.x = Math.PI;
        break;
      case "+x":
        this.wrapper.position.set(x, y + w / 2, z + d / 2);
        this.wrapper.rotation.z = -Math.PI / 2;
        break;
      case "-x":
        this.wrapper.position.set(x, y + w / 2, z + d / 2);
        this.wrapper.rotation.z = Math.PI / 2;
        break;
      case "+z":
        this.wrapper.position.set(x + w / 2, y + d / 2, z);
        this.wrapper.rotation.x = Math.PI / 2;
        break;
      case "-z":
        this.wrapper.position.set(x + w / 2, y + d / 2, z);
        this.wrapper.rotation.x = -Math.PI / 2;
        break;
    }
    this.scene.add(this.wrapper);

    const q = this.wrapper.quaternion;
    this.body = this.world.createRigidBody(
      RigidBodyDesc.fixed()
        .setTranslation(
          this.wrapper.position.x,
          this.wrapper.position.y,
          this.wrapper.position.z,
        )
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
    );
    const collider = this.world.createCollider(
      ColliderDesc.cuboid(w / 2, TOOTH_HEIGHT / 2, d / 2)
        .setTranslation(0, TOOTH_HEIGHT / 2, 0)
        .setSensor(true)
        .setCollisionGroups(hazardColliderGroups),
      this.body,
    );
    this.colliderHandle = collider.handle;
  }

  destroy(): void {
    removeBody(this.world, this.body);
    this.scene.remove(this.wrapper);
    this.strip.geometry.dispose();
  }
}
