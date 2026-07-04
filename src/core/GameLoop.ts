import { tuning } from "../config/tuning";

export interface LoopHooks {
  step(dt: number): void;
  render(alpha: number, frameDt: number): void;
}

export class GameLoop {
  private accumulator = 0;
  private last: number | undefined;
  private rafId = 0;
  private running = false;

  constructor(private readonly hooks: LoopHooks) {}

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.last = undefined;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private readonly frame = (now: number): void => {
    if (!this.running) {
      return;
    }
    const fixedDt = 1 / tuning.physicsHz;
    const frameDt =
      this.last === undefined
        ? fixedDt
        : Math.min((now - this.last) / 1000, tuning.maxFrameSec);
    this.last = now;

    this.accumulator += frameDt;
    while (this.accumulator >= fixedDt) {
      this.hooks.step(fixedDt);
      this.accumulator -= fixedDt;
    }

    this.hooks.render(this.accumulator / fixedDt, frameDt);
    this.rafId = requestAnimationFrame(this.frame);
  };
}
