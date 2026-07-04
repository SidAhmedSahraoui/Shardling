import type { Collider, RigidBody, World } from "@dimforge/rapier3d-compat";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d-compat";
import type { Mesh, Object3D, Scene } from "three";
import { Group, Quaternion, Vector3 } from "three";

import { tuning } from "../../config/tuning";
import type { EventBus } from "../../core/EventBus";
import type { InputSnapshot } from "../../core/InputManager";
import { playerColliderGroups } from "../../game/physics/groups";
import { castGround, removeBody } from "../../game/physics/queries";
import type { MeshFactory } from "../../gfx/MeshFactory";
import { PlayerStateMachine } from "./PlayerStateMachine";

export interface PlayerOptions {
  world: World;
  scene: Scene;
  meshes: MeshFactory;
  bus: EventBus;
  spawn: { x: number; y: number; z: number };
}

export class Player {
  readonly root: Group;
  readonly eyeWrapper: Object3D;

  private readonly world: World;
  private readonly scene: Scene;
  private readonly bus: EventBus;
  private readonly spawn: { x: number; y: number; z: number };
  private body: RigidBody;
  private ballCollider: Collider;
  private readonly ballMesh: Object3D;
  private readonly machine = new PlayerStateMachine();

  private groundedFlag = false;
  private groundHandle: number | null = null;
  private wasGrounded = false;
  private lastTickVy = 0;

  private readonly prevPos = new Vector3();
  private readonly currPos = new Vector3();
  private readonly prevRot = new Quaternion();
  private readonly currRot = new Quaternion();

  private readonly velOut = { x: 0, y: 0, z: 0 };
  private readonly linvelScratch = { x: 0, y: 0, z: 0 };
  private readonly forceScratch = { x: 0, y: 0, z: 0 };
  private readonly machineInput = {
    grounded: false,
    jumpPressed: false,
    jumpHeld: false,
    vy: 0,
    dtMs: 0,
  };

  private carryVelocity: { x: number; z: number } | null = null;
  private readonly carryScratch = { x: 0, z: 0 };

  constructor(opts: PlayerOptions) {
    this.world = opts.world;
    this.scene = opts.scene;
    this.bus = opts.bus;
    this.spawn = { x: opts.spawn.x, y: opts.spawn.y, z: opts.spawn.z };

    this.root = new Group();
    this.root.name = "player";
    const ball = opts.meshes.playerBall();
    this.root.add(ball);
    const ballMesh = ball.getObjectByName("body");
    const eyeWrapper = ball.getObjectByName("eyeWrapper");
    if (!ballMesh || !eyeWrapper) {
      throw new Error("Player: factory ball is missing body/eyeWrapper");
    }
    this.ballMesh = ballMesh;
    this.eyeWrapper = eyeWrapper;
    this.root.position.set(opts.spawn.x, opts.spawn.y, opts.spawn.z);
    opts.scene.add(this.root);

    [this.body, this.ballCollider] = this.createBody();

    this.prevPos.copy(this.root.position);
    this.currPos.copy(this.root.position);
  }

  get collider(): Collider {
    return this.ballCollider;
  }

  get stateName(): string {
    return this.machine.state;
  }

  get position(): Vector3 {
    return this.currPos;
  }

  get velocity(): { x: number; y: number; z: number } {
    return this.velOut;
  }

  get grounded(): boolean {
    return this.groundedFlag;
  }

  get groundColliderHandle(): number | null {
    return this.groundHandle;
  }

  get groundSpeed01(): number {
    if (!this.groundedFlag) {
      return 0;
    }
    const speed = Math.hypot(this.velOut.x, this.velOut.z);
    return Math.min(1, speed / tuning.maxSpeedXZ);
  }

  refreshDoubleJump(): void {
    this.machine.refreshDoubleJump();
  }

  applyBounce(): void {
    const vel = this.velOut;
    this.setLinvel(vel.x, tuning.jumpVelocity * tuning.bouncerVyMult, vel.z);
    this.machine.notifyLaunch();
  }

  setCarry(velocity: { x: number; z: number } | null): void {
    if (velocity === null) {
      this.carryVelocity = null;
      return;
    }
    this.carryScratch.x = velocity.x;
    this.carryScratch.z = velocity.z;
    this.carryVelocity = this.carryScratch;
  }

