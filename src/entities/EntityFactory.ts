import type { RigidBody, World } from "@dimforge/rapier3d-compat";
import type {
  BufferGeometry,
  Material,
  MeshStandardMaterial,
  Scene,
} from "three";
import { BufferAttribute, Group, Mesh } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { palette, worldTheme } from "../config/palette";
import { tuning } from "../config/tuning";
import type { EventBus } from "../core/EventBus";
import {
  addStaticBox,
  addStaticCuboid,
  removeBody,
} from "../game/physics/queries";
import type { MaterialFactory } from "../gfx/MaterialFactory";
import type { MeshFactory } from "../gfx/MeshFactory";
import type { ParticleFactory } from "../gfx/ParticleFactory";
import type { LevelData, TerrainPiece } from "../levels/schema";
import { Bouncer } from "./Bouncer";
import { Blade } from "./hazards/Blade";
import { Crumble } from "./hazards/Crumble";
import { MovingPlatform } from "./hazards/MovingPlatform";
import { Spikes } from "./hazards/Spikes";
import { Portal } from "./Portal";
import { Shard } from "./Shard";

const MAX_TERRAIN_MESHES = 3;

const RAMP_THICKNESS = 0.5;

const SHADE_BOTTOM = 0.75;
const SHADE_TOP = 1;
const SHADE_UP_BONUS = 0.05;
const SHADE_DOWN_FACE = 0.6;
const POOL_CLAMP = 1.2;

interface LightPool {
  x: number;
  y: number;
  z: number;
  r: number;
  cr: number;
  cg: number;
  cb: number;
}

function poolChannels(hex: number): { cr: number; cg: number; cb: number } {
  return {
    cr: ((hex >> 16) & 255) / 255,
    cg: ((hex >> 8) & 255) / 255,
    cb: (hex & 255) / 255,
  };
}

