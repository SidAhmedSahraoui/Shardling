import type { PerspectiveCamera } from "three";
import { Vector3 } from "three";

import { tuning } from "../config/tuning";
import type { Vec3, VecXZ } from "../core/cameraRelative";

const LOOK_HEIGHT = 0.5;
const MIN_PULL_IN_DISTANCE = 0.5;
const LERP_REFERENCE_HZ = 60;
const DEGENERATE_SEGMENT_EPSILON = 1e-6;
const TWO_PI = Math.PI * 2;
const DEG_TO_RAD = Math.PI / 180;
const SHAKE_HZ_A = 131;
const SHAKE_HZ_B = 167;
const SHAKE_HZ_C = 103;

export interface CameraRigOptions {
  camera: PerspectiveCamera;
  castToCamera: (from: Vec3, to: Vec3) => number | null;
  initialYaw?: number;
}

function frameLerpFactor(perFrameLerp: number, dtSec: number): number {
  return 1 - Math.pow(1 - perFrameLerp, dtSec * LERP_REFERENCE_HZ);
}

function clamp(value: number, lo: number, hi: number): number {
  return value < lo ? lo : value > hi ? hi : value;
}

export class CameraRig {
  private readonly camera: PerspectiveCamera;
  private readonly castToCamera: (from: Vec3, to: Vec3) => number | null;

  private yaw: number;
  private desiredDistance: number;
  private appliedDistance: number;

  private shakeAge = Infinity;
  private shakeDurationSec = 0;
  private shakeAmplitude = 0;

  private readonly smoothedLook = new Vector3(0, LOOK_HEIGHT, 0);
  private readonly lookDesired = new Vector3();
  private readonly camPos = new Vector3();
  private readonly castFrom = new Vector3();
  private readonly castSeg = new Vector3();

  constructor(opts: CameraRigOptions) {
    this.camera = opts.camera;
    this.castToCamera = opts.castToCamera;
    this.yaw = opts.initialYaw ?? 0;
    this.desiredDistance = clamp(
      tuning.camDistance,
      tuning.camDistanceMin,
      tuning.camDistanceMax,
    );
    this.appliedDistance = this.desiredDistance;
  }

  getYaw(): number {
    return this.yaw;
  }

  applyInput(camYawDelta: number, zoomDelta: number): void {
    this.yaw = (this.yaw + camYawDelta) % TWO_PI;
    this.desiredDistance = clamp(
      this.desiredDistance + zoomDelta,
      tuning.camDistanceMin,
      tuning.camDistanceMax,
    );
  }

  shake(durationSec: number, amplitude: number): void {
    this.shakeAge = 0;
    this.shakeDurationSec = durationSec;
    this.shakeAmplitude = amplitude;
  }

  update(frameDtSec: number, targetPos: Vec3, targetVelXZ: VecXZ): void {
    const aheadPerSpeed = tuning.camLookAheadMax / tuning.maxSpeedXZ;
    let aheadX = targetVelXZ.x * aheadPerSpeed;
    let aheadZ = targetVelXZ.z * aheadPerSpeed;
    const aheadLen = Math.hypot(aheadX, aheadZ);
    if (aheadLen > tuning.camLookAheadMax) {
      const scale = tuning.camLookAheadMax / aheadLen;
      aheadX *= scale;
      aheadZ *= scale;
    }
    this.lookDesired.set(
      targetPos.x + aheadX,
      targetPos.y + LOOK_HEIGHT,
      targetPos.z + aheadZ,
    );
    this.smoothedLook.lerp(
      this.lookDesired,
      frameLerpFactor(tuning.camFollowLerp, frameDtSec),
    );

    this.desiredDistance = clamp(
      this.desiredDistance,
      tuning.camDistanceMin,
      tuning.camDistanceMax,
    );
    const recovered =
      this.appliedDistance +
      (this.desiredDistance - this.appliedDistance) *
        frameLerpFactor(tuning.camOcclusionRecoverLerp, frameDtSec);
    this.appliedDistance = Math.min(recovered, this.desiredDistance);

    if (this.shakeAge < this.shakeDurationSec) {
      this.shakeAge += frameDtSec;
    }

    this.place(targetPos);
  }

  snapTo(targetPos: Vec3): void {
    this.shakeAge = Infinity;
    this.smoothedLook.set(targetPos.x, targetPos.y + LOOK_HEIGHT, targetPos.z);
    this.appliedDistance = clamp(
      this.desiredDistance,
      tuning.camDistanceMin,
      tuning.camDistanceMax,
    );
    this.place(targetPos);
  }

  private place(targetPos: Vec3): void {
    const pitchRad = tuning.camPitchDeg * DEG_TO_RAD;
    const planar = Math.cos(pitchRad) * this.appliedDistance;
    const height = Math.sin(-pitchRad) * this.appliedDistance;
    this.camPos.set(
      this.smoothedLook.x + Math.sin(this.yaw) * planar,
      this.smoothedLook.y + height,
      this.smoothedLook.z + Math.cos(this.yaw) * planar,
    );

    this.castFrom.set(targetPos.x, targetPos.y, targetPos.z);
    const hitDist = this.castToCamera(this.castFrom, this.camPos);
    if (hitDist !== null) {
      this.castSeg.subVectors(this.camPos, this.castFrom);
      const segLen = this.castSeg.length();
      if (segLen > DEGENERATE_SEGMENT_EPSILON) {
        const pulled = clamp(hitDist, MIN_PULL_IN_DISTANCE, segLen);
        const frac = pulled / segLen;
        this.camPos.copy(this.castFrom).addScaledVector(this.castSeg, frac);
        this.appliedDistance = Math.max(
          this.appliedDistance * frac,
          MIN_PULL_IN_DISTANCE,
        );
      }
    }

    if (this.shakeAge < this.shakeDurationSec) {
      const decay = 1 - this.shakeAge / this.shakeDurationSec;
      const a = this.shakeAmplitude * decay;
      const t = this.shakeAge;
      this.camPos.x += Math.sin(t * SHAKE_HZ_A) * a;
      this.camPos.y += Math.sin(t * SHAKE_HZ_B) * a * 0.6;
      this.camPos.z += Math.sin(t * SHAKE_HZ_C) * a;
    }

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.smoothedLook);
  }
}
