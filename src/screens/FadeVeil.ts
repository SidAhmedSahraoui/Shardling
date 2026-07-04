import { tuning } from "../config/tuning";
import { el } from "../ui/dom";
import { injectStyles, removeStyles, uiClass } from "../ui/theme";

export interface FadeVeilOptions {
  root: HTMLElement;
  reduceMotion?: () => boolean;
}

export class FadeVeil {
  private readonly el: HTMLDivElement;
  private readonly reduceMotion: () => boolean;
  private readonly timeouts = new Set<number>();

  private inFlight: Promise<void> | null = null;
  private pendingResolve: (() => void) | null = null;
  private destroyed = false;

  constructor(opts: FadeVeilOptions) {
    injectStyles();
    this.reduceMotion = opts.reduceMotion ?? ((): boolean => false);
    this.el = el("div", uiClass.veil);
    this.el.style.setProperty("--sg-veil-fade", `${tuning.deathFadeMs}ms`);
    opts.root.appendChild(this.el);
  }

  deathFade(): Promise<void> {
    if (this.destroyed || this.isInstant()) {
      return Promise.resolve();
    }
    if (this.inFlight !== null && this.pendingResolve !== null) {
      return this.inFlight;
    }
    for (const id of this.timeouts) {
      window.clearTimeout(id);
    }
    this.timeouts.clear();
    this.inFlight = new Promise<void>((resolve) => {
      this.pendingResolve = resolve;
      void this.el.offsetWidth;
      this.el.classList.add(uiClass.veilOpaque);
      this.schedule(() => {
        this.pendingResolve = null;
        resolve();
        this.schedule(() => {
          this.el.classList.remove(uiClass.veilOpaque);
          this.schedule(() => {
            this.inFlight = null;
          }, tuning.deathFadeMs);
        }, tuning.deathHoldMs);
      }, tuning.deathFadeMs);
    });
    return this.inFlight;
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    for (const id of this.timeouts) {
      window.clearTimeout(id);
    }
    this.timeouts.clear();
    this.pendingResolve?.();
    this.pendingResolve = null;
    this.inFlight = null;
    this.el.remove();
    removeStyles();
  }

  private isInstant(): boolean {
    return (
      this.reduceMotion() ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  private schedule(fn: () => void, ms: number): void {
    const id = window.setTimeout(() => {
      this.timeouts.delete(id);
      fn();
    }, ms);
    this.timeouts.add(id);
  }
}
