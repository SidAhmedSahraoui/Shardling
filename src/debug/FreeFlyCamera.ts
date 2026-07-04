import type { PerspectiveCamera } from "three";
import { Euler, Vector3 } from "three";

import { isTextEntryTarget } from "./domGuards";

const FLY_SPEED_UNITS_PER_SEC = 10;
const FLY_FAST_MULT = 3;
const FLY_LOOK_RAD_PER_PX = 0.0045;
const PITCH_LIMIT_RAD = Math.PI / 2 - 0.01;

const WORLD_UP = new Vector3(0, 1, 0);

interface FlyHeld {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

type FlyAction = keyof FlyHeld;

function actionForCode(code: string): FlyAction | undefined {
  switch (code) {
    case "KeyW":
      return "forward";
    case "KeyS":
      return "back";
    case "KeyA":
      return "left";
    case "KeyD":
      return "right";
    case "KeyE":
      return "up";
    case "KeyQ":
      return "down";
    default:
      return undefined;
  }
}

export class FreeFlyCamera {
  private readonly camera: PerspectiveCamera;
  private readonly canvas: HTMLElement;

  private active = false;
  private yaw = 0;
  private pitch = 0;
  private fast = false;
  private readonly held: FlyHeld = {
    forward: false,
    back: false,
    left: false,
    right: false,
    up: false,
    down: false,
  };

  private dragPointerId: number | null = null;
  private dragLastX = 0;
  private dragLastY = 0;

  private readonly forwardScratch = new Vector3();
  private readonly rightScratch = new Vector3();
  private readonly eulerScratch = new Euler(0, 0, 0, "YXZ");

  constructor(camera: PerspectiveCamera, canvas: HTMLElement) {
    this.camera = camera;
    this.canvas = canvas;
  }

  get isActive(): boolean {
    return this.active;
  }

  toggle(): void {
    if (this.active) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  update(frameDtSec: number): void {
    if (!this.active) {
      return;
    }
    const forwardAxis = (this.held.forward ? 1 : 0) - (this.held.back ? 1 : 0);
    const rightAxis = (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0);
    const upAxis = (this.held.up ? 1 : 0) - (this.held.down ? 1 : 0);
    if (forwardAxis === 0 && rightAxis === 0 && upAxis === 0) {
      return;
    }
    this.camera.getWorldDirection(this.forwardScratch);
    this.rightScratch.crossVectors(this.forwardScratch, WORLD_UP).normalize();
    const step =
      FLY_SPEED_UNITS_PER_SEC * (this.fast ? FLY_FAST_MULT : 1) * frameDtSec;
    this.camera.position.addScaledVector(
      this.forwardScratch,
      forwardAxis * step,
    );
    this.camera.position.addScaledVector(this.rightScratch, rightAxis * step);
    this.camera.position.y += upAxis * step;
  }

  destroy(): void {
    this.deactivate();
  }

  private activate(): void {
    if (this.active) {
      return;
    }
    this.active = true;
    this.eulerScratch.setFromQuaternion(this.camera.quaternion);
    this.pitch = Math.max(
      -PITCH_LIMIT_RAD,
      Math.min(PITCH_LIMIT_RAD, this.eulerScratch.x),
    );
    this.yaw = this.eulerScratch.y;
    this.applyOrientation();
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onFocusLost);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
  }

  private deactivate(): void {
    if (!this.active) {
      return;
    }
    this.active = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onFocusLost);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.endDrag();
    this.clearHeld();
  }

  private applyOrientation(): void {
    this.eulerScratch.set(this.pitch, this.yaw, 0);
    this.camera.quaternion.setFromEuler(this.eulerScratch);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (isTextEntryTarget(event.target)) {
      return;
    }
    this.fast = event.shiftKey;
    const action = actionForCode(event.code);
    if (action !== undefined) {
      this.held[action] = true;
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.fast = event.shiftKey;
    const action = actionForCode(event.code);
    if (action !== undefined) {
      this.held[action] = false;
    }
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.dragPointerId !== null) {
      return;
    }
    this.dragPointerId = event.pointerId;
    this.dragLastX = event.clientX;
    this.dragLastY = event.clientY;
    this.canvas.setPointerCapture(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.dragPointerId) {
      return;
    }
    if ((event.buttons & 1) === 0) {
      this.endDrag();
      return;
    }
    const dx = event.clientX - this.dragLastX;
    const dy = event.clientY - this.dragLastY;
    this.dragLastX = event.clientX;
    this.dragLastY = event.clientY;
    this.yaw -= dx * FLY_LOOK_RAD_PER_PX;
    this.pitch = Math.max(
      -PITCH_LIMIT_RAD,
      Math.min(PITCH_LIMIT_RAD, this.pitch - dy * FLY_LOOK_RAD_PER_PX),
    );
    this.applyOrientation();
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId === this.dragPointerId) {
      this.endDrag();
    }
  };

  private readonly onFocusLost = (): void => {
    this.endDrag();
    this.clearHeld();
  };

  private endDrag(): void {
    if (
      this.dragPointerId !== null &&
      this.canvas.hasPointerCapture(this.dragPointerId)
    ) {
      this.canvas.releasePointerCapture(this.dragPointerId);
    }
    this.dragPointerId = null;
  }

  private clearHeld(): void {
    this.held.forward = false;
    this.held.back = false;
    this.held.left = false;
    this.held.right = false;
    this.held.up = false;
    this.held.down = false;
    this.fast = false;
  }
}
