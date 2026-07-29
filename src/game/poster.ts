import type { Mesh, Object3D } from "three";
import {
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  InstancedMesh,
  Vector3,
} from "three";

import { lighting, worldTheme } from "../config/palette";
import { tuning } from "../config/tuning";
import type { App } from "../core/App";
import type { LoopHooks } from "../core/GameLoop";
import type { MaterialFactory } from "../gfx/MaterialFactory";
import { MeshFactory, setPortalActive } from "../gfx/MeshFactory";
import { TrailRibbon } from "../gfx/TrailRibbon";

export interface PosterScene extends LoopHooks {
  dispose(): void;
  setCamera(view: Framing): void;
  setHero(x: number, y: number, z: number): void;
}

export type PosterFraming = "wide" | "portrait" | "square";

export interface Framing {
  camera: [number, number, number];
  target: [number, number, number];
  fov: number;
}

const POSTER_WORLD = 4;

const HERO = new Vector3(4.2, 3.9, 5.8);
const HERO_STRETCH = 1.16;
const HERO_BODY_SPIN = 2.15;

const FRAMINGS: Record<PosterFraming, Framing> = {
  wide: { camera: [10.2, 5.9, 10.4], target: [0.4, 2.5, -0.8], fov: 40 },
  portrait: { camera: [9.4, 5.2, 10.2], target: [1.2, 2.2, -0.6], fov: 46 },
  square: { camera: [9.8, 5.6, 10.3], target: [0.9, 2.4, -0.7], fov: 43 },
};

const TRAIL_ORIGIN = new Vector3(-3.8, 0.5, 1.4);
const TRAIL_CONTROL = new Vector3(0.2, 5.2, 4.4);
const TRAIL_STEPS = tuning.trailPointCount;
const TRAIL_STEP_DT = 0.0075;

const SHARD_SPOTS: readonly (readonly [number, number, number])[] = [
  [-6.0, 0.6, 3.6],
  [-2.4, 1.5, 2.0],
  [3.4, 2.6, -1.6],
];
const SHARD_HALO_SIZE = 1.0;

const FOREGROUND_CRYSTALS: readonly (readonly [
  number,
  number,
  number,
  number,
])[] = [
  [-5.9, -1.05, 4.2, 1.15],
  [-5.2, -1.2, 5.1, 0.7],
  [5.6, -1.0, 3.4, 0.95],
  [7.6, 0.6, -5.2, 0.6],
];

const MOTE_SPOTS: readonly (readonly [number, number, number, number])[] = [
  [3.2, 2.2, 3.6, 0.2],
  [-1.4, 3.4, 3.2, 0.15],
  [6.2, 3.0, 1.4, 0.17],
  [1.4, 1.4, 4.4, 0.13],
  [-4.4, 2.6, 0.6, 0.16],
  [7.4, 4.2, 3.0, 0.14],
  [0.2, 5.0, 1.8, 0.12],
  [-2.2, 0.6, 5.0, 0.15],
];

const PORTAL_MOTE_SPOTS: readonly (readonly [number, number, number])[] = [
  [6.5, 3.1, -4.2],
  [7.6, 2.6, -4.9],
  [6.9, 3.8, -5.6],
  [7.2, 2.2, -3.9],
];

function isFraming(value: string | null): value is PosterFraming {
  return value === "wide" || value === "portrait" || value === "square";
}

export function posterFraming(value: string | null): PosterFraming {
  return isFraming(value) ? value : "wide";
}

