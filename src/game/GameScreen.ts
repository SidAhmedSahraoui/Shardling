import type { Collider, World } from "@dimforge/rapier3d-compat";
import type { InstancedMesh, Mesh, Object3D } from "three";
import { DirectionalLight, FogExp2, HemisphereLight } from "three";

import { lighting, palette } from "../config/palette";
import { tuning } from "../config/tuning";
import type { App } from "../core/App";
import type { AudioSynth } from "../core/AudioSynth";
import type { EventBus } from "../core/EventBus";
import type { LoopHooks } from "../core/GameLoop";
import type { InputManager } from "../core/InputManager";
import type { SaveManager } from "../core/SaveManager";
import { isJuiceDisabled } from "../debug/flags";
import type { Bouncer } from "../entities/Bouncer";
import type { BuiltLevel, ColliderTag } from "../entities/EntityFactory";
import { buildLevel } from "../entities/EntityFactory";
import type { Crumble } from "../entities/hazards/Crumble";
import type { MovingPlatform } from "../entities/hazards/MovingPlatform";
import { Player } from "../entities/player/Player";
import { PlayerVisuals } from "../entities/player/PlayerVisuals";
import { BlobShadow } from "../gfx/BlobShadow";
import type { MaterialFactory } from "../gfx/MaterialFactory";
import { MeshFactory } from "../gfx/MeshFactory";
import { MoteField } from "../gfx/MoteField";
import { ParticleFactory } from "../gfx/ParticleFactory";
import type { LevelData } from "../levels/schema";
import { CameraRig } from "./CameraRig";
import type { Graybox } from "./graybox";
import { buildGraybox } from "./graybox";
import { LevelRunner } from "./LevelRunner";
import { castShadowGround, castToCamera } from "./physics/queries";
import { createPhysicsWorld } from "./physics/world";

const DIR_LIGHT_POSITION = { x: 5, y: 10, z: 4 };
const SKY_RADIUS = 80;

export type GameScreenMode =
  { kind: "level"; data: LevelData } | { kind: "graybox" };

export interface GameScreenOptions {
  app: App;
  materials: MaterialFactory;
  bus: EventBus;
  audio: AudioSynth;
  input: InputManager;
  save: SaveManager;
  mode: GameScreenMode;
  isCameraExternal?: () => boolean;
  deathVisual?: () => Promise<void>;
}

export class GameScreen implements LoopHooks {
  readonly world: World;

  private readonly app: App;
  private readonly bus: EventBus;
  private readonly audio: AudioSynth;
  private readonly input: InputManager;
  private readonly save: SaveManager;
  private readonly isCameraExternal: () => boolean;
  private readonly deathVisual: () => Promise<void>;

  private readonly meshes: MeshFactory;
  private readonly builtLevel: BuiltLevel | null = null;
  private readonly graybox: Graybox | null = null;
  private readonly colliderTags: Map<number, ColliderTag>;
  private readonly crumbleByHandle: Map<number, Crumble>;
  private readonly platformByHandle: Map<number, MovingPlatform>;
  private readonly levelRunner: LevelRunner | null = null;
  private readonly rig: CameraRig;
  private readonly shadow: BlobShadow;
  private readonly particles: ParticleFactory;
  private readonly moteField: MoteField | null = null;
  private readonly hemi: HemisphereLight;
  private readonly hemiBaseIntensity: number;
  private readonly noJuice = isJuiceDisabled();
  private readonly spawn: { x: number; y: number; z: number };
  private readonly killY: number;
  private player: Player;
  private visuals: PlayerVisuals;

  private readonly dressing: Object3D[] = [];
  private readonly islands: InstancedMesh;
  private readonly midIslands: InstancedMesh;
  private readonly unsubs: (() => void)[] = [];

  private readonly velXZ = { x: 0, z: 0 };

  private reduceMotionFlag: boolean;

  private destroyed = false;
  private pausedFlag = false;
  private dyingFlag = false;
  private deathAge = 0;
  private deathBeatsFired = false;
  private flashAge = Infinity;
  private completedFrozen = false;
  private pendingDeath: "hazard" | "fall" | null = null;
  private pendingPortalEnter = false;
  private pendingBounce: Bouncer | null = null;

  private timerStarted = false;
  private readonly lastGrounded = { x: 0, y: 0, z: 0 };
  private hasGrounded = false;
  private readonly checkpoint = { x: 0, y: 0, z: 0 };
  private hasCheckpoint = false;
  private readonly checkpointProbe = { x: 0, y: 0, z: 0 };

