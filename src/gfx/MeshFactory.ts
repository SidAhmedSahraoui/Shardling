import type { BufferGeometry } from "three";
import {
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
const EYE_RADIUS_RATIO = 0.33;
const EYE_FLATTEN_Z = 0.45;
const EYE_UP_RATIO = 0.18;
const EYE_FORWARD_RATIO = 0.93;
const EYE_WIDTH_SEGMENTS = 16;
const EYE_HEIGHT_SEGMENTS = 12;
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

function roundedBox(w: number, h: number, d: number): RoundedBoxGeometry {
  const radius = Math.min(EDGE_RADIUS, w / 2, h / 2, d / 2);
  return new RoundedBoxGeometry(w, h, d, EDGE_SEGMENTS, radius);
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
    const topGeometry = new PlaneGeometry(topW, topD);
    const uv = topGeometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i += 1) {
      uv.setXY(i, uv.getX(i) * topW, uv.getY(i) * topD);
    }
    topGeometry.rotateX(-Math.PI / 2);
    const top = new Mesh(topGeometry, this.materials.material("terrainTop"));
    top.name = "top";
    top.position.y = h / 2 + TOP_LIFT;
    group.add(top);

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

    const eyeWrapper = new Group();
    eyeWrapper.name = "eyeWrapper";
    group.add(eyeWrapper);

    const eyeGeometry = new SphereGeometry(
      r * EYE_RADIUS_RATIO,
      EYE_WIDTH_SEGMENTS,
      EYE_HEIGHT_SEGMENTS,
    );
    eyeGeometry.scale(1, 1, EYE_FLATTEN_Z);
    const eye = new Mesh(eyeGeometry, this.materials.material("eye"));
    eye.name = "eye";
    eye.position.set(0, r * EYE_UP_RATIO, r * EYE_FORWARD_RATIO);
    eyeWrapper.add(eye);

    return group;
  }

  skyDome(radius: number): Mesh {
    const mesh = new Mesh(
      new SphereGeometry(radius, SKY_WIDTH_SEGMENTS, SKY_HEIGHT_SEGMENTS),
      this.materials.skyMaterial(),
    );
    mesh.name = "sky";
    return mesh;
  }

  distantIslands(): InstancedMesh {
    const geometry = new DodecahedronGeometry(1, 0);
    geometry.scale(ISLAND_BASE_X, ISLAND_BASE_Y, ISLAND_BASE_Z);
    const count = tuning.distantIslandCount;
    const mesh = new InstancedMesh(
      geometry,
      this.materials.distantIslandMaterial(),
      count,
    );
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const euler = new Euler();
    const position = new Vector3();
    const scale = new Vector3();
    let state = ISLAND_SEED;
    const rand = (): number => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    };
    for (let i = 0; i < count; i += 1) {
      const angle = ((i + rand() * ISLAND_ANGLE_JITTER) / count) * Math.PI * 2;
      const radius =
        tuning.distantIslandMinRadius +
        rand() *
          (tuning.distantIslandMaxRadius - tuning.distantIslandMinRadius);
      position.set(
        Math.cos(angle) * radius,
        tuning.distantIslandMinY +
          rand() * (tuning.distantIslandMaxY - tuning.distantIslandMinY),
        Math.sin(angle) * radius,
      );
      euler.set(
        (rand() - 0.5) * ISLAND_TILT_RAD,
        rand() * Math.PI * 2,
        (rand() - 0.5) * ISLAND_TILT_RAD,
      );
      quaternion.setFromEuler(euler);
      const s =
        ISLAND_MIN_SCALE + rand() * (ISLAND_MAX_SCALE - ISLAND_MIN_SCALE);
      scale.set(s, s * (ISLAND_FLATTEN_MIN + rand() * ISLAND_FLATTEN_RANGE), s);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.name = "distantIslands";
    return mesh;
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
}