  step(input: InputSnapshot, dtSec: number): void {
    const vel = this.velOut;

    const machineInput = this.machineInput;
    machineInput.grounded = this.groundedFlag;
    machineInput.jumpPressed = input.jumpPressed;
    machineInput.jumpHeld = input.jumpHeld;
    machineInput.vy = vel.y;
    machineInput.dtMs = dtSec * 1000;
    const intents = this.machine.step(machineInput);

    let vy = vel.y;
    if (intents.jump || intents.doubleJump) {
      vy = intents.jump
        ? tuning.jumpVelocity
        : tuning.jumpVelocity * tuning.doubleJumpMult;
      this.setLinvel(vel.x, vy, vel.z);
      this.bus.emit("player:jumped", { double: intents.doubleJump });
    } else if (intents.cut && vy > 0) {
      vy *= tuning.jumpCutMult;
      this.setLinvel(vel.x, vy, vel.z);
    }

    this.body.resetForces(true);
    const strength =
      tuning.moveForce * (this.groundedFlag ? 1 : tuning.airControlMult);
    if (input.moveVec.x !== 0 || input.moveVec.z !== 0) {
      this.forceScratch.x = input.moveVec.x * strength;
      this.forceScratch.y = 0;
      this.forceScratch.z = input.moveVec.z * strength;
      this.body.addForce(this.forceScratch, true);
    }

    if (this.carryVelocity !== null) {
      const k = tuning.platformCarryStiffness * tuning.ballMass;
      this.forceScratch.x = (this.carryVelocity.x - vel.x) * k;
      this.forceScratch.y = 0;
      this.forceScratch.z = (this.carryVelocity.z - vel.z) * k;
      this.body.addForce(this.forceScratch, true);
    }

    const horizontal = Math.hypot(vel.x, vel.z);
    let clampedX = vel.x;
    let clampedZ = vel.z;
    let clamped = false;
    if (horizontal > tuning.maxSpeedXZ) {
      const scale = tuning.maxSpeedXZ / horizontal;
      clampedX *= scale;
      clampedZ *= scale;
      clamped = true;
    }
    if (vy < -tuning.maxFallSpeed) {
      vy = -tuning.maxFallSpeed;
      clamped = true;
    }
    if (clamped) {
      this.setLinvel(clampedX, vy, clampedZ);
    }

    this.lastTickVy = vy;
  }

  postStep(): void {
    this.prevPos.copy(this.currPos);
    this.prevRot.copy(this.currRot);

    const t = this.body.translation();
    this.currPos.set(t.x, t.y, t.z);
    const r = this.body.rotation();
    this.currRot.set(r.x, r.y, r.z, r.w);

    const vel = this.body.linvel();
    this.velOut.x = vel.x;
    this.velOut.y = vel.y;
    this.velOut.z = vel.z;

    this.groundHandle = castGround(this.world, this.currPos);
    this.groundedFlag = this.groundHandle !== null;
    if (this.groundedFlag && !this.wasGrounded && this.lastTickVy <= 0) {
      this.bus.emit("player:landed", {
        impact: Math.min(1, -this.lastTickVy / tuning.maxFallSpeed),
      });
    }
    this.wasGrounded = this.groundedFlag;
  }

  render(alpha: number): void {
    this.root.position.lerpVectors(this.prevPos, this.currPos, alpha);
    this.ballMesh.quaternion.slerpQuaternions(
      this.prevRot,
      this.currRot,
      alpha,
    );
  }

  respawn(): void {
    removeBody(this.world, this.body);
    [this.body, this.ballCollider] = this.createBody();
    this.machine.reset();
    this.groundedFlag = false;
    this.groundHandle = null;
    this.wasGrounded = false;
    this.carryVelocity = null;
    this.lastTickVy = 0;
    this.velOut.x = 0;
    this.velOut.y = 0;
    this.velOut.z = 0;
    this.prevPos.set(this.spawn.x, this.spawn.y, this.spawn.z);
    this.currPos.copy(this.prevPos);
    this.prevRot.identity();
    this.currRot.identity();
    this.root.position.copy(this.prevPos);
    this.ballMesh.quaternion.identity();
  }

  destroy(): void {
    removeBody(this.world, this.body);
    this.scene.remove(this.root);
    this.root.traverse((obj) => {
      const mesh = obj as Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
      }
    });
  }

  private createBody(): [RigidBody, Collider] {
    const body = this.world.createRigidBody(
      RigidBodyDesc.dynamic()
        .setTranslation(this.spawn.x, this.spawn.y, this.spawn.z)
        .setCcdEnabled(true)
        .setLinearDamping(tuning.linearDamping)
        .setAngularDamping(tuning.angularDamping),
    );
    const collider = this.world.createCollider(
      ColliderDesc.ball(tuning.ballRadius)
        .setMass(tuning.ballMass)
        .setFriction(tuning.friction)
        .setRestitution(tuning.restitution)
        .setCollisionGroups(playerColliderGroups),
      body,
    );
    return [body, collider];
  }

  private setLinvel(x: number, y: number, z: number): void {
    this.linvelScratch.x = x;
    this.linvelScratch.y = y;
    this.linvelScratch.z = z;
    this.body.setLinvel(this.linvelScratch, true);
    this.velOut.x = Math.fround(x);
    this.velOut.y = Math.fround(y);
    this.velOut.z = Math.fround(z);
  }
}