  private readonly onOverlap = (other: Collider): void => {
    const tag = this.colliderTags.get(other.handle);
    if (!tag) {
      return;
    }
    if (tag.kind === "shard") {
      if (tag.shard && !tag.shard.collected) {
        const at = tag.shard.position;
        tag.shard.collect(this.noJuice);
        if (!this.noJuice) {
          this.particles.spawnCollectRing(at.x, at.y, at.z);
          this.particles.spawnCollectSparks(at.x, at.y, at.z);
        }
        this.levelRunner?.notifyShardCollected();
        if (this.hasGrounded) {
          this.checkpoint.x = this.lastGrounded.x;
          this.checkpoint.y = this.lastGrounded.y;
          this.checkpoint.z = this.lastGrounded.z;
          this.hasCheckpoint = true;
        }
      }
    } else if (tag.kind === "hazard") {
      this.pendingDeath = "hazard";
    } else if (tag.kind === "bouncer") {
      this.pendingBounce = tag.bouncer ?? null;
    } else {
      this.pendingPortalEnter = true;
    }
  };

  constructor(opts: GameScreenOptions) {
    this.app = opts.app;
    this.bus = opts.bus;
    this.audio = opts.audio;
    this.input = opts.input;
    this.save = opts.save;
    this.isCameraExternal = opts.isCameraExternal ?? (() => false);
    this.deathVisual = opts.deathVisual ?? (() => Promise.resolve());
    this.meshes = new MeshFactory(opts.materials);

    const { scene, camera } = this.app;
    scene.fog = new FogExp2(palette.fog, tuning.fogDensity);
    const hemi = new HemisphereLight(
      lighting.hemiSky,
      lighting.hemiGround,
      tuning.hemiIntensity,
    );
    this.hemi = hemi;
    this.hemiBaseIntensity = hemi.intensity;
    const dir = new DirectionalLight(lighting.directional, tuning.dirIntensity);
    dir.position.set(
      DIR_LIGHT_POSITION.x,
      DIR_LIGHT_POSITION.y,
      DIR_LIGHT_POSITION.z,
    );
    const fill = new HemisphereLight(
      palette.skyHorizon,
      palette.fog,
      tuning.fillLightIntensity,
    );
    const sky = this.meshes.skyDome(SKY_RADIUS);
    const islands = this.meshes.distantIslands();
    const midIslands = this.meshes.midIslands();
    this.islands = islands;
    this.midIslands = midIslands;
    scene.add(hemi, fill, dir, sky, islands, midIslands);
    this.dressing.push(hemi, fill, dir, sky, islands, midIslands);

    this.world = createPhysicsWorld();

    this.reduceMotionFlag = this.save.getSettings().reduceMotion;
    this.unsubs.push(
      this.bus.on("settings:changed", ({ settings }) => {
        this.reduceMotionFlag = settings.reduceMotion;
      }),
    );
    const reduceMotion = (): boolean => this.reduceMotionFlag;

    this.particles = new ParticleFactory({ scene, meshes: this.meshes });

    if (opts.mode.kind === "level") {
      const data = opts.mode.data;
      this.builtLevel = buildLevel({
        data,
        world: this.world,
        scene,
        meshes: this.meshes,
        materials: opts.materials,
        bus: this.bus,
        reduceMotion,
        particles: this.particles,
        noJuice: () => this.noJuice,
      });
      this.spawn = data.spawn;
      this.killY = data.killY;
      this.moteField = new MoteField({
        scene,
        materials: opts.materials,
        bounds: data.bounds,
      });
      this.moteField.setVisible(!this.noJuice);
      this.levelRunner = new LevelRunner({
        bus: this.bus,
        levelId: data.id,
        shardTotal: data.shards.length,
      });
      this.unsubs.push(
        this.bus.on("shards:complete", () => {
          this.builtLevel?.portal.setActive(true);
          this.audio.setHum(true);
          if (!this.reduceMotionFlag && !this.noJuice) {
            this.flashAge = 0;
          }
        }),
      );
      this.unsubs.push(
        this.bus.on("level:complete", () => {
          this.completedFrozen = true;
          this.input.disable();
          this.audio.setRolling(0);
        }),
      );
      this.levelRunner.start();
    } else {
      this.graybox = buildGraybox(this.world, scene, this.meshes, reduceMotion);
      this.spawn = this.graybox.spawn;
      this.killY = this.graybox.killY;
    }
    const active = this.builtLevel ?? this.graybox;
    this.colliderTags = active?.colliderTags ?? new Map<number, ColliderTag>();
    this.crumbleByHandle =
      active?.crumbleByHandle ?? new Map<number, Crumble>();
    this.platformByHandle =
      active?.platformByHandle ?? new Map<number, MovingPlatform>();

    this.player = this.buildPlayer();
    this.visuals = this.buildVisuals();

    this.rig = new CameraRig({
      camera,
      castToCamera: (from, to) => castToCamera(this.world, from, to),
    });
    this.rig.snapTo(this.spawn);

    this.shadow = new BlobShadow({ scene, materials: opts.materials });

    this.audio.setAmbient(true);
    this.input.enable();
  }

