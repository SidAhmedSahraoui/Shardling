import { tuning } from "../config/tuning";
import type { Vec2, VecXZ } from "./cameraRelative";
import { cameraRelativeMoveVec, forwardXZFromYaw } from "./cameraRelative";

export interface InputSnapshot {
  moveVec: { x: number; z: number };
  jumpPressed: boolean;
  jumpHeld: boolean;
  camYawDelta: number;
  zoomDelta: number;
  restartPressed: boolean;
}

export interface TouchInputSource {
  setActive(active: boolean): void;
}

export interface InputManagerOptions {
  target: HTMLElement;
  getYaw: () => number;
  getSensitivity?: () => number;
}

interface HeldActions {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  yawCcw: boolean;
  yawCw: boolean;
  jump: boolean;
  restart: boolean;
}

type HeldAction = keyof HeldActions;

function actionForCode(code: string): HeldAction | undefined {
  switch (code) {
    case "KeyW":
    case "ArrowUp":
      return "forward";
    case "KeyS":
    case "ArrowDown":
      return "back";
    case "KeyA":
    case "ArrowLeft":
      return "left";
    case "KeyD":
    case "ArrowRight":
      return "right";
    case "KeyQ":
      return "yawCcw";
    case "KeyE":
      return "yawCw";
    case "Space":
      return "jump";
    case "KeyR":
      return "restart";
    default:
      return undefined;
  }
}

