import { tuning } from "../config/tuning";
import type { HazardData, LevelData, TerrainPiece } from "./schema";

const SPAWN_SUPPORT_MAX_DROP = 3;

const PORTAL_TOP_TOLERANCE = 0.5;

const PORTAL_HALF_WIDTH = 1.6;
const PORTAL_HALF_DEPTH = 0.7;

const HAZARD_SPAWN_CLEARANCE = 2;

const SPIKES_AABB_HEIGHT = 0.45;

const BLADE_RADIUS_MARGIN = 0.25;
const BLADE_HALF_HEIGHT = 0.2;

const SLAB_THICKNESS = 0.5;

const BOUNCER_RADIUS = 0.6;
const BOUNCER_HEIGHT = 0.94;

interface Aabb {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

function aabbFromMinCorner(
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
): Aabb {
  return { minX: x, minY: y, minZ: z, maxX: x + w, maxY: y + h, maxZ: z + d };
}

function terrainAabb(piece: TerrainPiece): Aabb {
  return aabbFromMinCorner(
    piece.x,
    piece.y,
    piece.z,
    piece.w,
    piece.h,
    piece.d,
  );
}

function sweptAabb(
  points: readonly { x: number; y: number; z: number }[],
  size: { w: number; h: number; d: number },
): Aabb {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    minZ = Math.min(minZ, p.z);
    maxX = Math.max(maxX, p.x + size.w);
    maxY = Math.max(maxY, p.y + size.h);
    maxZ = Math.max(maxZ, p.z + size.d);
  }
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

function hazardAabb(hazard: HazardData): Aabb {
  switch (hazard.type) {
    case "blade": {
      const rx = hazard.r + BLADE_RADIUS_MARGIN;
      const centers = [hazard, ...(hazard.path ?? [])];
      const swept = sweptAabb(
        centers.map((c) => ({
          x: c.x - rx,
          y: c.y - BLADE_HALF_HEIGHT,
          z: c.z - rx,
        })),
        { w: rx * 2, h: BLADE_HALF_HEIGHT * 2, d: rx * 2 },
      );
      return swept;
    }
    case "platform":
      return sweptAabb(hazard.path, {
        w: hazard.w,
        h: SLAB_THICKNESS,
        d: hazard.d,
      });
    case "crumble":
      return aabbFromMinCorner(
        hazard.x,
        hazard.y,
        hazard.z,
        hazard.w,
        SLAB_THICKNESS,
        hazard.d,
      );
    case "bouncer":
      return aabbFromMinCorner(
        hazard.x - BOUNCER_RADIUS,
        hazard.y,
        hazard.z - BOUNCER_RADIUS,
        BOUNCER_RADIUS * 2,
        BOUNCER_HEIGHT,
        BOUNCER_RADIUS * 2,
      );
    case "spikes":
      switch (hazard.face) {
        case "up":
          return aabbFromMinCorner(
            hazard.x,
            hazard.y,
            hazard.z,
            hazard.w,
            SPIKES_AABB_HEIGHT,
            hazard.d,
          );
        case "down":
          return aabbFromMinCorner(
            hazard.x,
            hazard.y - SPIKES_AABB_HEIGHT,
            hazard.z,
            hazard.w,
            SPIKES_AABB_HEIGHT,
            hazard.d,
          );
        case "+x":
          return aabbFromMinCorner(
            hazard.x,
            hazard.y,
            hazard.z,
            SPIKES_AABB_HEIGHT,
            hazard.w,
            hazard.d,
          );
        case "-x":
          return aabbFromMinCorner(
            hazard.x - SPIKES_AABB_HEIGHT,
            hazard.y,
            hazard.z,
            SPIKES_AABB_HEIGHT,
            hazard.w,
            hazard.d,
          );
        case "+z":
          return aabbFromMinCorner(
            hazard.x,
            hazard.y,
            hazard.z,
            hazard.w,
            hazard.d,
            SPIKES_AABB_HEIGHT,
          );
        case "-z":
          return aabbFromMinCorner(
            hazard.x,
            hazard.y,
            hazard.z - SPIKES_AABB_HEIGHT,
            hazard.w,
            hazard.d,
            SPIKES_AABB_HEIGHT,
          );
      }
  }
}

function aabbInside(inner: Aabb, outer: Aabb): boolean {
  return (
    inner.minX >= outer.minX &&
    inner.maxX <= outer.maxX &&
    inner.minY >= outer.minY &&
    inner.maxY <= outer.maxY &&
    inner.minZ >= outer.minZ &&
    inner.maxZ <= outer.maxZ
  );
}

function pointInside(
  p: { x: number; y: number; z: number },
  box: Aabb,
): boolean {
  return (
    p.x >= box.minX &&
    p.x <= box.maxX &&
    p.y >= box.minY &&
    p.y <= box.maxY &&
    p.z >= box.minZ &&
    p.z <= box.maxZ
  );
}

function expand(box: Aabb, margin: number): Aabb {
  return {
    minX: box.minX - margin,
    minY: box.minY - margin,
    minZ: box.minZ - margin,
    maxX: box.maxX + margin,
    maxY: box.maxY + margin,
    maxZ: box.maxZ + margin,
  };
}

function surfaceHeightAt(piece: TerrainPiece, qx: number, qz: number): number {
  if (piece.type === "box") {
    return piece.y + piece.h;
  }
  const alongX = piece.dir === "+x" || piece.dir === "-x";
  const run = alongX ? piece.w : piece.d;
  const offset = alongX ? qx - piece.x : qz - piece.z;
  const t = Math.min(1, Math.max(0, offset / run));
  const ascending = piece.dir === "+x" || piece.dir === "+z";
  return piece.y + piece.h * (ascending ? t : 1 - t);
}

function footprintContains(piece: TerrainPiece, x: number, z: number): boolean {
  return (
    x >= piece.x &&
    x <= piece.x + piece.w &&
    z >= piece.z &&
    z <= piece.z + piece.d
  );
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

function pointLabel(p: { x: number; y: number; z: number }): string {
  return `(${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)})`;
}

export function sanityCheckLevel(level: LevelData): string[] {
  const violations: string[] = [];
  const bounds = aabbFromMinCorner(
    level.bounds.x,
    level.bounds.y,
    level.bounds.z,
    level.bounds.w,
    level.bounds.h,
    level.bounds.d,
  );

  level.terrain.forEach((piece, i) => {
    if (!aabbInside(terrainAabb(piece), bounds)) {
      violations.push(
        `terrain[${i}] (${piece.type} at ${pointLabel(piece)}, size ${fmt(piece.w)}×${fmt(piece.h)}×${fmt(piece.d)}) extends outside bounds`,
      );
    }
  });
  level.shards.forEach((shard, i) => {
    if (!pointInside(shard, bounds)) {
      violations.push(`shards[${i}] at ${pointLabel(shard)} is outside bounds`);
    }
  });
  if (!pointInside(level.spawn, bounds)) {
    violations.push(`spawn at ${pointLabel(level.spawn)} is outside bounds`);
  }
  if (!pointInside(level.portal, bounds)) {
    violations.push(`portal at ${pointLabel(level.portal)} is outside bounds`);
  }
  level.hazards.forEach((hazard, i) => {
    if (!aabbInside(hazardAabb(hazard), bounds)) {
      violations.push(
        `hazards[${i}] (${hazard.type} at ${pointLabel(hazard)}) extends outside bounds`,
      );
    }
  });

  const spawnSupported = level.terrain.some((piece) => {
    if (!footprintContains(piece, level.spawn.x, level.spawn.z)) {
      return false;
    }
    const top = surfaceHeightAt(piece, level.spawn.x, level.spawn.z);
    return (
      top >= level.spawn.y - SPAWN_SUPPORT_MAX_DROP && top <= level.spawn.y
    );
  });
  if (!spawnSupported) {
    violations.push(
      `spawn at ${pointLabel(level.spawn)} has no terrain top within ${fmt(SPAWN_SUPPORT_MAX_DROP)} u beneath it`,
    );
  }

  const seatedAt = (qx: number, qz: number): boolean =>
    level.terrain.some((piece) => {
      if (!footprintContains(piece, qx, qz)) {
        return false;
      }
      const top = surfaceHeightAt(piece, qx, qz);
      return Math.abs(level.portal.y - top) <= PORTAL_TOP_TOLERANCE;
    });
  const yaw = (level.portal.rotY * Math.PI) / 180;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const portalSeated = [
    [0, 0],
    [PORTAL_HALF_WIDTH, PORTAL_HALF_DEPTH],
    [PORTAL_HALF_WIDTH, -PORTAL_HALF_DEPTH],
    [-PORTAL_HALF_WIDTH, PORTAL_HALF_DEPTH],
    [-PORTAL_HALF_WIDTH, -PORTAL_HALF_DEPTH],
  ].every(([lx = 0, lz = 0]) =>
    seatedAt(
      level.portal.x + lx * cos + lz * sin,
      level.portal.z - lx * sin + lz * cos,
    ),
  );
  if (!portalSeated) {
    violations.push(
      `portal at ${pointLabel(level.portal)} (rotY ${fmt(level.portal.rotY)}) is not fully seated: center + footprint corners must each be within ${fmt(PORTAL_TOP_TOLERANCE)} u of a terrain top`,
    );
  }

  if (level.shards.length < 1) {
    violations.push("level has no shards (at least 1 required)");
  }

  level.hazards.forEach((hazard, i) => {
    const lethal = hazard.type === "spikes" || hazard.type === "blade";
    if (
      lethal &&
      pointInside(
        level.spawn,
        expand(hazardAabb(hazard), HAZARD_SPAWN_CLEARANCE),
      )
    ) {
      violations.push(
        `hazards[${i}] (${hazard.type} at ${pointLabel(hazard)}) is within ${fmt(HAZARD_SPAWN_CLEARANCE)} u of spawn`,
      );
    }
  });

  level.hazards.forEach((hazard, i) => {
    if (hazard.type === "blade" && hazard.path && hazard.speed === undefined) {
      violations.push(
        `hazards[${i}] (blade at ${pointLabel(hazard)}) has a path but no speed`,
      );
    }
    if (hazard.type === "platform") {
      const first = hazard.path[0];
      if (
        first &&
        (first.x !== hazard.x || first.y !== hazard.y || first.z !== hazard.z)
      ) {
        violations.push(
          `hazards[${i}] (platform at ${pointLabel(hazard)}) must start at path[0] ${pointLabel(first)}`,
        );
      }
      if (hazard.speed >= tuning.maxSpeedXZ) {
        violations.push(
          `hazards[${i}] (platform at ${pointLabel(hazard)}) speed ${fmt(hazard.speed)} must stay below maxSpeedXZ (${fmt(tuning.maxSpeedXZ)}) or riders cannot be carried`,
        );
      }
    }
  });

  const lowestTerrainY = Math.min(...level.terrain.map((piece) => piece.y));
  if (!(level.killY < lowestTerrainY)) {
    violations.push(
      `killY (${fmt(level.killY)}) must be strictly below the lowest terrain min-y (${fmt(lowestTerrainY)})`,
    );
  }

  return violations;
}