  get cameraYaw(): number {
    return this.rig.getYaw();
  }

  get playerStateName(): string {
    return this.player.stateName;
  }

  get particleCount(): number {
    return this.particles.liveCount;
  }

  get runner(): LevelRunner | null {
    return this.levelRunner;
  }

  get paused(): boolean {
    return this.pausedFlag;
  }

  get dying(): boolean {
    return this.dyingFlag;
  }

  setPaused(paused: boolean): void {
    if (this.destroyed || this.pausedFlag === paused) {
      return;
    }
    this.pausedFlag = paused;
    this.levelRunner?.setPaused(paused);
    if (paused) {
      this.input.disable();
      this.audio.setRolling(0);
      this.bus.emit("game:paused");
    } else {
      this.input.enable();
      this.bus.emit("game:resumed");
    }
  }

  restartLevel(): void {
    if (this.destroyed || this.dyingFlag) {
      return;
    }
    this.completedFrozen = false;
    this.levelRunner?.restart();
    this.resetWorldToSpawn();
    if (!this.pausedFlag) {
      this.input.enable();
    }
  }

  step(dt: number): void {
    if (this.destroyed || this.pausedFlag || this.completedFrozen) {
      return;
    }
    if (this.dyingFlag) {
      this.deathAge += dt;
      const hitStopSec =
        this.reduceMotionFlag || this.noJuice ? 0 : tuning.hitStopMs / 1000;
      if (!this.deathBeatsFired && this.deathAge >= hitStopSec) {
        this.deathBeatsFired = true;
        if (!this.noJuice) {
          const p = this.player.position;
          this.particles.spawnSootBurst(p.x, p.y, p.z);
          if (!this.reduceMotionFlag) {
            this.rig.shake(
              tuning.deathShakeMs / 1000,
              tuning.deathShakeAmplitude,
            );
          }
        }
        void this.deathVisual().then(() => {
          if (this.destroyed) {
            return;
          }
          this.resetWorldToSpawn(true);
          this.dyingFlag = false;
          if (!this.pausedFlag && !this.completedFrozen) {
            this.input.enable();
          }
        });
      }
      if (this.timerStarted) {
        this.levelRunner?.tick(dt);
      }
      return;
    }

    const snap = this.input.sample(dt);
    if (
      !this.timerStarted &&
      (snap.moveVec.x !== 0 || snap.moveVec.z !== 0 || snap.jumpPressed)
    ) {
      this.timerStarted = true;
    }
    if (snap.restartPressed) {
      this.restartLevel();
    }
    this.rig.applyInput(snap.camYawDelta, snap.zoomDelta);
    this.builtLevel?.physicsStep(dt, this.player.position);
    this.graybox?.physicsStep(dt, this.player.position);
    const standingOn = this.player.groundColliderHandle;
    const carrier =
      standingOn !== null ? this.platformByHandle.get(standingOn) : undefined;
    this.player.setCarry(carrier ? carrier.velocity : null);
    this.player.step(snap, dt);
    this.world.step();
    this.player.postStep();
    if (this.player.grounded) {
      const pos = this.player.position;
      this.lastGrounded.x = pos.x;
      this.lastGrounded.y = pos.y;
      this.lastGrounded.z = pos.z;
      this.hasGrounded = true;
    }
    this.audio.setRolling(this.player.groundSpeed01);

    this.world.intersectionPairsWith(this.player.collider, this.onOverlap);
    if (this.pendingBounce !== null) {
      const pad = this.pendingBounce;
      this.pendingBounce = null;
      const vy = this.player.velocity.y;
      if (
        vy <= tuning.bouncerRetriggerVy &&
        (this.player.groundColliderHandle === pad.padColliderHandle ||
          vy < tuning.bouncerCatchVy)
      ) {
        this.player.applyBounce();
        pad.squash();
        this.bus.emit("player:bounced");
      }
    }
    if (this.pendingPortalEnter) {
      this.pendingPortalEnter = false;
      this.tryCompleteLevel();
    }
    const groundHandle = this.player.groundColliderHandle;
    if (groundHandle !== null) {
      this.crumbleByHandle.get(groundHandle)?.trigger();
    }

    if (this.player.position.y < this.killY) {
      this.pendingDeath = "fall";
    }
    if (this.pendingDeath !== null && !this.completedFrozen) {
      const cause = this.pendingDeath;
      this.pendingDeath = null;
      if (this.builtLevel) {
        this.die(cause);
      } else {
        this.resetWorldToSpawn();
      }
    } else if (this.completedFrozen) {
      this.pendingDeath = null;
    }

    if (this.timerStarted) {
      this.levelRunner?.tick(dt);
    }
  }

