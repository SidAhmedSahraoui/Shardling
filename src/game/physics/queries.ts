import type {
  RigidBody,
  Rotation,
  Vector,
  World,
} from "@dimforge/rapier3d-compat";
import {
  Ball,
  ColliderDesc,
  QueryFilterFlags,
  Ray,
  RigidBodyDesc,
} from "@dimforge/rapier3d-compat";

import { tuning } from "../../config/tuning";
import { castFilterTerrainOnly, terrainColliderGroups } from "./groups";

const IDENTITY_ROTATION: Rotation = { x: 0, y: 0, z: 0, w: 1 };

const CAST_DOWN: Vector = { x: 0, y: -1, z: 0 };

const groundCastShape = new Ball(tuning.groundCastRadius);

const cameraCastShape = new Ball(tuning.camOcclusionRadius);

const cameraCastDir: Vector = { x: 0, y: 0, z: 0 };

const MIN_CAST_DISTANCE = 1e-6;

const shadowRay = new Ray({ x: 0, y: 0, z: 0 }, CAST_DOWN);

export function castGround(world: World, center: Vector): number | null {
  const hit = world.castShape(
    center,
    IDENTITY_ROTATION,
    CAST_DOWN,
    groundCastShape,
    0,
    tuning.groundCastMaxDist - tuning.groundCastRadius,
    true,
    QueryFilterFlags.EXCLUDE_SENSORS,
    castFilterTerrainOnly,
  );
  return hit === null ? null : hit.collider.handle;
}

export function castToCamera(
  world: World,
  from: Vector,
  to: Vector,
): number | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (distance < MIN_CAST_DISTANCE) {
    return null;
  }
  const inv = 1 / distance;
  cameraCastDir.x = dx * inv;
  cameraCastDir.y = dy * inv;
  cameraCastDir.z = dz * inv;

  const hit = world.castShape(
    from,
    IDENTITY_ROTATION,
    cameraCastDir,
    cameraCastShape,
    0,
    distance,
    true,
    QueryFilterFlags.EXCLUDE_SENSORS,
    castFilterTerrainOnly,
  );
  if (hit === null || hit.time_of_impact >= distance) {
    return null;
  }
  return hit.time_of_impact;
}

export function castShadowGround(world: World, from: Vector): number | null {
  shadowRay.origin.x = from.x;
  shadowRay.origin.y = from.y;
  shadowRay.origin.z = from.z;
  const hit = world.castRay(
    shadowRay,
    tuning.blobShadowMaxHeight + tuning.ballRadius,
    true,
    QueryFilterFlags.EXCLUDE_SENSORS,
    castFilterTerrainOnly,
  );
  return hit === null ? null : from.y - hit.timeOfImpact;
}

export function addStaticBox(
  world: World,
  min: Vector,
  size: { w: number; h: number; d: number },
): RigidBody {
  const hx = size.w / 2;
  const hy = size.h / 2;
  const hz = size.d / 2;
  const body = world.createRigidBody(
    RigidBodyDesc.fixed().setTranslation(min.x + hx, min.y + hy, min.z + hz),
  );
  world.createCollider(
    ColliderDesc.cuboid(hx, hy, hz)
      .setFriction(tuning.friction)
      .setRestitution(tuning.restitution)
      .setCollisionGroups(terrainColliderGroups),
    body,
  );
  return body;
}

export function addStaticCuboid(
  world: World,
  center: Vector,
  halfExtents: Vector,
  rotation?: Rotation,
): RigidBody {
  const bodyDesc = RigidBodyDesc.fixed().setTranslation(
    center.x,
    center.y,
    center.z,
  );
  if (rotation !== undefined) {
    bodyDesc.setRotation(rotation);
  }
  const body = world.createRigidBody(bodyDesc);
  world.createCollider(
    ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
      .setFriction(tuning.friction)
      .setRestitution(tuning.restitution)
      .setCollisionGroups(terrainColliderGroups),
    body,
  );
  return body;
}

export function removeBody(world: World, body: RigidBody): void {
  world.removeRigidBody(body);
}
