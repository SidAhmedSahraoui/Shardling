import type { InstancedMesh, Mesh, Object3D } from "three";
import { DirectionalLight, FogExp2, HemisphereLight, Vector3 } from "three";

import { lighting, worldTheme } from "../config/palette";
import { tuning } from "../config/tuning";
import type { App } from "../core/App";
import type { LoopHooks } from "../core/GameLoop";
import type { MaterialFactory } from "../gfx/MaterialFactory";
import { MeshFactory, setPortalActive } from "../gfx/MeshFactory";

export interface ShowcaseScene extends LoopHooks {
  dispose(): void;
}

export interface ShowcaseOptions {
  reduceMotion: () => boolean;
}

const BLADE_REV_PER_SEC = 1.5;
const SHARD_BOB_AMPLITUDE = 0.1;
const SHARD_BOB_PERIOD_SEC = 1.6;
const SHARD_SPIN_RAD_PER_SEC = 1.2;
const PORTAL_TOGGLE_SEC = 4;

const MOTE_COUNT = 14;
const MOTE_SIZE = 0.15;
const MOTE_SCATTER_RAD = 2.4;
const MOTE_DRIFT_AMPLITUDE = 0.25;
const MOTE_DRIFT_PERIOD_SEC = 6;

const SHOWCASE_WORLD = 4;
const ORBIT_PERIOD_SEC = 45;
const ORBIT_RADIUS = 10.5;
const ORBIT_HEIGHT = 5.5;
const ORBIT_START_RAD = 0.6;
const ORBIT_CENTER = new Vector3(0.5, 0.8, 0);

export function buildShowcase(
  app: App,
  materials: MaterialFactory,
  opts: ShowcaseOptions,
): ShowcaseScene {
  const { scene, camera } = app;
  const meshes = new MeshFactory(materials);
  const roots: Object3D[] = [];
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

  const theme = worldTheme(SHOWCASE_WORLD);
  scene.fog = new FogExp2(theme.fog, tuning.fogDensity);

  const hemi = new HemisphereLight(
    lighting.hemiSky,
    theme.fog,
    tuning.hemiIntensity * tuning.showcaseLightMult,
  );
  const fill = new HemisphereLight(
    theme.skyHorizonBand,
    theme.fog,
    tuning.fillLightIntensity * tuning.showcaseLightMult,
  );
  const dir = new DirectionalLight(
    theme.sunTint,
    tuning.dirIntensity * tuning.showcaseLightMult,
  );
  dir.position.set(5, 10, 4);
  scene.add(hemi, fill, dir);
  roots.push(hemi, fill, dir);

  add(meshes.skyDome(80, SHOWCASE_WORLD), 0, 0, 0);
  materials.releaseSkiesExcept(SHOWCASE_WORLD);
  materials.setDustTheme(SHOWCASE_WORLD);
  const islands = add(meshes.distantIslands(SHOWCASE_WORLD), 0, 0, 0);
  const midIslands = add(meshes.midIslands(SHOWCASE_WORLD), 0, 0, 0);
  const clouds = add(meshes.cloudSea(SHOWCASE_WORLD), 0, 0, 0);

  add(meshes.platform(14, 1, 10), 0, -0.5, 0);
  add(meshes.ramp(3, 1.5, 2.5, "+x"), -4.5, 0.75, -2.5);
  add(meshes.platform(4, 1, 3), 4.5, 0.5, -3);

  add(meshes.spikeStrip(3, 1.5), 0.5, 0, 3);
  add(meshes.spikeTooth(), 2.6, 0, 3);
  const blade = add(meshes.blade(0.9), -2.5, 1.1, 2.8);
  const bladeDisc = blade.getObjectByName("disc");

  const portal = add(meshes.portal(), 5, 0, 2.2);
  portal.rotation.y = -Math.PI / 5;

  const shards = [
    add(meshes.shard(), -1.5, 1.5, -1.5),
    add(meshes.shard(), 4.5, 2.0, -3),
    add(meshes.shard(), 2, 1.4, 0.6),
  ];
  const shardBaseY = shards.map((s) => s.position.y);

  const ball = add(meshes.playerBall(), -0.5, 0.4, 0.8);
  ball.rotation.y = ORBIT_START_RAD;

  const motes: { sprite: Object3D; baseY: number; phase: number }[] = [];
  for (let i = 0; i < MOTE_COUNT; i += 1) {
    const angle = i * MOTE_SCATTER_RAD;
    const radius = 3 + (i % 4) * 1.3;
    const baseY = 0.8 + ((i * 37) % 50) / 10;
    const sprite = add(
      meshes.particleSprite("mote", MOTE_SIZE),
      ORBIT_CENTER.x + Math.cos(angle) * radius,
      baseY,
      Math.sin(angle) * radius,
    );
    motes.push({ sprite, baseY, phase: i * 0.7 });
  }

  for (const root of roots) {
    meshes.applyWorldTheme(root, SHOWCASE_WORLD);
  }

  let elapsed = 0;
  let orbitRad = ORBIT_START_RAD;
  let portalActive = false;
  let portalTimer = 0;

  const placeCamera = (): void => {
    camera.position.set(
      ORBIT_CENTER.x + Math.sin(orbitRad) * ORBIT_RADIUS,
      ORBIT_HEIGHT,
      ORBIT_CENTER.z + Math.cos(orbitRad) * ORBIT_RADIUS,
    );
    camera.lookAt(ORBIT_CENTER);
  };
  placeCamera();

  return {
    step(): void {},

    render(_alpha: number, frameDt: number): void {
      elapsed += frameDt;

      const reduceMotion = opts.reduceMotion();

      if (bladeDisc) {
        bladeDisc.rotation.y += frameDt * BLADE_REV_PER_SEC * Math.PI * 2;
      }
      const bob =
        Math.sin((elapsed / SHARD_BOB_PERIOD_SEC) * Math.PI * 2) *
        SHARD_BOB_AMPLITUDE;
      for (let i = 0; i < shards.length; i += 1) {
        const shard = shards[i];
        if (shard) {
          shard.position.y = (shardBaseY[i] ?? 0) + bob;
          shard.rotation.y += frameDt * SHARD_SPIN_RAD_PER_SEC;
        }
      }

      portalTimer += frameDt;
      if (portalTimer >= PORTAL_TOGGLE_SEC) {
        portalTimer = 0;
        portalActive = !portalActive;
        setPortalActive(portal, portalActive, materials);
      }

      if (!reduceMotion) {
        const motePhase = (elapsed / MOTE_DRIFT_PERIOD_SEC) * Math.PI * 2;
        for (let i = 0; i < motes.length; i += 1) {
          const mote = motes[i];
          if (mote) {
            mote.sprite.position.y =
              mote.baseY +
              Math.sin(motePhase + mote.phase) * MOTE_DRIFT_AMPLITUDE;
          }
        }
        orbitRad += (frameDt * (Math.PI * 2)) / ORBIT_PERIOD_SEC;
        islands.rotation.y += frameDt * tuning.distantIslandDriftRadPerSec;
        midIslands.rotation.y -= frameDt * tuning.midIslandDriftRadPerSec;
        clouds.rotation.y += frameDt * tuning.cloudSeaDriftRadPerSec;
      }
      placeCamera();

      app.render(frameDt);
    },

    dispose(): void {
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
    },
  };
}
