import { tuning } from "../config/tuning";
import { injectStyles, removeStyles, uiClass } from "../ui/theme";

export interface Screen {
  readonly el: HTMLElement;
  onShow?(): void;
  deactivate?(): void;
  destroy(): void;
}

export interface ScreenManagerOptions {
  fadeMs?: number;
  reduceMotion: () => boolean;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export class ScreenManager {
  private readonly layer: HTMLDivElement;
  private readonly root: HTMLElement;
  private readonly rootPreviousInlinePosition: string;
  private readonly fadeMs: number;
  private readonly reduceMotion: () => boolean;

  private currentScreen: Screen | null = null;
  private queue: Promise<void> = Promise.resolve();
  private pendingTransitions = 0;
  private destroyed = false;

  constructor(root: HTMLElement, opts: ScreenManagerOptions) {
    this.root = root;
    this.fadeMs = opts.fadeMs ?? tuning.uiFadeMs;
    this.reduceMotion = opts.reduceMotion;

    injectStyles();

    this.rootPreviousInlinePosition = root.style.position;
    if (getComputedStyle(root).position === "static") {
      root.style.position = "relative";
    }

    this.layer = document.createElement("div");
    this.layer.className = uiClass.layer;
    this.layer.style.setProperty("--sg-fade", `${this.fadeMs}ms`);
    root.appendChild(this.layer);
  }

  get current(): Screen | null {
    return this.currentScreen;
  }

  get busy(): boolean {
    return this.pendingTransitions > 0;
  }

  show(screen: Screen | null): Promise<void> {
    this.pendingTransitions += 1;
    const run = this.queue.then(() => this.transitionTo(screen));
    this.queue = run
      .catch(() => undefined)
      .then(() => {
        this.pendingTransitions -= 1;
      });
    return run;
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    if (this.currentScreen !== null) {
      this.currentScreen.destroy();
      this.currentScreen.el.remove();
      this.currentScreen = null;
    }
    this.layer.remove();
    this.root.style.position = this.rootPreviousInlinePosition;
    removeStyles();
  }

  private async transitionTo(next: Screen | null): Promise<void> {
    if (this.destroyed) {
      next?.destroy();
      return;
    }
    if (next === this.currentScreen) {
      return;
    }

    const instant = this.reduceMotion() || this.fadeMs <= 0;
    this.layer.classList.toggle(uiClass.layerReduce, instant);

    const previous = this.currentScreen;
    this.currentScreen = null;
    if (previous !== null) {
      previous.deactivate?.();
      previous.el.style.pointerEvents = "none";
      previous.el.classList.remove(uiClass.screenVisible);
      if (!instant) {
        await wait(this.fadeMs);
      }
      previous.destroy();
      previous.el.remove();
    }

    if (this.destroyed) {
      next?.destroy();
      return;
    }
    if (next === null) {
      return;
    }

    this.currentScreen = next;
    next.el.classList.add(uiClass.screen);
    this.layer.appendChild(next.el);
    void next.el.offsetWidth;
    next.el.classList.add(uiClass.screenVisible);
    next.onShow?.();
    if (!instant) {
      await wait(this.fadeMs);
    }
  }
}