  render(alpha: number, frameDt: number): void {
    if (this.destroyed) {
      return;
    }
    this.player.render(alpha);
    this.visuals.update(frameDt);
    this.builtLevel?.update(frameDt, alpha);
    this.graybox?.update(frameDt, alpha);
    this.particles.update(frameDt);
    this.moteField?.update(frameDt, !this.reduceMotionFlag);
    if (!this.reduceMotionFlag && !this.noJuice) {
      this.islands.rotation.y += frameDt * tuning.distantIslandDriftRadPerSec;
      this.midIslands.rotation.y -= frameDt * tuning.midIslandDriftRadPerSec;
    }
    if (this.flashAge < tuning.portalFlashMs / 1000) {
      this.flashAge += frameDt;
      const u = Math.min(1, this.flashAge / (tuning.portalFlashMs / 1000));
      this.hemi.intensity =
        this.hemiBaseIntensity *
        (1 + (tuning.portalFlashIntensityMult - 1) * (1 - u));
    } else if (this.hemi.intensity !== this.hemiBaseIntensity) {
      this.hemi.intensity = this.hemiBaseIntensity;
    }

    const pos = this.player.root.position;
    if (!this.isCameraExternal()) {
      this.velXZ.x = this.player.velocity.x;
      this.velXZ.z = this.player.velocity.z;
      this.rig.update(frameDt, pos, this.velXZ);
    }
    this.shadow.update(pos, castShadowGround(this.world, pos));

    this.app.render(frameDt);
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    for (const unsub of this.unsubs) {
      unsub();
    }
    this.unsubs.length = 0;
    this.input.disable();
    this.audio.stopRolling();
    this.audio.setHum(false);
    this.audio.setAmbient(false);
    this.levelRunner?.destroy();
    this.visuals.destroy();
    this.shadow.dispose();
    this.particles.dispose();
    this.moteField?.dispose();
    this.player.destroy();
    this.builtLevel?.dispose();
    this.graybox?.dispose();

    const { scene } = this.app;
    for (const obj of this.dressing) {
      scene.remove(obj);
      const instanced = obj as InstancedMesh;
      if (instanced.isInstancedMesh) {
        instanced.dispose();
      }
      const mesh = obj as Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
      }
    }
    this.dressing.length = 0;
    scene.fog = null;

    this.world.free();
  }

  private die(cause: "hazard" | "fall"): void {
    if (this.dyingFlag) {
      return;
    }
    this.dyingFlag = true;
    this.deathAge = 0;
    this.deathBeatsFired = false;
    this.input.disable();
    this.audio.setRolling(0);
    this.levelRunner?.notifyDeath(cause);
  }

  private tryCompleteLevel(): void {
    const runner = this.levelRunner;
    if (!runner || runner.completed || !runner.allShardsCollected) {
      return;
    }
    runner.notifyPortalEntered();
  }

  private resetWorldToSpawn(keepProgress = false): void {
    const keep = keepProgress && this.builtLevel !== null;
    if (this.builtLevel && !keep) {
      this.builtLevel.resetShards();
      this.builtLevel.portal.setActive(false);
      this.audio.setHum(false);
      this.levelRunner?.notifyShardsReset();
    }
    this.builtLevel?.resetDynamic();
    this.graybox?.resetDynamic();
    this.pendingBounce = null;
    this.particles.clear();
    this.flashAge = Infinity;
    this.hemi.intensity = this.hemiBaseIntensity;
    if (!keep) {
      this.hasCheckpoint = false;
      this.hasGrounded = false;
      this.timerStarted = false;
    }
    const at = keep && this.checkpointIsSafe() ? this.checkpoint : this.spawn;
    this.player.respawn(at);
    this.rig.snapTo(at);
  }

  private checkpointIsSafe(): boolean {
    if (!this.hasCheckpoint) {
      return false;
    }
    this.checkpointProbe.x = this.checkpoint.x;
    this.checkpointProbe.y = this.checkpoint.y + tuning.ballRadius;
    this.checkpointProbe.z = this.checkpoint.z;
    return castShadowGround(this.world, this.checkpointProbe) !== null;
  }

  private buildPlayer(): Player {
    return new Player({
      world: this.world,
      scene: this.app.scene,
      meshes: this.meshes,
      bus: this.bus,
      spawn: this.spawn,
    });
  }

  private buildVisuals(): PlayerVisuals {
    return new PlayerVisuals({
      target: this.player.root,
      eyeWrapper: this.player.eyeWrapper,
      scene: this.app.scene,
      meshes: this.meshes,
      bus: this.bus,
      reduceMotion: () => this.save.getSettings().reduceMotion,
      noJuice: () => isJuiceDisabled(),
      getVelocity: () => this.player.velocity,
      getGrounded: () => this.player.grounded,
    });
  }
}
