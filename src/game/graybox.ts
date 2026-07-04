import type { RigidBody, World } from "@dimforge/rapier3d-compat";
import type { Mesh, Object3D, Scene } from "three";
import { Group } from "three";

import { Bouncer } from "../entities/Bouncer";
import type { ColliderTag } from "../entities/EntityFactory";
import { Blade } from "../entities/hazards/Blade";
import { Crumble } from "../entities/hazards/Crumble";
import { MovingPlatform } from "../entities/hazards/MovingPlatform";
import type { MeshFactory } from "../gfx/MeshFactory";
import { addStaticBox, addStaticCuboid, removeBody } from "./physics/queries";

export interface Graybox {
  root: Object3D;
  spawn: { x: number; y: number; z: number };
  killY: number;
  colliderTags: Map<number, ColliderTag>;
  crumbleByHandle: Map<number, Crumble>;
  platformByHandle: Map<number, MovingPlatform>;
  physicsStep(
    dtSec: number,
    playerPos: { x: number; y: number; z: number },
  ): void;
  update(frameDtSec: number, alpha: number): void;
  resetDynamic(): void;
  dispose(): void;
}

const SPAWN = { x: -4, y: 1, z: 0 };
const KILL_Y = -8;

const RAMP = { w: 4, h: 2, d: 3, cx: 0, cy: 1, cz: 5 };
const RAMP_THICKNESS = 0.5;

export function buildGraybox(
  world: World,
  scene: Scene,
  meshes: MeshFactory,
  reduceMotion: () => boolean,
): Graybox {
  const root = new Group();
  root.name = "graybox";
  const bodies: RigidBody[] = [];

  const box = (
    minX: number,
    minY: number,
    minZ: number,
    w: number,
    h: number,
    d: number,
  ): void => {
    const platform = meshes.platform(w, h, d);
    platform.position.set(minX + w / 2, minY + h / 2, minZ + d / 2);
    root.add(platform);
    bodies.push(
      addStaticBox(world, { x: minX, y: minY, z: minZ }, { w, h, d }),
    );
  };

  box(-8, -1.5, -8, 24, 1.5, 16);
  box(18.5, -1.5, -8, 12, 1.5, 16);

  box(2, 0, -8, 4, 1.5, 4);
  box(6, 0, -8, 4, 3, 4);
  box(10, 0, -8, 4, 5.8, 4);

  box(-1, 0, 1, 1, 5, 6);
  box(24, 0, 2, 1.5, 4, 1.5);

  const ramp = meshes.ramp(RAMP.w, RAMP.h, RAMP.d, "+x");
  ramp.position.set(RAMP.cx, RAMP.cy, RAMP.cz);
  root.add(ramp);
  box(2, 0, 3.5, 4, 2, 3);
  {
    const angle = Math.atan2(RAMP.h, RAMP.w);
    const slopeLength = Math.hypot(RAMP.w, RAMP.h);
    const sinkX = Math.sin(angle) * (RAMP_THICKNESS / 2);
    const sinkY = -Math.cos(angle) * (RAMP_THICKNESS / 2);
    bodies.push(
      addStaticCuboid(
        world,
        { x: RAMP.cx + sinkX, y: RAMP.cy + sinkY, z: RAMP.cz },
        { x: slopeLength / 2, y: RAMP_THICKNESS / 2, z: RAMP.d / 2 },
        { x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2) },
      ),
    );
  }

  const crumble = new Crumble({
    world,
    scene,
    meshes,
    data: { type: "crumble", x: 15.75, y: -0.5, z: -1.5, w: 3, d: 3 },
    reduceMotion,
  });

  const ferry = new MovingPlatform({
    world,
    scene,
    meshes,
    data: {
      type: "platform",
      x: 19,
      y: 1,
      z: 8.5,
      w: 3,
      d: 3,
      path: [
        { x: 19, y: 1, z: 8.5 },
        { x: 19, y: 1, z: 16 },
      ],
      speed: 4,
      mode: "pingpong",
    },
  });

  const blade = new Blade({
    world,
    scene,
    meshes,
    data: { type: "blade", x: 27, y: 0.5, z: -3, r: 1.2 },
  });

  const bouncer = new Bouncer({
    world,
    scene,
    meshes,
    position: { x: 12, y: 0, z: 4 },
  });

  const colliderTags = new Map<number, ColliderTag>();
  colliderTags.set(blade.colliderHandle, { kind: "hazard" });
  colliderTags.set(bouncer.colliderHandle, { kind: "bouncer", bouncer });
  const crumbleByHandle = new Map<number, Crumble>();
  crumbleByHandle.set(crumble.colliderHandle, crumble);
  const platformByHandle = new Map<number, MovingPlatform>();
  platformByHandle.set(ferry.colliderHandle, ferry);

  scene.add(root);

  return {
    root,
    spawn: SPAWN,
    killY: KILL_Y,
    colliderTags,
    crumbleByHandle,
    platformByHandle,

    physicsStep(dtSec, playerPos): void {
      ferry.physicsStep(dtSec);
      blade.physicsStep(dtSec);
      crumble.physicsStep(dtSec, playerPos);
    },

    update(frameDtSec, alpha): void {
      ferry.render(alpha);
      blade.update(frameDtSec, alpha);
      crumble.update(frameDtSec);
      bouncer.update(frameDtSec, reduceMotion());
    },

    resetDynamic(): void {
      ferry.reset();
      blade.reset();
      crumble.reset();
    },

    dispose(): void {
      crumble.destroy();
      ferry.destroy();
      blade.destroy();
      bouncer.destroy();
      colliderTags.clear();
      crumbleByHandle.clear();
      platformByHandle.clear();
      for (const body of bodies) {
        removeBody(world, body);
      }
      bodies.length = 0;
      scene.remove(root);
      root.traverse((obj) => {
        const mesh = obj as Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
        }
      });
    },
  };
}
