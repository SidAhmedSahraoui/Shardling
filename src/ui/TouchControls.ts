import { palette } from "../config/palette";
import { tuning } from "../config/tuning";
import type { Vec2 } from "../core/cameraRelative";
import type { InputManager, TouchInputSource } from "../core/InputManager";
import { clampNubOffset, stickVecFromOffset } from "../core/touchMath";
import { strings } from "./strings";
import { cssColor, cssColorAlpha } from "./theme";

const LAYER_Z_INDEX = 6;

const STICK_HIT_PAD_PX = 28;

const NUB_SCALE = 0.42;

const EDGE_PAD_PX = 24;

const PRESSED_OPACITY = "0.9";
const IDLE_OPACITY = "0.55";

export interface TouchControlsOptions {
  root: HTMLElement;
  input: InputManager;
}

export class TouchControls implements TouchInputSource {
  private readonly input: InputManager;
  private readonly root: HTMLDivElement;
  private readonly stickHit: HTMLDivElement;
  private readonly base: HTMLDivElement;
  private readonly nub: HTMLDivElement;
  private readonly jump: HTMLDivElement;

  private active = false;
  private wantVisible = false;
  private touchCapable: boolean;

  private stickPointerId: number | null = null;
  private stickCenterX = 0;
  private stickCenterY = 0;
  private stickLastDx = 0;
  private stickLastDy = 0;
  private readonly jumpPointers = new Set<number>();

  private readonly moveScratch: Vec2 = { x: 0, y: 0 };
  private readonly nubScratch: Vec2 = { x: 0, y: 0 };

  private disposed = false;

  constructor(opts: TouchControlsOptions) {
    this.input = opts.input;
    this.touchCapable =
      globalThis.matchMedia?.("(pointer: coarse)").matches ?? false;

    const baseDiameter = tuning.touchStickRadiusPx * 2;
    const hitSize = baseDiameter + STICK_HIT_PAD_PX * 2;
    const nubSize = Math.round(baseDiameter * NUB_SCALE);
    const rim = cssColorAlpha(palette.eye, 0.5);
    const fill = cssColorAlpha(palette.bg1, 0.45);

    this.root = document.createElement("div");
    this.root.style.cssText = `
      position: absolute; inset: 0; z-index: ${LAYER_Z_INDEX};
      pointer-events: none; display: none;
      -webkit-tap-highlight-color: transparent; user-select: none;
      -webkit-user-select: none;`;

    this.stickHit = document.createElement("div");
    this.stickHit.setAttribute("aria-label", strings.touch.move);
    this.stickHit.style.cssText = `
      position: absolute;
      left: calc(${EDGE_PAD_PX - STICK_HIT_PAD_PX}px + env(safe-area-inset-left, 0px));
      bottom: calc(${EDGE_PAD_PX - STICK_HIT_PAD_PX}px + env(safe-area-inset-bottom, 0px));
      width: ${hitSize}px; height: ${hitSize}px;
      pointer-events: auto; touch-action: none;`;
    this.base = document.createElement("div");
    const base = this.base;
    base.style.cssText = `
      position: absolute; left: ${STICK_HIT_PAD_PX}px; top: ${STICK_HIT_PAD_PX}px;
      width: ${baseDiameter}px; height: ${baseDiameter}px;
      border-radius: 50%; box-sizing: border-box;
      border: 2px solid ${rim}; background: ${fill};
      opacity: ${IDLE_OPACITY};`;
    this.nub = document.createElement("div");
    this.nub.style.cssText = `
      position: absolute;
      left: ${(baseDiameter - nubSize) / 2}px; top: ${(baseDiameter - nubSize) / 2}px;
      width: ${nubSize}px; height: ${nubSize}px;
      border-radius: 50%;
      background: ${cssColorAlpha(palette.eye, 0.75)};
      box-shadow: 0 0 10px ${cssColorAlpha(palette.eye, 0.35)};`;
    base.appendChild(this.nub);
    this.stickHit.appendChild(base);

    this.jump = document.createElement("div");
    this.jump.setAttribute("role", "button");
    this.jump.setAttribute("aria-label", strings.touch.jump);
    this.jump.style.cssText = `
      position: absolute;
      right: calc(${EDGE_PAD_PX}px + env(safe-area-inset-right, 0px));
      bottom: calc(${EDGE_PAD_PX}px + env(safe-area-inset-bottom, 0px));
      width: ${tuning.touchJumpSizePx}px; height: ${tuning.touchJumpSizePx}px;
      border-radius: 50%; box-sizing: border-box;
      border: 2px solid ${rim}; background: ${fill};
      opacity: ${IDLE_OPACITY};
      pointer-events: auto; touch-action: none;
      display: flex; align-items: center; justify-content: center;`;
    const chevron = document.createElement("div");
    chevron.style.cssText = `
      width: ${Math.round(tuning.touchJumpSizePx * 0.3)}px;
      height: ${Math.round(tuning.touchJumpSizePx * 0.3)}px;
      border-top: 4px solid ${cssColor(palette.eye)};
      border-right: 4px solid ${cssColor(palette.eye)};
      transform: translateY(20%) rotate(-45deg);`;
    this.jump.appendChild(chevron);

    this.root.append(this.stickHit, this.jump);
    opts.root.appendChild(this.root);

    this.stickHit.addEventListener("pointerdown", this.onStickDown);
    this.stickHit.addEventListener("pointermove", this.onStickMove);
    this.stickHit.addEventListener("pointerup", this.onStickUp);
    this.stickHit.addEventListener("pointercancel", this.onStickUp);
    this.jump.addEventListener("pointerdown", this.onJumpDown);
    this.jump.addEventListener("pointerup", this.onJumpUp);
    this.jump.addEventListener("pointercancel", this.onJumpUp);
    this.root.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("pointerdown", this.onFirstTouch);
  }

