import type { GUI } from "lil-gui";

import type { Tuning } from "../config/tuning";
import { tuning } from "../config/tuning";
import { strings } from "../ui/strings";

interface SliderSpec {
  readonly key: keyof Tuning;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

const MOVEMENT_SLIDERS: readonly SliderSpec[] = [
  { key: "moveForce", min: 0, max: 80, step: 0.5 },
  { key: "airControlMult", min: 0, max: 1, step: 0.01 },
  { key: "maxSpeedXZ", min: 1, max: 20, step: 0.1 },
  { key: "jumpVelocity", min: 2, max: 24, step: 0.1 },
  { key: "doubleJumpMult", min: 0, max: 1.5, step: 0.01 },
  { key: "jumpCutMult", min: 0, max: 1, step: 0.01 },
  { key: "coyoteMs", min: 0, max: 300, step: 5 },
  { key: "jumpBufferMs", min: 0, max: 300, step: 5 },
];

const CAMERA_SLIDERS: readonly SliderSpec[] = [
  {
    key: "camDistance",
    min: tuning.camDistanceMin,
    max: tuning.camDistanceMax,
    step: 0.1,
  },
  { key: "camPitchDeg", min: -60, max: -5, step: 1 },
  { key: "camFollowLerp", min: 0.01, max: 0.4, step: 0.005 },
  { key: "camLookAheadMax", min: 0, max: 4, step: 0.05 },
  { key: "camKeyYawRadPerSec", min: 0.5, max: 6, step: 0.05 },
];

const POSTFX_SLIDERS: readonly SliderSpec[] = [
  { key: "bloomIntensity", min: 0, max: 3, step: 0.05 },
  { key: "bloomLuminanceThreshold", min: 0, max: 1, step: 0.01 },
  { key: "bloomLuminanceSmoothing", min: 0, max: 1, step: 0.01 },
  { key: "vignetteOffset", min: 0, max: 1, step: 0.01 },
  { key: "vignetteDarkness", min: 0, max: 1, step: 0.01 },
];

const ALL_SLIDERS: readonly SliderSpec[] = [
  ...MOVEMENT_SLIDERS,
  ...CAMERA_SLIDERS,
  ...POSTFX_SLIDERS,
];

function formatValue(value: number): string {
  return String(Number(value.toFixed(4)));
}

function buildSnippet(): string {
  const lines: string[] = ["// tuning.ts — debug-panel snapshot (§5.4)"];
  for (const spec of ALL_SLIDERS) {
    lines.push(`  ${spec.key}: ${formatValue(tuning[spec.key])},`);
  }
  return lines.join("\n");
}

const COPY_ACTION = {
  copyAsCode(): void {
    const snippet = buildSnippet();
    console.log(snippet);
    if ("clipboard" in navigator) {
      navigator.clipboard.writeText(snippet).catch(() => undefined);
    }
  },
};

export class TuningPanel {
  private gui: GUI | null = null;
  private destroyed = false;

  private constructor() {}

  static begin(): TuningPanel {
    const panel = new TuningPanel();
    void panel.load().catch((error: unknown) => {
      console.warn("[debug] lil-gui failed to load:", error);
    });
    return panel;
  }

  destroy(): void {
    this.destroyed = true;
    if (this.gui !== null) {
      this.gui.destroy();
      this.gui = null;
    }
  }

  private async load(): Promise<void> {
    const { default: GuiCtor } = await import("lil-gui");
    if (this.destroyed) {
      return;
    }
    const gui = new GuiCtor({ title: strings.debug.panelTitle });
    this.gui = gui;
    this.addFolder(gui, strings.debug.folderMovement, MOVEMENT_SLIDERS);
    this.addFolder(gui, strings.debug.folderCamera, CAMERA_SLIDERS);
    this.addFolder(gui, strings.debug.folderPostFx, POSTFX_SLIDERS).close();
    gui.add(COPY_ACTION, "copyAsCode").name(strings.debug.copyAsCode);
  }

  private addFolder(
    gui: GUI,
    title: string,
    sliders: readonly SliderSpec[],
  ): GUI {
    const folder = gui.addFolder(title);
    for (const spec of sliders) {
      folder.add(tuning, spec.key, spec.min, spec.max, spec.step);
    }
    return folder;
  }
}
