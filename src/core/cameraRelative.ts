export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface VecXZ {
  x: number;
  z: number;
}

const DEGENERATE_EPSILON = 1e-6;

export function forwardXZFromYaw(
  yawRad: number,
  out: VecXZ = { x: 0, z: 0 },
): VecXZ {
  out.x = -Math.sin(yawRad);
  out.z = -Math.cos(yawRad);
  return out;
}

export function projectForwardXZ(
  forward: Vec3,
  up: Vec3,
  out: VecXZ = { x: 0, z: 0 },
): VecXZ {
  let x = forward.x;
  let z = forward.z;
  let len = Math.hypot(x, z);
  if (len < DEGENERATE_EPSILON) {
    const sign = forward.y > 0 ? -1 : 1;
    x = up.x * sign;
    z = up.z * sign;
    len = Math.hypot(x, z);
    if (len < DEGENERATE_EPSILON) {
      out.x = 0;
      out.z = -1;
      return out;
    }
  }
  out.x = x / len;
  out.z = z / len;
  return out;
}

export function cameraRelativeMoveVec(
  input: Vec2,
  forwardXZ: VecXZ,
  out: VecXZ = { x: 0, z: 0 },
): VecXZ {
  const x = input.x * -forwardXZ.z + input.y * forwardXZ.x;
  const z = input.x * forwardXZ.x + input.y * forwardXZ.z;
  const len = Math.hypot(x, z);
  if (len < DEGENERATE_EPSILON) {
    out.x = 0;
    out.z = 0;
    return out;
  }
  out.x = x / len;
  out.z = z / len;
  return out;
}