  show(): void {
    this.wantVisible = true;
    this.applyVisibility();
  }

  hide(): void {
    this.wantVisible = false;
    this.applyVisibility();
    this.resetStick();
    this.resetJump();
  }

  setActive(active: boolean): void {
    this.active = active;
    if (!active) {
      return;
    }
    if (this.stickPointerId !== null) {
      this.pushStick(this.stickLastDx, this.stickLastDy);
    }
    if (this.jumpPointers.size > 0) {
      this.input.setTouchJumpHeld(true);
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.active = false;
    this.resetStick();
    this.resetJump();
    window.removeEventListener("pointerdown", this.onFirstTouch);
    this.stickHit.removeEventListener("pointerdown", this.onStickDown);
    this.stickHit.removeEventListener("pointermove", this.onStickMove);
    this.stickHit.removeEventListener("pointerup", this.onStickUp);
    this.stickHit.removeEventListener("pointercancel", this.onStickUp);
    this.jump.removeEventListener("pointerdown", this.onJumpDown);
    this.jump.removeEventListener("pointerup", this.onJumpUp);
    this.jump.removeEventListener("pointercancel", this.onJumpUp);
    this.root.removeEventListener("contextmenu", this.onContextMenu);
    this.root.remove();
  }

  private readonly onContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  private applyVisibility(): void {
    this.root.style.display =
      this.wantVisible && this.touchCapable ? "block" : "none";
  }

  private readonly onFirstTouch = (event: PointerEvent): void => {
    if (event.pointerType !== "touch") {
      return;
    }
    this.touchCapable = true;
    this.applyVisibility();
    window.removeEventListener("pointerdown", this.onFirstTouch);
  };

  private readonly onStickDown = (event: PointerEvent): void => {
    if (this.stickPointerId !== null) {
      return;
    }
    event.preventDefault();
    this.stickPointerId = event.pointerId;
    const rect = this.stickHit.getBoundingClientRect();
    this.stickCenterX = rect.left + rect.width / 2;
    this.stickCenterY = rect.top + rect.height / 2;
    this.stickHit.setPointerCapture(event.pointerId);
    this.base.style.opacity = PRESSED_OPACITY;
    this.trackStick(event);
  };

  private readonly onStickMove = (event: PointerEvent): void => {
    if (event.pointerId === this.stickPointerId) {
      this.trackStick(event);
    }
  };

  private readonly onStickUp = (event: PointerEvent): void => {
    if (event.pointerId === this.stickPointerId) {
      this.resetStick();
    }
  };

  private trackStick(event: PointerEvent): void {
    this.stickLastDx = event.clientX - this.stickCenterX;
    this.stickLastDy = event.clientY - this.stickCenterY;
    this.pushStick(this.stickLastDx, this.stickLastDy);
    const nub = clampNubOffset(
      this.stickLastDx,
      this.stickLastDy,
      tuning.touchStickRadiusPx,
      this.nubScratch,
    );
    this.nub.style.transform = `translate(${nub.x}px, ${nub.y}px)`;
  }

  private pushStick(dxPx: number, dyPx: number): void {
    if (!this.active) {
      return;
    }
    const move = stickVecFromOffset(
      dxPx,
      dyPx,
      tuning.touchStickRadiusPx,
      tuning.touchStickDeadZonePx,
      this.moveScratch,
    );
    this.input.setTouchMove(move.x, move.y);
  }

  private resetStick(): void {
    if (this.stickPointerId !== null) {
      if (this.stickHit.hasPointerCapture(this.stickPointerId)) {
        this.stickHit.releasePointerCapture(this.stickPointerId);
      }
      this.stickPointerId = null;
    }
    this.stickLastDx = 0;
    this.stickLastDy = 0;
    this.input.setTouchMove(0, 0);
    this.nub.style.transform = "translate(0px, 0px)";
    this.base.style.opacity = IDLE_OPACITY;
  }

  private readonly onJumpDown = (event: PointerEvent): void => {
    if (this.jumpPointers.has(event.pointerId)) {
      return;
    }
    event.preventDefault();
    this.jumpPointers.add(event.pointerId);
    this.jump.setPointerCapture(event.pointerId);
    this.jump.style.opacity = PRESSED_OPACITY;
    if (this.active) {
      this.input.pressTouchJump();
    }
  };

  private readonly onJumpUp = (event: PointerEvent): void => {
    if (!this.jumpPointers.has(event.pointerId)) {
      return;
    }
    this.jumpPointers.delete(event.pointerId);
    if (this.jump.hasPointerCapture(event.pointerId)) {
      this.jump.releasePointerCapture(event.pointerId);
    }
    if (this.jumpPointers.size === 0) {
      this.input.releaseTouchJump();
      this.jump.style.opacity = IDLE_OPACITY;
    }
  };

  private resetJump(): void {
    for (const id of this.jumpPointers) {
      if (this.jump.hasPointerCapture(id)) {
        this.jump.releasePointerCapture(id);
      }
    }
    this.jumpPointers.clear();
    this.input.releaseTouchJump();
    this.jump.style.opacity = IDLE_OPACITY;
  }
}
