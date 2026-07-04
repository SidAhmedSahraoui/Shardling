import type { EventBus } from "../core/EventBus";

export interface LevelResult {
  timeMs: number;
  deaths: number;
}

export interface LevelRunnerOptions {
  bus: EventBus;
  levelId: string;
  shardTotal: number;
}

export class LevelRunner {
  private readonly bus: EventBus;
  private readonly levelId: string;
  private readonly total: number;

  private running = false;
  private paused = false;
  private done = false;
  private elapsedMs = 0;
  private deathCount = 0;
  private shardCount = 0;

  constructor(opts: LevelRunnerOptions) {
    this.bus = opts.bus;
    this.levelId = opts.levelId;
    this.total = opts.shardTotal;
  }

  start(): void {
    this.reset();
    this.running = true;
    this.bus.emit("level:loaded", { id: this.levelId });
  }

  tick(dtSec: number): void {
    if (!this.running || this.paused || this.done) {
      return;
    }
    this.elapsedMs += dtSec * 1000;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  restart(): void {
    this.start();
  }

  notifyShardCollected(): void {
    if (this.shardCount >= this.total) {
      return;
    }
    this.shardCount += 1;
    if (this.shardCount === this.total) {
      this.bus.emit("shards:complete");
    }
  }

  notifyDeath(cause: "hazard" | "fall"): void {
    this.deathCount += 1;
    this.bus.emit("player:died", { cause });
  }

  notifyShardsReset(): void {
    this.shardCount = 0;
  }

  notifyPortalEntered(): void {
    if (this.done || !this.allShardsCollected) {
      return;
    }
    this.done = true;
    this.bus.emit("level:complete", this.result());
  }

  get timeMs(): number {
    return this.elapsedMs;
  }

  get deaths(): number {
    return this.deathCount;
  }

  get shardsCollected(): number {
    return this.shardCount;
  }

  get shardTotal(): number {
    return this.total;
  }

  get allShardsCollected(): boolean {
    return this.shardCount >= this.total;
  }

  get completed(): boolean {
    return this.done;
  }

  destroy(): void {
    this.running = false;
  }

  private result(): LevelResult {
    return { timeMs: this.elapsedMs, deaths: this.deathCount };
  }

  private reset(): void {
    this.running = false;
    this.paused = false;
    this.done = false;
    this.elapsedMs = 0;
    this.deathCount = 0;
    this.shardCount = 0;
  }
}
