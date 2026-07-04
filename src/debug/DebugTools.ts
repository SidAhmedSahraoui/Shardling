import type { World } from "@dimforge/rapier3d-compat";

import type { App } from "../core/App";
import { strings } from "../ui/strings";
import { DebugHud } from "./DebugHud";
import { isTextEntryTarget } from "./domGuards";
import { FreeFlyCamera } from "./FreeFlyCamera";
import { RapierDebugLines } from "./RapierDebugLines";
import { TuningPanel } from "./TuningPanel";

const HUD_REFRESH_SEC = 0.25;

export interface DebugToolsOptions {
  app: App;
  getWorld: () => World | null;
  getStatus: () => { state: string; bodies: number } | null;
}

export class DebugTools {
  private readonly hud: DebugHud;
  private readonly lines: RapierDebugLines;
  private readonly freeFly: FreeFlyCamera;
  private readonly panel: TuningPanel;

  private frames = 0;
  private elapsed = 0;
  private lastDrawCalls = 0;
  private lastTriangles = 0;

  private constructor(private readonly opts: DebugToolsOptions) {
    this.hud = new DebugHud();
    this.lines = new RapierDebugLines(opts.app.scene);
    this.freeFly = new FreeFlyCamera(
      opts.app.camera,
      opts.app.renderer.domElement,
    );
    this.panel = TuningPanel.begin();

    opts.app.renderer.info.autoReset = false;

    window.addEventListener("keydown", this.onKeyDown);
  }

  static create(opts: DebugToolsOptions): DebugTools {
    return new DebugTools(opts);
  }

  get freeFlyActive(): boolean {
    return this.freeFly.isActive;
  }

  update(frameDtSec: number): void {
    this.freeFly.update(frameDtSec);

    const world = this.opts.getWorld();
    this.lines.update(world);

    const info = this.opts.app.renderer.info;
    this.lastDrawCalls = info.render.calls;
    this.lastTriangles = info.render.triangles;
    info.reset();

    this.frames += 1;
    this.elapsed += frameDtSec;
    if (this.elapsed < HUD_REFRESH_SEC) {
      return;
    }
    const fps = this.frames / this.elapsed;
    this.frames = 0;
    this.elapsed = 0;

    const status = this.opts.getStatus();
    this.hud.refresh(
      fps,
      this.lastDrawCalls,
      this.lastTriangles,
      status !== null ? status.bodies : world !== null ? world.bodies.len() : 0,
      info.memory.geometries,
      status !== null ? status.state : strings.debug.hudNone,
      this.freeFly.isActive,
    );
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    this.freeFly.destroy();
    this.lines.destroy();
    this.panel.destroy();
    this.hud.destroy();
    const info = this.opts.app.renderer.info;
    info.autoReset = true;
    info.reset();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (
      event.code !== "KeyF" ||
      event.repeat ||
      isTextEntryTarget(event.target)
    ) {
      return;
    }
    this.freeFly.toggle();
  };
}