function bakeTerrainShade(
  geometry: BufferGeometry,
  minY: number,
  height: number,
  pools: readonly LightPool[],
  poolStrength: number,
): void {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const colors = new Float32Array(position.count * 3);
  const span = Math.max(height, 0.001);
  for (let i = 0; i < position.count; i += 1) {
    const px = position.getX(i);
    const py = position.getY(i);
    const pz = position.getZ(i);
    const t = Math.min(1, Math.max(0, (py - minY) / span));
    const ny = normal.getY(i);
    let shade = SHADE_BOTTOM + (SHADE_TOP - SHADE_BOTTOM) * t;
    if (ny > 0.5) {
      shade = Math.min(1, shade + SHADE_UP_BONUS);
    } else if (ny < -0.5) {
      shade = SHADE_DOWN_FACE;
    }
    let r = shade;
    let g = shade;
    let b = shade;
    for (const pool of pools) {
      const dx = px - pool.x;
      const dy = py - pool.y;
      const dz = pz - pool.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      const r2 = pool.r * pool.r;
      if (d2 < r2) {
        const fall = (1 - d2 / r2) * poolStrength;
        r += pool.cr * fall;
        g += pool.cg * fall;
        b += pool.cb * fall;
      }
    }
    colors[i * 3] = Math.min(r, POOL_CLAMP);
    colors[i * 3 + 1] = Math.min(g, POOL_CLAMP);
    colors[i * 3 + 2] = Math.min(b, POOL_CLAMP);
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

type RampPiece = Extract<TerrainPiece, { type: "ramp" }>;

export interface ColliderTag {
  kind: "shard" | "portal" | "hazard" | "bouncer";
  shard?: Shard;
  bouncer?: Bouncer;
}

export interface BuiltLevel {
  shards: Shard[];
  portal: Portal;
  spikes: Spikes[];
  blades: Blade[];
  platforms: MovingPlatform[];
  crumbles: Crumble[];
  bouncers: Bouncer[];
  colliderTags: Map<number, ColliderTag>;
  crumbleByHandle: Map<number, Crumble>;
  platformByHandle: Map<number, MovingPlatform>;
  terrainMeshCount: number;
  physicsStep(
    dtSec: number,
    playerPos: { x: number; y: number; z: number },
  ): void;
  update(frameDtSec: number, alpha: number): void;
  resetShards(): void;
  resetDynamic(): void;
  dispose(): void;
}

export interface BuildLevelOptions {
  data: LevelData;
  world: World;
  scene: Scene;
  meshes: MeshFactory;
  materials: MaterialFactory;
  bus: EventBus;
  reduceMotion: () => boolean;
  particles: ParticleFactory;
  noJuice: () => boolean;
}

export function buildLevel(opts: BuildLevelOptions): BuiltLevel {
  const { data, world, scene, meshes, materials, bus } = opts;

  const theme = worldTheme(data.world);
  const themed = materials.terrainThemeMaterials(data.world);
  const baseTerrain = materials.material("terrain");
  const baseTop = materials.material("terrainTop");
  const baseTrim = materials.material("trim");

  const shardGlow = poolChannels(palette.shard);
  const portalGlow = poolChannels(palette.portal);
  const bouncerGlow = poolChannels(palette.bouncer);
  const pools: LightPool[] = data.shards.map((shard) => ({
    x: shard.x,
    y: shard.y,
    z: shard.z,
    r: tuning.lightPoolShardRadius,
    ...shardGlow,
  }));
  pools.push({
    x: data.portal.x,
    y: data.portal.y + 0.6,
    z: data.portal.z,
    r: tuning.lightPoolPortalRadius,
    ...portalGlow,
  });
  for (const hazard of data.hazards) {
    if (hazard.type === "bouncer") {
      pools.push({
        x: hazard.x,
        y: hazard.y,
        z: hazard.z,
        r: tuning.lightPoolBouncerRadius,
        ...bouncerGlow,
      });
    }
  }

  const buckets = new Map<Material, BufferGeometry[]>();
  const terrainBodies: RigidBody[] = [];

  for (const piece of data.terrain) {
    const group =
      piece.type === "box"
        ? meshes.platform(piece.w, piece.h, piece.d)
        : meshes.ramp(piece.w, piece.h, piece.d, piece.dir);
    group.position.set(
      piece.x + piece.w / 2,
      piece.y + piece.h / 2,
      piece.z + piece.d / 2,
    );
    group.updateMatrixWorld(true);
    group.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) {
        return;
      }
      let material = mesh.material;
      if (Array.isArray(material)) {
        throw new Error("EntityFactory: multi-material terrain mesh");
      }
      if (material === baseTerrain) {
        material = themed.body;
      } else if (material === baseTop) {
        material = themed.top;
      } else if (material === baseTrim) {
        material = themed.trim;
      }
      mesh.geometry.applyMatrix4(mesh.matrixWorld);
      bakeTerrainShade(
        mesh.geometry,
        piece.y,
        piece.h,
        pools,
        theme.lightPoolStrength,
      );
      let bucket = buckets.get(material);
      if (!bucket) {
        bucket = [];
        buckets.set(material, bucket);
      }
      bucket.push(mesh.geometry);
    });

    terrainBodies.push(
      piece.type === "box"
        ? addStaticBox(
            world,
            { x: piece.x, y: piece.y, z: piece.z },
            { w: piece.w, h: piece.h, d: piece.d },
          )
        : addRampCollider(world, piece),
    );
  }

  const root = new Group();
  root.name = "terrain";
  const shadedMaterials: Material[] = [];
  for (const [material, parts] of buckets) {
    const merged = mergeGeometries(parts);
    for (const part of parts) {
      part.dispose();
    }
    if (merged === null) {
      throw new Error(
        "EntityFactory: terrain merge failed (attribute mismatch)",
      );
    }
    const shaded = (material as MeshStandardMaterial).clone();
    shaded.vertexColors = true;
    shadedMaterials.push(shaded);
    const mesh = new Mesh(merged, shaded);
    mesh.name = "terrainMerged";
    root.add(mesh);
  }
  const terrainMeshCount = buckets.size;
  if (terrainMeshCount > MAX_TERRAIN_MESHES) {
    throw new Error(
      `EntityFactory: terrain merged into ${String(terrainMeshCount)} meshes` +
        ` (budget ${String(MAX_TERRAIN_MESHES)}, §2.2)`,
    );
  }
  scene.add(root);

  const total = data.shards.length;
  const shards = data.shards.map(
    (position, index) =>
      new Shard({ world, scene, meshes, bus, position, index, total }),
  );

  const portal = new Portal({
    world,
    scene,
    meshes,
    materials,
    bus,
    position: data.portal,
    rotYDeg: data.portal.rotY,
    worldIndex: data.world,
    reduceMotion: opts.reduceMotion,
  });

  const spikes: Spikes[] = [];
  const blades: Blade[] = [];
  const platforms: MovingPlatform[] = [];
  const crumbles: Crumble[] = [];
  const bouncers: Bouncer[] = [];
  for (const hazard of data.hazards) {
    switch (hazard.type) {
      case "spikes":
        spikes.push(new Spikes({ world, scene, meshes, data: hazard }));
        break;
      case "blade":
        blades.push(new Blade({ world, scene, meshes, data: hazard }));
        break;
      case "platform":
        platforms.push(
          new MovingPlatform({
            world,
            scene,
            meshes,
            data: hazard,
            worldIndex: data.world,
          }),
        );
        break;
      case "crumble":
        crumbles.push(
          new Crumble({
            world,
            scene,
            meshes,
            data: hazard,
            reduceMotion: opts.reduceMotion,
            worldIndex: data.world,
          }),
        );
        break;
      case "bouncer":
        bouncers.push(
          new Bouncer({
            world,
            scene,
            meshes,
            position: hazard,
            worldIndex: data.world,
          }),
        );
        break;
    }
  }

  const colliderTags = new Map<number, ColliderTag>();
  for (const shard of shards) {
    colliderTags.set(shard.colliderHandle, { kind: "shard", shard });
  }
  colliderTags.set(portal.colliderHandle, { kind: "portal" });
  for (const strip of spikes) {
    colliderTags.set(strip.colliderHandle, { kind: "hazard" });
  }
  for (const blade of blades) {
    colliderTags.set(blade.colliderHandle, { kind: "hazard" });
  }
  for (const bouncer of bouncers) {
    colliderTags.set(bouncer.colliderHandle, { kind: "bouncer", bouncer });
  }
  const crumbleByHandle = new Map<number, Crumble>();
  for (const crumble of crumbles) {
    crumbleByHandle.set(crumble.colliderHandle, crumble);
  }
  const platformByHandle = new Map<number, MovingPlatform>();
  for (const platform of platforms) {
    platformByHandle.set(platform.colliderHandle, platform);
  }

  const shardMaterial = materials.material("shard");
  const shardBaseEmissive = shardMaterial.emissiveIntensity;
  let pulseClock = 0;

  return {
    shards,
    portal,
    spikes,
    blades,
    platforms,
    crumbles,
    bouncers,
    colliderTags,
    crumbleByHandle,
    platformByHandle,
    terrainMeshCount,

    physicsStep(dtSec, playerPos): void {
      for (const platform of platforms) {
        platform.physicsStep(dtSec);
      }
      for (const blade of blades) {
        blade.physicsStep(dtSec);
      }
      for (const crumble of crumbles) {
        crumble.physicsStep(dtSec, playerPos);
      }
    },

    update(frameDtSec: number, alpha: number): void {
      for (const shard of shards) {
        shard.update(frameDtSec);
      }
      portal.update(frameDtSec);
      if (opts.noJuice()) {
        shardMaterial.emissiveIntensity = shardBaseEmissive;
      } else {
        pulseClock += frameDtSec;
        shardMaterial.emissiveIntensity =
          shardBaseEmissive +
          tuning.shardPulseAmplitude *
            Math.sin((pulseClock / tuning.shardPulsePeriodSec) * Math.PI * 2);
        const c = portal.ringCenter;
        opts.particles.emitPortal(frameDtSec, c.x, c.y, c.z, portal.active);
      }
      for (const platform of platforms) {
        platform.render(alpha);
      }
      for (const blade of blades) {
        blade.update(frameDtSec, alpha);
      }
      for (const crumble of crumbles) {
        crumble.update(frameDtSec);
      }
      const reduce = opts.reduceMotion();
      for (const bouncer of bouncers) {
        bouncer.update(frameDtSec, reduce);
      }
    },

    resetShards(): void {
      for (const shard of shards) {
        shard.reset();
      }
    },

    resetDynamic(): void {
      for (const platform of platforms) {
        platform.reset();
      }
      for (const blade of blades) {
        blade.reset();
      }
      for (const crumble of crumbles) {
        crumble.reset();
      }
    },

    dispose(): void {
      shardMaterial.emissiveIntensity = shardBaseEmissive;
      for (const shard of shards) {
        shard.destroy();
      }
      portal.destroy();
      for (const strip of spikes) {
        strip.destroy();
      }
      for (const blade of blades) {
        blade.destroy();
      }
      for (const platform of platforms) {
        platform.destroy();
      }
      for (const crumble of crumbles) {
        crumble.destroy();
      }
      for (const bouncer of bouncers) {
        bouncer.destroy();
      }
      for (const body of terrainBodies) {
        removeBody(world, body);
      }
      terrainBodies.length = 0;
      scene.remove(root);
      root.traverse((obj) => {
        const mesh = obj as Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
        }
      });
      for (const material of shadedMaterials) {
        material.dispose();
      }
      shadedMaterials.length = 0;
      colliderTags.clear();
      crumbleByHandle.clear();
      platformByHandle.clear();
    },
  };
}

