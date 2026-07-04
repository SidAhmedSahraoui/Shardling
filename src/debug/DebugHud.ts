import { lighting, palette } from "../config/palette";
import { el } from "../ui/dom";
import { strings } from "../ui/strings";
import { cssColor, cssColorAlpha, mixColors } from "../ui/theme";

const HUD_Z_INDEX = "20";
const HUD_MARGIN_PX = 8;
const HUD_FONT_SIZE_PX = 12;
const HUD_COLUMN_GAP_PX = 12;
const HUD_FONT_STACK = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

const LABEL_COLOR = cssColorAlpha(lighting.hemiSky, 0.55);
const VALUE_COLOR = cssColor(mixColors(lighting.hemiSky, palette.eye, 0.15));
const ACCENT_COLOR = cssColor(palette.eye);
const HUD_BACKGROUND = cssColorAlpha(palette.bg0, 0.75);
const HUD_BORDER = `1px solid ${cssColorAlpha(palette.eye, 0.25)}`;

export class DebugHud {
  private readonly root: HTMLDivElement;
  private readonly fpsValue: HTMLSpanElement;
  private readonly drawCallsValue: HTMLSpanElement;
  private readonly trianglesValue: HTMLSpanElement;
  private readonly bodiesValue: HTMLSpanElement;
  private readonly geometriesValue: HTMLSpanElement;
  private readonly stateValue: HTMLSpanElement;
  private readonly freeFlyValue: HTMLSpanElement;

  constructor() {
    const root = el("div");
    const style = root.style;
    style.position = "fixed";
    style.top = `${HUD_MARGIN_PX}px`;
    style.left = `${HUD_MARGIN_PX}px`;
    style.zIndex = HUD_Z_INDEX;
    style.pointerEvents = "none";
    style.userSelect = "none";
    style.display = "grid";
    style.gridTemplateColumns = "max-content max-content";
    style.columnGap = `${HUD_COLUMN_GAP_PX}px`;
    style.padding = "6px 10px";
    style.borderRadius = "8px";
    style.border = HUD_BORDER;
    style.background = HUD_BACKGROUND;
    style.fontFamily = HUD_FONT_STACK;
    style.fontSize = `${HUD_FONT_SIZE_PX}px`;
    style.lineHeight = "1.6";
    style.fontVariantNumeric = "tabular-nums";
    this.root = root;

    const hud = strings.debug;
    this.fpsValue = this.addRow(hud.hudFps, VALUE_COLOR);
    this.drawCallsValue = this.addRow(hud.hudDrawCalls, VALUE_COLOR);
    this.trianglesValue = this.addRow(hud.hudTriangles, VALUE_COLOR);
    this.bodiesValue = this.addRow(hud.hudBodies, VALUE_COLOR);
    this.geometriesValue = this.addRow(hud.hudGeometries, VALUE_COLOR);
    this.stateValue = this.addRow(hud.hudState, ACCENT_COLOR);
    this.freeFlyValue = this.addRow(hud.hudFreeFly, ACCENT_COLOR);

    document.body.appendChild(root);
  }

  private addRow(label: string, valueColor: string): HTMLSpanElement {
    const labelSpan = el("span", "", label);
    labelSpan.style.color = LABEL_COLOR;
    const valueSpan = el("span", "", strings.debug.hudNone);
    valueSpan.style.color = valueColor;
    valueSpan.style.textAlign = "right";
    this.root.appendChild(labelSpan);
    this.root.appendChild(valueSpan);
    return valueSpan;
  }

  refresh(
    fps: number,
    drawCalls: number,
    triangles: number,
    bodies: number,
    geometries: number,
    state: string,
    freeFly: boolean,
  ): void {
    this.fpsValue.textContent = String(Math.round(fps));
    this.drawCallsValue.textContent = String(drawCalls);
    this.trianglesValue.textContent = String(triangles);
    this.bodiesValue.textContent = String(bodies);
    this.geometriesValue.textContent = String(geometries);
    this.stateValue.textContent = state;
    this.freeFlyValue.textContent = freeFly
      ? strings.debug.hudOn
      : strings.debug.hudOff;
  }

  destroy(): void {
    this.root.remove();
  }
}