export function buildPoster(
  app: App,
  materials: MaterialFactory,
  framing: PosterFraming,
): PosterScene {
  const { scene, camera } = app;
  const meshes = new MeshFactory(materials);
  const roots: Object3D[] = [];
  const theme = worldTheme(POSTER_WORLD);

  const add = <T extends Object3D>(
    obj: T,
    x: number,
    y: number,
    z: number,
  ): T => {
    obj.position.set(x, y, z);
    scene.add(obj);
    roots.push(obj);
    return obj;
  };

  scene.fog = new FogExp2(theme.fog, tuning.fogDensity);

  const hemi = new HemisphereLight(
    lighting.hemiSky,
    theme.fog,
    tuning.hemiIntensity * tuning.posterKeyLightMult,
  );
  const fill = new HemisphereLight(
    theme.skyHorizonBand,
    theme.fog,
    tuning.fillLightIntensity * tuning.posterKeyLightMult,
  );
  const key = new DirectionalLight(
    theme.sunTint,
    tuning.dirIntensity * tuning.posterKeyLightMult,
  );
  key.position.set(6, 11, 7);
  const rim = new DirectionalLight(
    theme.skyHorizonBand,
    tuning.posterRimLightIntensity,
  );
  rim.position.set(-7, 3.5, -9);
  scene.add(hemi, fill, key, rim);
  roots.push(hemi, fill, key, rim);

  add(meshes.skyDome(80, POSTER_WORLD), 0, 0, 0);
  materials.releaseSkiesExcept(POSTER_WORLD);
  materials.setDustTheme(POSTER_WORLD);
  add(meshes.distantIslands(POSTER_WORLD), 0, 0, 0);
  add(meshes.midIslands(POSTER_WORLD), 0, 0, 0);
  add(meshes.cloudSea(POSTER_WORLD), 0, 0, 0);

  add(meshes.platform(5, 1, 4), -8.5, -2.1, 5.0);
  add(meshes.platform(9.5, 1, 7), -0.6, -0.5, 0.8);
  add(meshes.platform(4.5, 1, 3.5), 5.4, 1.1, -3.4);
  add(meshes.platform(6, 1, 5), 10.2, 2.7, -8.4);
  add(meshes.ramp(2.6, 1.5, 2.2, "+x"), 2.4, 0.75, -2.0);

  const portal = add(meshes.portal(), 10.2, 3.2, -8.4);
  portal.rotation.y = -Math.PI * 0.3;
  setPortalActive(portal, true, materials);

  add(meshes.bouncer(), -8.5, -1.6, 5.0);
  add(meshes.spikeStrip(3.6, 1.2), -1.6, 0, -1.4);
  const blade = add(meshes.blade(1), 7.9, 2.5, -6.0);
  blade.rotation.x = Math.PI / 2;
  blade.rotation.z = 0.8;

  const shards: Object3D[] = [];
  for (const [x, y, z] of SHARD_SPOTS) {
    const halo = add(meshes.particleSprite("spark", SHARD_HALO_SIZE), x, y, z);
    halo.renderOrder = -1;
    shards.push(add(meshes.shard(), x, y, z));
  }

  for (const [x, y, z, size] of FOREGROUND_CRYSTALS) {
    const crystal = add(meshes.crystalCluster(POSTER_WORLD, size), x, y, z);
    crystal.rotation.set(0.12, size * 2.4, -0.16);
  }

  for (const [x, y, z, size] of MOTE_SPOTS) {
    add(meshes.particleSprite("mote", size), x, y, z);
  }
  for (const [x, y, z] of PORTAL_MOTE_SPOTS) {
    add(meshes.particleSprite("portalMote", 0.22), x, y, z);
  }

  for (const root of roots) {
    meshes.applyWorldTheme(root, POSTER_WORLD);
  }

  const hero = add(meshes.playerBall(), HERO.x, HERO.y, HERO.z);
  hero.scale.set(1 / HERO_STRETCH, HERO_STRETCH, 1 / HERO_STRETCH);
  for (const part of ["body", "rim"]) {
    const mesh = hero.getObjectByName(part);
    if (mesh) {
      mesh.rotation.y = HERO_BODY_SPIN;
    }
  }
  materials.material("player").emissiveIntensity = tuning.posterVeinEmissive;

  const trail = new TrailRibbon({ scene, materials });
  trail.setVisible(true);
  const legA = new Vector3();
  const legB = new Vector3();
  const trailPoint = new Vector3();
  for (let i = 0; i <= TRAIL_STEPS; i += 1) {
    const t = i / TRAIL_STEPS;
    legA.copy(TRAIL_ORIGIN).lerp(TRAIL_CONTROL, t);
    legB.copy(TRAIL_CONTROL).lerp(HERO, t);
    trailPoint.copy(legA).lerp(legB, t);
    trail.update(
      TRAIL_STEP_DT,
      trailPoint.x,
      trailPoint.y,
      trailPoint.z,
      tuning.maxSpeedXZ,
    );
  }

  const view: Framing = {
    camera: [...FRAMINGS[framing].camera],
    target: [...FRAMINGS[framing].target],
    fov: FRAMINGS[framing].fov,
  };
  const target = new Vector3();

  const placeCamera = (): void => {
    camera.fov = view.fov;
    camera.position.set(view.camera[0], view.camera[1], view.camera[2]);
    target.set(view.target[0], view.target[1], view.target[2]);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  };

  const aimEyes = (): void => {
    const wrapper = hero.getObjectByName("eyeWrapper");
    if (!wrapper) {
      return;
    }
    wrapper.rotation.y = Math.atan2(
      camera.position.x - hero.position.x,
      camera.position.z - hero.position.z,
    );
    wrapper.rotation.x = tuning.posterEyePitchRad;
  };

  placeCamera();
  aimEyes();

  return {
    step(): void {},

    render(_alpha: number, frameDt: number): void {
      placeCamera();
      aimEyes();
      app.render(frameDt);
    },

    dispose(): void {
      trail.destroy();
      for (const root of roots) {
        root.traverse((obj) => {
          const instanced = obj as InstancedMesh;
          if (instanced.isInstancedMesh) {
            instanced.dispose();
          }
          const mesh = obj as Mesh;
          if (mesh.isMesh) {
            mesh.geometry.dispose();
          }
        });
        scene.remove(root);
      }
      roots.length = 0;
      scene.fog = null;
      materials.material("player").emissiveIntensity = tuning.veinEmissiveIdle;
    },

    setCamera(next: Framing): void {
      view.camera = [...next.camera];
      view.target = [...next.target];
      view.fov = next.fov;
      placeCamera();
      aimEyes();
    },

    setHero(x: number, y: number, z: number): void {
      hero.position.set(x, y, z);
      aimEyes();
    },
  };
}