const PREVENT_DEFAULT_CODES = new Set([
  "Space",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

export class InputManager {
  private readonly target: HTMLElement;
  private readonly getYaw: () => number;
  private readonly getSensitivity: () => number;

  private enabled = false;
  private destroyed = false;

  private readonly held: HeldActions = {
    forward: false,
    back: false,
    left: false,
    right: false,
    yawCcw: false,
    yawCw: false,
    jump: false,
    restart: false,
  };
  private jumpLatched = false;
  private restartLatched = false;

  private dragPointerId: number | null = null;
  private dragLastX = 0;
  private dragYawAccum = 0;
  private zoomAccum = 0;

  private readonly touchDragA = { id: -1, x: 0, y: 0 };
  private readonly touchDragB = { id: -1, x: 0, y: 0 };

  private touchSource: TouchInputSource | null = null;
  private readonly touchMove: Vec2 = { x: 0, y: 0 };
  private touchJumpHeld = false;

  private readonly inputScratch: Vec2 = { x: 0, y: 0 };
  private readonly forwardScratch: VecXZ = { x: 0, z: -1 };
  private readonly snapshot: InputSnapshot = {
    moveVec: { x: 0, z: 0 },
    jumpPressed: false,
    jumpHeld: false,
    camYawDelta: 0,
    zoomDelta: 0,
    restartPressed: false,
  };

  constructor(opts: InputManagerOptions) {
    this.target = opts.target;
    this.getYaw = opts.getYaw;
    this.getSensitivity = opts.getSensitivity ?? (() => 1);
  }

  attachTouchSource(source: TouchInputSource): void {
    this.touchSource = source;
    source.setActive(this.enabled);
  }

  setTouchMove(x: number, y: number): void {
    if (!this.enabled) {
      return;
    }
    this.touchMove.x = x;
    this.touchMove.y = y;
  }

  pressTouchJump(): void {
    if (!this.enabled) {
      return;
    }
    this.jumpLatched = true;
    this.touchJumpHeld = true;
  }

  releaseTouchJump(): void {
    this.touchJumpHeld = false;
  }

  setTouchJumpHeld(held: boolean): void {
    if (held && !this.enabled) {
      return;
    }
    this.touchJumpHeld = held;
  }

  enable(): void {
    if (this.enabled || this.destroyed) {
      return;
    }
    this.enabled = true;
    this.touchSource?.setActive(true);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.target.addEventListener("pointerdown", this.onPointerDown);
    this.target.addEventListener("pointermove", this.onPointerMove);
    this.target.addEventListener("pointerup", this.onPointerUp);
    this.target.addEventListener("pointercancel", this.onPointerUp);
    this.target.addEventListener("wheel", this.onWheel, { passive: false });
    this.target.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("blur", this.onFocusLost);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  disable(): void {
    if (!this.enabled) {
      return;
    }
    this.enabled = false;
    this.touchSource?.setActive(false);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.target.removeEventListener("pointerdown", this.onPointerDown);
    this.target.removeEventListener("pointermove", this.onPointerMove);
    this.target.removeEventListener("pointerup", this.onPointerUp);
    this.target.removeEventListener("pointercancel", this.onPointerUp);
    this.target.removeEventListener("wheel", this.onWheel);
    this.target.removeEventListener("contextmenu", this.onContextMenu);
    window.removeEventListener("blur", this.onFocusLost);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.endDrag();
    this.clearState();
  }

  destroy(): void {
    this.disable();
    this.destroyed = true;
  }

  sample(dtSec: number): InputSnapshot {
    const snap = this.snapshot;

    this.inputScratch.x =
      (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0) + this.touchMove.x;
    this.inputScratch.y =
      (this.held.forward ? 1 : 0) - (this.held.back ? 1 : 0) + this.touchMove.y;
    forwardXZFromYaw(this.getYaw(), this.forwardScratch);
    cameraRelativeMoveVec(this.inputScratch, this.forwardScratch, snap.moveVec);

    snap.jumpPressed = this.jumpLatched;
    this.jumpLatched = false;
    snap.jumpHeld = this.held.jump || this.touchJumpHeld;
    snap.restartPressed = this.restartLatched;
    this.restartLatched = false;

    const keyYawDir = (this.held.yawCcw ? 1 : 0) - (this.held.yawCw ? 1 : 0);
    snap.camYawDelta =
      (keyYawDir * tuning.camKeyYawRadPerSec * dtSec + this.dragYawAccum) *
      this.getSensitivity();
    this.dragYawAccum = 0;

    snap.zoomDelta = this.zoomAccum;
    this.zoomAccum = 0;

    return snap;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (PREVENT_DEFAULT_CODES.has(event.code)) {
      event.preventDefault();
    }
    const action = actionForCode(event.code);
    if (action === undefined) {
      return;
    }
    if (action === "jump" && !event.repeat && !this.held.jump) {
      this.jumpLatched = true;
    }
    if (action === "restart" && !event.repeat && !this.held.restart) {
      this.restartLatched = true;
    }
    this.held[action] = true;
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const action = actionForCode(event.code);
    if (action !== undefined) {
      this.held[action] = false;
    }
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === "touch") {
      this.onTouchDown(event);
      return;
    }
    if (event.button !== 0 || this.dragPointerId !== null) {
      return;
    }
    this.dragPointerId = event.pointerId;
    this.dragLastX = event.clientX;
    this.target.setPointerCapture(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType === "touch") {
      this.onTouchMove(event);
      return;
    }
    if (event.pointerId !== this.dragPointerId) {
      return;
    }
    if ((event.buttons & 1) === 0) {
      this.endDrag();
      return;
    }
    const dx = event.clientX - this.dragLastX;
    this.dragLastX = event.clientX;
    this.dragYawAccum -= dx * tuning.camDragYawRadPerPx;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerType === "touch") {
      this.releaseTouchSlot(event.pointerId);
      return;
    }
    if (event.pointerId === this.dragPointerId) {
      this.endDrag();
    }
  };

  private onTouchDown(event: PointerEvent): void {
    const rect = this.target.getBoundingClientRect();
    if (event.clientX < rect.left + rect.width / 2) {
      return;
    }
    const slot =
      this.touchDragA.id === -1
        ? this.touchDragA
        : this.touchDragB.id === -1
          ? this.touchDragB
          : null;
    if (!slot) {
      return;
    }
    slot.id = event.pointerId;
    slot.x = event.clientX;
    slot.y = event.clientY;
    this.target.setPointerCapture(event.pointerId);
  }

  private onTouchMove(event: PointerEvent): void {
    const { touchDragA: a, touchDragB: b } = this;
    const slot =
      a.id === event.pointerId ? a : b.id === event.pointerId ? b : null;
    if (!slot) {
      return;
    }
    if (a.id !== -1 && b.id !== -1) {
      const prevDist = Math.hypot(a.x - b.x, a.y - b.y);
      slot.x = event.clientX;
      slot.y = event.clientY;
      const newDist = Math.hypot(a.x - b.x, a.y - b.y);
      this.zoomAccum -= (newDist - prevDist) * tuning.touchPinchZoomPerPx;
      return;
    }
    const dx = event.clientX - slot.x;
    slot.x = event.clientX;
    slot.y = event.clientY;
    this.dragYawAccum -= dx * tuning.camDragYawRadPerPx;
  }

  private releaseTouchSlot(pointerId: number): void {
    if (pointerId === -1) {
      return;
    }
    const slot =
      this.touchDragA.id === pointerId
        ? this.touchDragA
        : this.touchDragB.id === pointerId
          ? this.touchDragB
          : null;
    if (!slot) {
      return;
    }
    slot.id = -1;
    if (this.target.hasPointerCapture(pointerId)) {
      this.target.releasePointerCapture(pointerId);
    }
  }

  private readonly onFocusLost = (): void => {
    this.endDrag();
    this.clearState();
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      this.onFocusLost();
    }
  };

  private readonly onContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.zoomAccum += event.deltaY * tuning.camZoomPerWheelDelta;
  };

  private endDrag(): void {
    if (
      this.dragPointerId !== null &&
      this.target.hasPointerCapture(this.dragPointerId)
    ) {
      this.target.releasePointerCapture(this.dragPointerId);
    }
    this.dragPointerId = null;
  }

  private clearState(): void {
    this.held.forward = false;
    this.held.back = false;
    this.held.left = false;
    this.held.right = false;
    this.held.yawCcw = false;
    this.held.yawCw = false;
    this.held.jump = false;
    this.held.restart = false;
    this.jumpLatched = false;
    this.restartLatched = false;
    this.dragYawAccum = 0;
    this.zoomAccum = 0;
    this.releaseTouchSlot(this.touchDragA.id);
    this.releaseTouchSlot(this.touchDragB.id);
    this.touchMove.x = 0;
    this.touchMove.y = 0;
    this.touchJumpHeld = false;
  }
}
