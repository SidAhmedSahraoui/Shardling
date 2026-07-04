import { World } from "@dimforge/rapier3d-compat";

import { tuning } from "../../config/tuning";

export function createPhysicsWorld(): World {
  const world = new World({ x: 0, y: tuning.gravityY, z: 0 });
  world.timestep = 1 / tuning.physicsHz;
  return world;
}
