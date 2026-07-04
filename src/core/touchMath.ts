import type { Vec2 } from "./cameraRelative";

export function stickVecFromOffset(
  dxPx: number,
  dyPx: number,
  radiusPx: number,
  deadZonePx: number,
  out: Vec2 = { x: 0, y: 0 },
): Vec2 {
  const dist = Math.hypot(dxPx, dyPx);
  if (dist <= deadZonePx || dist === 0) {
    out.x = 0;
    out.y = 0;
    return out;
  }
  const band = radiusPx - deadZonePx;
  const magnitude = band > 0 ? Math.min(1, (dist - deadZonePx) / band) : 1;
  const scale = magnitude / dist;
  out.x = dxPx * scale;
  out.y = -dyPx * scale;
  return out;
}

export function clampNubOffset(
  dxPx: number,
  dyPx: number,
  radiusPx: number,
  out: Vec2 = { x: 0, y: 0 },
): Vec2 {
  const dist = Math.hypot(dxPx, dyPx);
  if (dist <= radiusPx || dist === 0) {
    out.x = dxPx;
    out.y = dyPx;
    return out;
  }
  const scale = radiusPx / dist;
  out.x = dxPx * scale;
  out.y = dyPx * scale;
  return out;
}