function addRampCollider(world: World, piece: RampPiece): RigidBody {
  const alongX = piece.dir === "+x" || piece.dir === "-x";
  const run = alongX ? piece.w : piece.d;
  const angle = Math.atan2(piece.h, run);
  const slopeLength = Math.hypot(run, piece.h);
  const half = RAMP_THICKNESS / 2;
  const sinkAcross = Math.sin(angle) * half;
  const sinkDown = Math.cos(angle) * half;
  const cx = piece.x + piece.w / 2;
  const cy = piece.y + piece.h / 2 - sinkDown;
  const cz = piece.z + piece.d / 2;
  const sinHalf = Math.sin(angle / 2);
  const cosHalf = Math.cos(angle / 2);

  let center: { x: number; y: number; z: number };
  let rotation: { x: number; y: number; z: number; w: number };
  switch (piece.dir) {
    case "+x":
      center = { x: cx + sinkAcross, y: cy, z: cz };
      rotation = { x: 0, y: 0, z: sinHalf, w: cosHalf };
      break;
    case "-x":
      center = { x: cx - sinkAcross, y: cy, z: cz };
      rotation = { x: 0, y: 0, z: -sinHalf, w: cosHalf };
      break;
    case "+z":
      center = { x: cx, y: cy, z: cz + sinkAcross };
      rotation = { x: -sinHalf, y: 0, z: 0, w: cosHalf };
      break;
    case "-z":
      center = { x: cx, y: cy, z: cz - sinkAcross };
      rotation = { x: sinHalf, y: 0, z: 0, w: cosHalf };
      break;
  }

  return addStaticCuboid(
    world,
    center,
    alongX
      ? { x: slopeLength / 2, y: half, z: piece.d / 2 }
      : { x: piece.w / 2, y: half, z: slopeLength / 2 },
    rotation,
  );
}
