import type { BufferGeometry, Material, Object3D } from "three";
import {
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  OctahedronGeometry,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Sprite,
  TorusGeometry,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { tuning } from "../config/tuning";
import type { MaterialFactory, SpriteKind } from "./MaterialFactory";

export type RampDirection = "+x" | "-x" | "+z" | "-z";

const EDGE_RADIUS = 0.12;
const EDGE_SEGMENTS = 2;
const TOP_INSET = 0.06;
const TOP_LIFT = 0.01;
const TRIM_THICKNESS = 0.05;
const TRIM_HEIGHT = 0.06;
const TRIM_LIFT = 0.02;
const TRIM_MIN_SPAN = 0.6;
const POOL_BAKE_PITCH = 0.8;
const POOL_BAKE_MAX_SEGMENTS = 64;
const RAMP_THICKNESS = 0.5;
const SHARD_RADIUS = 0.25;
const SHARD_ELONGATION_Y = 1.4;
const TOOTH_BASE_RADIUS = 0.22;
const TOOTH_HEIGHT = 0.45;
const TOOTH_PITCH = 0.4;
const BLADE_THICKNESS = 0.08;
const BLADE_RADIAL_SEGMENTS = 24;
const BLADE_TOOTH_RADIUS = 0.09;
const BLADE_TOOTH_LENGTH = 0.22;
const BLADE_TOOTH_PITCH = 0.35;
const BLADE_TOOTH_EMBED = 0.02;
const BLADE_MIN_TEETH = 8;
const BOUNCER_RADIUS = 0.6;
const BOUNCER_BASE_HEIGHT = 0.14;
const BOUNCER_PAD_RADIUS = 0.5;
const BOUNCER_PAD_HEIGHT = 0.2;
const BOUNCER_SEGMENTS = 20;
const PORTAL_RING_RADIUS = 1.0;
const PORTAL_RING_TUBE = 0.12;
const PORTAL_RING_TUBE_SEGMENTS = 12;
const PORTAL_RING_RADIAL_SEGMENTS = 32;
const PORTAL_PILLAR_WIDTH = 0.35;
const PORTAL_PILLAR_HEIGHT = 2.2;
const PORTAL_PILLAR_X = PORTAL_RING_RADIUS + 0.4;
const PORTAL_BASE_WIDTH = 3.2;
const PORTAL_BASE_HEIGHT = 0.3;
const PORTAL_BASE_DEPTH = 1.4;
const BALL_WIDTH_SEGMENTS = 24;
const BALL_HEIGHT_SEGMENTS = 18;
const EYE_RADIUS_RATIO = 0.3;
const EYE_FLATTEN_Z = 0.42;
const EYE_UP_RATIO = 0.2;
const EYE_FORWARD_RATIO = 0.9;
const EYE_SIDE_RATIO = 0.31;
const EYE_WIDTH_SEGMENTS = 16;
const EYE_HEIGHT_SEGMENTS = 12;
const PUPIL_RADIUS_RATIO = 0.42;
const PUPIL_FORWARD = 0.62;
const PUPIL_UP = -0.04;
const SKY_WIDTH_SEGMENTS = 32;
const SKY_HEIGHT_SEGMENTS = 16;
const ISLAND_BASE_X = 1.9;
const ISLAND_BASE_Y = 0.6;
const ISLAND_BASE_Z = 1.4;
const ISLAND_ANGLE_JITTER = 0.55;
const ISLAND_TILT_RAD = 0.24;
const ISLAND_MIN_SCALE = 2.2;
const ISLAND_MAX_SCALE = 6;
const ISLAND_FLATTEN_MIN = 0.7;
const ISLAND_FLATTEN_RANGE = 0.5;
const ISLAND_SEED = 0x9e3779b9;
const MID_ISLAND_SEED = 0x2545f491;
const MID_ISLAND_MIN_SCALE = 1.1;
const MID_ISLAND_MAX_SCALE = 2.6;

const PORTAL_MEMBRANE_SEGMENTS = 32;
const PORTAL_MEMBRANE_INSET = 0.55;

const CLOUD_SEED = 0x1b873593;
const CLOUD_LAYER_SCALE_MIN = 0.7;
const CLOUD_LAYER_SCALE_RANGE = 0.55;
const CLOUD_LAYER_OFFSET = 0.18;

const RUIN_SEED = 0x27d4eb2f;
const RUIN_PILLAR_SEGMENTS = 7;
const RUIN_PILLAR_TAPER = 0.78;
const RUIN_PILLAR_SPREAD = 0.72;
const RUIN_PILLAR_TILT_RAD = 0.16;
const RUIN_PILLAR_SINK = 0.35;
const RUIN_CRYSTAL_SPREAD = 0.95;
const RUIN_CRYSTAL_TILT_RAD = 0.75;
const RUIN_CRYSTAL_SLIMNESS = 0.3;
const RUIN_CRYSTAL_SINK = 0.2;

const CRYSTAL_CLUSTER_SEED = 0x85ebca6b;
const CRYSTAL_CLUSTER_SPIKES = 5;
const CRYSTAL_CLUSTER_MIN_HEIGHT = 0.75;
const CRYSTAL_CLUSTER_HEIGHT_RANGE = 1.35;
const CRYSTAL_CLUSTER_TILT_RAD = 0.7;
const CRYSTAL_CLUSTER_SPREAD = 0.42;

interface IslandPlacement {
  x: number;
  y: number;
  z: number;
  scale: number;
  topY: number;
}

function roundedBox(w: number, h: number, d: number): RoundedBoxGeometry {
  const radius = Math.min(EDGE_RADIUS, w / 2, h / 2, d / 2);
  return new RoundedBoxGeometry(w, h, d, EDGE_SEGMENTS, radius);
}

function createLcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function mergeAndDispose(parts: BufferGeometry[]): BufferGeometry {
  const merged: BufferGeometry | null = mergeGeometries(parts);
  for (const part of parts) {
    part.dispose();
  }
  if (merged === null) {
    throw new Error("MeshFactory: mergeGeometries failed (attribute mismatch)");
  }
  return merged;
}

export class MeshFactory {
  constructor(private readonly materials: MaterialFactory) {}

  platform(w: number, h: number, d: number): Group {
    const group = new Group();
    group.name = "platform";

    const body = new Mesh(
      roundedBox(w, h, d),
      this.materials.material("terrain"),
    );
    body.name = "body";
    group.add(body);

    const topW = Math.max(w - TOP_INSET * 2, w * 0.5);
    const topD = Math.max(d - TOP_INSET * 2, d * 0.5);
    const topGeometry = new PlaneGeometry(
      topW,
      topD,
      Math.min(
        POOL_BAKE_MAX_SEGMENTS,
        Math.max(1, Math.ceil(topW / POOL_BAKE_PITCH)),
      ),
      Math.min(
        POOL_BAKE_MAX_SEGMENTS,
        Math.max(1, Math.ceil(topD / POOL_BAKE_PITCH)),
      ),
    );
    const uv = topGeometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i += 1) {
      uv.setXY(i, uv.getX(i) * topW, uv.getY(i) * topD);
    }
    topGeometry.rotateX(-Math.PI / 2);
    const top = new Mesh(topGeometry, this.materials.material("terrainTop"));
    top.name = "top";
    top.position.y = h / 2 + TOP_LIFT;
    group.add(top);

    const railW = topW - TRIM_THICKNESS * 2;
    const railD = topD - TRIM_THICKNESS * 2;
    if (railW >= TRIM_MIN_SPAN && railD >= TRIM_MIN_SPAN) {
      const trim = this.materials.material("trim");
      const railY = h / 2 + TRIM_LIFT;
      const alongX = new BoxGeometry(railW, TRIM_HEIGHT, TRIM_THICKNESS);
      const alongZ = new BoxGeometry(TRIM_THICKNESS, TRIM_HEIGHT, railD);
      for (const side of [-1, 1]) {
        const railX = new Mesh(alongX.clone(), trim);
        railX.name = "trim";
        railX.position.set(0, railY, side * (topD / 2 - TRIM_THICKNESS / 2));
        group.add(railX);
        const railZ = new Mesh(alongZ.clone(), trim);
        railZ.name = "trim";
        railZ.position.set(side * (topW / 2 - TRIM_THICKNESS / 2), railY, 0);
        group.add(railZ);
      }
      alongX.dispose();
      alongZ.dispose();
    }

    return group;
  }

  ramp(w: number, h: number, d: number, dir: RampDirection): Group {
    const group = new Group();
    group.name = "ramp";

    const alongX = dir === "+x" || dir === "-x";
    const run = alongX ? w : d;
    const slopeLength = Math.hypot(run, h);
    const geometry = alongX
      ? roundedBox(slopeLength, RAMP_THICKNESS, d)
      : roundedBox(w, RAMP_THICKNESS, slopeLength);
    const slab = new Mesh(geometry, this.materials.material("terrain"));
    slab.name = "slab";

    const angle = Math.atan2(h, run);
    switch (dir) {
      case "+x":
        slab.rotation.z = angle;
        break;
      case "-x":
        slab.rotation.z = -angle;
        break;
      case "+z":
        slab.rotation.x = -angle;
        break;
      case "-z":
        slab.rotation.x = angle;
        break;
    }
    slab.translateY(-RAMP_THICKNESS / 2);
    group.add(slab);

    return group;
  }

  shard(): Mesh {
    const geometry = new OctahedronGeometry(SHARD_RADIUS);
    geometry.scale(1, SHARD_ELONGATION_Y, 1);
    const mesh = new Mesh(geometry, this.materials.material("shard"));
    mesh.name = "shard";
    return mesh;
  }

  spikeTooth(): Mesh {
    const mesh = new Mesh(
      this.toothGeometry(),
      this.materials.material("hazard"),
    );
    mesh.name = "spikeTooth";
    return mesh;
  }

  spikeStrip(w: number, d: number): Mesh {
    const template = this.toothGeometry();
    const cols = Math.max(1, Math.round(w / TOOTH_PITCH));
    const rows = Math.max(1, Math.round(d / TOOTH_PITCH));
    const stepX = w / cols;
    const stepZ = d / rows;

    const parts: BufferGeometry[] = [];
    for (let ix = 0; ix < cols; ix += 1) {
      for (let iz = 0; iz < rows; iz += 1) {
        const tooth = template.clone();
        tooth.translate(
          -w / 2 + (ix + 0.5) * stepX,
          0,
          -d / 2 + (iz + 0.5) * stepZ,
        );
        parts.push(tooth);
      }
    }
    template.dispose();

    const mesh = new Mesh(
      mergeAndDispose(parts),
      this.materials.material("hazard"),
    );
    mesh.name = "spikeStrip";
    return mesh;
  }

  blade(r: number): Group {
    const group = new Group();
    group.name = "blade";

    const parts: BufferGeometry[] = [
      new CylinderGeometry(r, r, BLADE_THICKNESS, BLADE_RADIAL_SEGMENTS),
    ];
    const toothCount = Math.max(
      BLADE_MIN_TEETH,
      Math.round((2 * Math.PI * r) / BLADE_TOOTH_PITCH),
    );
    const template = new ConeGeometry(
      BLADE_TOOTH_RADIUS,
      BLADE_TOOTH_LENGTH,
      4,
    );
    template.rotateZ(-Math.PI / 2);
    template.scale(1, BLADE_THICKNESS / (BLADE_TOOTH_RADIUS * 2), 1);
    for (let i = 0; i < toothCount; i += 1) {
      const tooth = template.clone();
      tooth.translate(r + BLADE_TOOTH_LENGTH / 2 - BLADE_TOOTH_EMBED, 0, 0);
      tooth.rotateY((i / toothCount) * Math.PI * 2);
      parts.push(tooth);
    }
    template.dispose();

    const disc = new Mesh(
      mergeAndDispose(parts),
      this.materials.material("hazard"),
    );
    disc.name = "disc";
    group.add(disc);

    return group;
  }

  bouncer(): Group {
    const group = new Group();
    group.name = "bouncer";

    const base = new Mesh(
      new CylinderGeometry(
        BOUNCER_RADIUS,
        BOUNCER_RADIUS,
        BOUNCER_BASE_HEIGHT,
        BOUNCER_SEGMENTS,
      ),
      this.materials.material("terrain"),
    );
    base.name = "base";
    base.position.y = BOUNCER_BASE_HEIGHT / 2;
    group.add(base);

    const padGeometry = new CylinderGeometry(
      BOUNCER_PAD_RADIUS * 0.92,
      BOUNCER_PAD_RADIUS,
      BOUNCER_PAD_HEIGHT,
      BOUNCER_SEGMENTS,
    );
    padGeometry.translate(0, BOUNCER_PAD_HEIGHT / 2, 0);
    const pad = new Mesh(padGeometry, this.materials.material("bouncer"));
    pad.name = "pad";
    pad.position.y = BOUNCER_BASE_HEIGHT;
    group.add(pad);

    return group;
  }

  portal(): Group {
    const group = new Group();
    group.name = "portal";
    const stone = this.materials.material("portalStone");

    const base = new Mesh(
      roundedBox(PORTAL_BASE_WIDTH, PORTAL_BASE_HEIGHT, PORTAL_BASE_DEPTH),
      stone,
    );
    base.name = "base";
    base.position.y = PORTAL_BASE_HEIGHT / 2;
    group.add(base);

    const pillarY = PORTAL_BASE_HEIGHT + PORTAL_PILLAR_HEIGHT / 2;
    for (const side of [-1, 1]) {
      const pillar = new Mesh(
        roundedBox(
          PORTAL_PILLAR_WIDTH,
          PORTAL_PILLAR_HEIGHT,
          PORTAL_PILLAR_WIDTH,
        ),
        stone,
      );
      pillar.name = side < 0 ? "pillarL" : "pillarR";
      pillar.position.set(side * PORTAL_PILLAR_X, pillarY, 0);
      group.add(pillar);
    }

    const ring = new Mesh(
      new TorusGeometry(
        PORTAL_RING_RADIUS,
        PORTAL_RING_TUBE,
        PORTAL_RING_TUBE_SEGMENTS,
        PORTAL_RING_RADIAL_SEGMENTS,
      ),
      this.materials.material("portalDormant"),
    );
    ring.name = "ring";
    ring.position.y =
      PORTAL_BASE_HEIGHT + PORTAL_RING_RADIUS + PORTAL_RING_TUBE;
    group.add(ring);

    const membrane = new Mesh(
      new CircleGeometry(
        PORTAL_RING_RADIUS - PORTAL_RING_TUBE * PORTAL_MEMBRANE_INSET,
        PORTAL_MEMBRANE_SEGMENTS,
      ),
      this.materials.portalMembraneMaterial(false),
    );
    membrane.name = "membrane";
    membrane.position.y = ring.position.y;
    group.add(membrane);

    this.materials.material("portalActive");

    return group;
  }

  playerBall(): Group {
    const r = tuning.ballRadius;
    const group = new Group();
    group.name = "player";

    const body = new Mesh(
      new SphereGeometry(r, BALL_WIDTH_SEGMENTS, BALL_HEIGHT_SEGMENTS),
      this.materials.material("player"),
    );
    body.name = "body";
    group.add(body);

    const rim = new Mesh(
      new SphereGeometry(
        r * tuning.playerRimScale,
        BALL_WIDTH_SEGMENTS,
        BALL_HEIGHT_SEGMENTS,
      ),
      this.materials.playerRimMaterial(),
    );
    rim.name = "rim";
    group.add(rim);

    const eyeWrapper = new Group();
    eyeWrapper.name = "eyeWrapper";
    group.add(eyeWrapper);

    const eyeRadius = r * EYE_RADIUS_RATIO;
    const pupilRadius = eyeRadius * PUPIL_RADIUS_RATIO;
    const eyeWhite = this.materials.material("eyeWhite");
    const pupilMaterial = this.materials.material("pupil");
    for (const side of [-1, 1]) {
      const socket = new Group();
      socket.name = "eye";
      socket.position.set(
        side * r * EYE_SIDE_RATIO,
        r * EYE_UP_RATIO,
        r * EYE_FORWARD_RATIO,
      );
      eyeWrapper.add(socket);

      const whiteGeometry = new SphereGeometry(
        eyeRadius,
        EYE_WIDTH_SEGMENTS,
        EYE_HEIGHT_SEGMENTS,
      );
      whiteGeometry.scale(1, 1, EYE_FLATTEN_Z);
      const white = new Mesh(whiteGeometry, eyeWhite);
      white.name = "eyeWhite";
      socket.add(white);

      const pupil = new Mesh(
        new SphereGeometry(
          pupilRadius,
          EYE_WIDTH_SEGMENTS,
          EYE_HEIGHT_SEGMENTS,
        ),
        pupilMaterial,
      );
      pupil.name = "pupil";
      pupil.position.set(0, eyeRadius * PUPIL_UP, eyeRadius * PUPIL_FORWARD);
      socket.add(pupil);
    }

    return group;
  }

  skyDome(radius: number, world = 1): Mesh {
    const mesh = new Mesh(
      new SphereGeometry(radius, SKY_WIDTH_SEGMENTS, SKY_HEIGHT_SEGMENTS),
      this.materials.skyMaterial(world),
    );
    mesh.name = "sky";
    return mesh;
  }

  distantIslands(world = 1): InstancedMesh {
    return this.islandRing({
      material: this.materials.distantIslandMaterial(world),
      count: tuning.distantIslandCount,
      minRadius: tuning.distantIslandMinRadius,
      maxRadius: tuning.distantIslandMaxRadius,
      minY: tuning.distantIslandMinY,
      maxY: tuning.distantIslandMaxY,
      minScale: ISLAND_MIN_SCALE,
      maxScale: ISLAND_MAX_SCALE,
      seed: ISLAND_SEED,
      name: "distantIslands",
    });
  }

  midIslands(world = 1): Group {
    const group = new Group();
    group.name = "midIslands";

    const placements: IslandPlacement[] = [];
    group.add(
      this.islandRing({
        material: this.materials.terrainThemeMaterials(world).body,
        count: tuning.midIslandCount,
        minRadius: tuning.midIslandMinRadius,
        maxRadius: tuning.midIslandMaxRadius,
        minY: tuning.midIslandMinY,
        maxY: tuning.midIslandMaxY,
        minScale: MID_ISLAND_MIN_SCALE,
        maxScale: MID_ISLAND_MAX_SCALE,
        seed: MID_ISLAND_SEED,
        name: "midIslandRocks",
        out: placements,
      }),
    );
    group.add(this.ruinPillars(placements, world));
    group.add(this.ruinCrystals(placements, world));

    return group;
  }

  cloudSea(world = 1): InstancedMesh {
    const geometry = new PlaneGeometry(1, 1);
    geometry.rotateX(-Math.PI / 2);
    const count = tuning.cloudSeaLayerCount;
    const mesh = new InstancedMesh(
      geometry,
      this.materials.cloudSeaMaterial(world),
      count,
    );
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const euler = new Euler();
    const position = new Vector3();
    const scale = new Vector3();
    const rand = createLcg(CLOUD_SEED);

    for (let i = 0; i < count; i += 1) {
      const span =
        tuning.cloudSeaRadius *
        2 *
        (CLOUD_LAYER_SCALE_MIN + rand() * CLOUD_LAYER_SCALE_RANGE);
      position.set(
        (rand() - 0.5) * span * CLOUD_LAYER_OFFSET,
        tuning.cloudSeaY - i * tuning.cloudSeaLayerGap,
        (rand() - 0.5) * span * CLOUD_LAYER_OFFSET,
      );
      euler.set(0, rand() * Math.PI * 2, 0);
      quaternion.setFromEuler(euler);
      scale.set(span, 1, span);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.name = "cloudSea";
    mesh.renderOrder = -1;
    return mesh;
  }

  crystalCluster(world = 1, scale = 1): Mesh {
    const parts: BufferGeometry[] = [];
    const rand = createLcg(CRYSTAL_CLUSTER_SEED);
    for (let i = 0; i < CRYSTAL_CLUSTER_SPIKES; i += 1) {
      const spike = new OctahedronGeometry(1, 0);
      const height =
        CRYSTAL_CLUSTER_MIN_HEIGHT + rand() * CRYSTAL_CLUSTER_HEIGHT_RANGE;
      spike.scale(RUIN_CRYSTAL_SLIMNESS, height, RUIN_CRYSTAL_SLIMNESS);
      spike.translate(0, height, 0);
      spike.rotateZ((rand() - 0.5) * CRYSTAL_CLUSTER_TILT_RAD);
      spike.rotateY(rand() * Math.PI * 2);
      const angle = rand() * Math.PI * 2;
      const reach = rand() * CRYSTAL_CLUSTER_SPREAD;
      spike.translate(Math.cos(angle) * reach, 0, Math.sin(angle) * reach);
      parts.push(spike);
    }
    const mesh = new Mesh(
      mergeAndDispose(parts),
      this.materials.crystalMaterial(world),
    );
    mesh.scale.setScalar(scale);
    mesh.name = "crystalCluster";
    return mesh;
  }

  private ruinPillars(
    placements: readonly IslandPlacement[],
    world: number,
  ): InstancedMesh {
    const geometry = new CylinderGeometry(
      tuning.ruinPillarRadius * RUIN_PILLAR_TAPER,
      tuning.ruinPillarRadius,
      1,
      RUIN_PILLAR_SEGMENTS,
    );
    geometry.translate(0, 0.5, 0);

    const count = placements.length * tuning.ruinPillarPerIsland;
    const mesh = new InstancedMesh(
      geometry,
      this.materials.terrainThemeMaterials(world).body,
      count,
    );
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const euler = new Euler();
    const position = new Vector3();
    const scale = new Vector3();
    const rand = createLcg(RUIN_SEED);

    let index = 0;
    for (const island of placements) {
      for (let i = 0; i < tuning.ruinPillarPerIsland; i += 1) {
        const angle = rand() * Math.PI * 2;
        const reach = Math.sqrt(rand()) * RUIN_PILLAR_SPREAD * island.scale;
        const height =
          tuning.ruinPillarMinHeight +
          rand() * (tuning.ruinPillarMaxHeight - tuning.ruinPillarMinHeight);
        position.set(
          island.x + Math.cos(angle) * reach * ISLAND_BASE_X,
          island.topY - RUIN_PILLAR_SINK * island.scale,
          island.z + Math.sin(angle) * reach * ISLAND_BASE_Z,
        );
        euler.set(
          (rand() - 0.5) * RUIN_PILLAR_TILT_RAD,
          rand() * Math.PI * 2,
          (rand() - 0.5) * RUIN_PILLAR_TILT_RAD,
        );
        quaternion.setFromEuler(euler);
        const girth = 0.7 + rand() * 0.8;
        scale.set(girth, height, girth);
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(index, matrix);
        index += 1;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.name = "ruinPillars";
    return mesh;
  }

  private ruinCrystals(
    placements: readonly IslandPlacement[],
    world: number,
  ): InstancedMesh {
    const geometry = new OctahedronGeometry(1, 0);
    geometry.scale(RUIN_CRYSTAL_SLIMNESS, 1, RUIN_CRYSTAL_SLIMNESS);
    geometry.translate(0, 1, 0);

    const count = placements.length * tuning.ruinCrystalPerIsland;
    const mesh = new InstancedMesh(
      geometry,
      this.materials.crystalMaterial(world),
      count,
    );
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const euler = new Euler();
    const position = new Vector3();
    const scale = new Vector3();
    const rand = createLcg(RUIN_SEED ^ world);

    let index = 0;
    for (const island of placements) {
      for (let i = 0; i < tuning.ruinCrystalPerIsland; i += 1) {
        const angle = rand() * Math.PI * 2;
        const reach = Math.sqrt(rand()) * RUIN_CRYSTAL_SPREAD * island.scale;
        const size =
          tuning.ruinCrystalMinScale +
          rand() * (tuning.ruinCrystalMaxScale - tuning.ruinCrystalMinScale);
        position.set(
          island.x + Math.cos(angle) * reach * ISLAND_BASE_X,
          island.topY - RUIN_CRYSTAL_SINK * size,
          island.z + Math.sin(angle) * reach * ISLAND_BASE_Z,
        );
        euler.set(
          (rand() - 0.5) * RUIN_CRYSTAL_TILT_RAD,
          rand() * Math.PI * 2,
          (rand() - 0.5) * RUIN_CRYSTAL_TILT_RAD,
        );
        quaternion.setFromEuler(euler);
        scale.set(size, size * (1 + rand()), size);
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(index, matrix);
        index += 1;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.name = "ruinCrystals";
    return mesh;
  }

  private islandRing(opts: {
    material: Material;
    count: number;
    minRadius: number;
    maxRadius: number;
    minY: number;
    maxY: number;
    minScale: number;
    maxScale: number;
    seed: number;
    name: string;
    out?: IslandPlacement[];
  }): InstancedMesh {
    const geometry = new DodecahedronGeometry(1, 0);
    geometry.scale(ISLAND_BASE_X, ISLAND_BASE_Y, ISLAND_BASE_Z);
    const mesh = new InstancedMesh(geometry, opts.material, opts.count);
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const euler = new Euler();
    const position = new Vector3();
    const scale = new Vector3();
    const rand = createLcg(opts.seed);
    for (let i = 0; i < opts.count; i += 1) {
      const angle =
        ((i + rand() * ISLAND_ANGLE_JITTER) / opts.count) * Math.PI * 2;
      const radius =
        opts.minRadius + rand() * (opts.maxRadius - opts.minRadius);
      position.set(
        Math.cos(angle) * radius,
        opts.minY + rand() * (opts.maxY - opts.minY),
        Math.sin(angle) * radius,
      );
      euler.set(
        (rand() - 0.5) * ISLAND_TILT_RAD,
        rand() * Math.PI * 2,
        (rand() - 0.5) * ISLAND_TILT_RAD,
      );
      quaternion.setFromEuler(euler);
      const s = opts.minScale + rand() * (opts.maxScale - opts.minScale);
      const flatten = ISLAND_FLATTEN_MIN + rand() * ISLAND_FLATTEN_RANGE;
      scale.set(s, s * flatten, s);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
      opts.out?.push({
        x: position.x,
        y: position.y,
        z: position.z,
        scale: s,
        topY: position.y + ISLAND_BASE_Y * s * flatten,
      });
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.name = opts.name;
    return mesh;
  }

  applyWorldTheme(root: Object3D, world: number | undefined): void {
    if (world === undefined) {
      return;
    }
    const themed = this.materials.terrainThemeMaterials(world);
    const baseTerrain = this.materials.material("terrain");
    const baseTop = this.materials.material("terrainTop");
    const baseTrim = this.materials.material("trim");
    const baseStone = this.materials.material("portalStone");
    root.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) {
        return;
      }
      if (mesh.material === baseTerrain || mesh.material === baseStone) {
        mesh.material = themed.body;
      } else if (mesh.material === baseTop) {
        mesh.material = themed.top;
      } else if (mesh.material === baseTrim) {
        mesh.material = themed.trim;
      }
    });
  }

  particleSprite(kind: SpriteKind, size: number): Sprite {
    const sprite = new Sprite(this.materials.spriteMaterial(kind));
    sprite.name = kind;
    sprite.scale.set(size, size, 1);
    return sprite;
  }

  private toothGeometry(): ConeGeometry {
    const geometry = new ConeGeometry(TOOTH_BASE_RADIUS, TOOTH_HEIGHT, 4);
    geometry.rotateY(Math.PI / 4);
    geometry.translate(0, TOOTH_HEIGHT / 2, 0);
    return geometry;
  }
}

export function setPortalActive(
  portal: Group,
  active: boolean,
  materials: MaterialFactory,
): void {
  const ring = portal.getObjectByName("ring");
  if (ring instanceof Mesh) {
    ring.material = materials.material(
      active ? "portalActive" : "portalDormant",
    );
  }
  const membrane = portal.getObjectByName("membrane");
  if (membrane instanceof Mesh) {
    membrane.material = materials.portalMembraneMaterial(active);
  }
}
