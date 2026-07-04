import { tuning } from "../config/tuning";
import type { EventBus } from "../core/EventBus";
import type { SaveManager } from "../core/SaveManager";
import { cycleFocus, el, ListenerBag, uniqueId } from "../ui/dom";
import { strings } from "../ui/strings";
import { uiClass } from "../ui/theme";
import type { Screen } from "./ScreenManager";

const VOLUME_MIN = 0;
const VOLUME_MAX = 1;
const VOLUME_STEP = 0.05;
const SENSITIVITY_STEP = 0.1;

const percentFormat = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 0,
});
const sensitivityFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

interface SliderRow {
  row: HTMLDivElement;
  input: HTMLInputElement;
  value: HTMLSpanElement;
}

interface ToggleRow {
  row: HTMLLabelElement;
  input: HTMLInputElement;
  value: HTMLSpanElement;
}

function sliderRow(
  labelText: string,
  min: number,
  max: number,
  step: number,
  initial: number,
  format: (v: number) => string,
): SliderRow {
  const row = el("div", uiClass.row);
  const id = uniqueId("sg-ctl");
  const label = el("label", uiClass.rowLabel, labelText);
  label.htmlFor = id;
  const input = el("input", uiClass.slider);
  input.type = "range";
  input.id = id;
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(initial);
  const value = el("span", uiClass.rowValue, format(initial));
  row.append(label, input, value);
  return { row, input, value };
}

function toggleRow(labelText: string, initial: boolean): ToggleRow {
  const row = el("label", uiClass.row);
  const label = el("span", uiClass.rowLabel, labelText);
  const value = el(
    "span",
    uiClass.rowValue,
    initial ? strings.settings.on : strings.settings.off,
  );
  const input = el("input", uiClass.toggle);
  input.type = "checkbox";
  input.checked = initial;
  row.append(label, value, input);
  return { row, input, value };
}

export interface SettingsScreenOptions {
  save: SaveManager;
  bus: EventBus;
  onBack: () => void;
}

export class SettingsScreen implements Screen {
  readonly el: HTMLElement;

  private readonly bag = new ListenerBag();
  private readonly controls: readonly HTMLElement[];
  private readonly firstControl: HTMLElement;

  constructor(opts: SettingsScreenOptions) {
    const { save, bus, onBack } = opts;
    const initial = save.getSettings();

    this.el = el("div", uiClass.screen);

    const heading = el("h1", uiClass.heading, strings.settings.title);

    const volume = sliderRow(
      strings.settings.volume,
      VOLUME_MIN,
      VOLUME_MAX,
      VOLUME_STEP,
      initial.volume,
      (v) => percentFormat.format(v),
    );
    const mute = toggleRow(strings.settings.mute, initial.muted);
    const reduce = toggleRow(
      strings.settings.reduceMotion,
      initial.reduceMotion,
    );
    const sensitivity = sliderRow(
      strings.settings.camSensitivity,
      tuning.camSensitivityMin,
      tuning.camSensitivityMax,
      SENSITIVITY_STEP,
      initial.camSensitivity,
      (v) => sensitivityFormat.format(v),
    );

    const panel = el("div", uiClass.panel);
    panel.append(volume.row, mute.row, reduce.row, sensitivity.row);

    const back = el("button", uiClass.btn, strings.settings.back);
    back.type = "button";

    this.el.append(heading, panel, back);

    this.bag.add(volume.input, "input", () => {
      const settings = save.updateSettings({
        volume: Number(volume.input.value),
      });
      volume.value.textContent = percentFormat.format(settings.volume);
      bus.emit("settings:changed", { settings });
    });
    this.bag.add(volume.input, "change", () => {
      bus.emit("ui:click");
    });

    this.bag.add(mute.input, "change", () => {
      bus.emit("ui:click");
      const settings = save.updateSettings({ muted: mute.input.checked });
      mute.value.textContent = settings.muted
        ? strings.settings.on
        : strings.settings.off;
      bus.emit("settings:changed", { settings });
    });

    this.bag.add(reduce.input, "change", () => {
      bus.emit("ui:click");
      const settings = save.updateSettings({
        reduceMotion: reduce.input.checked,
      });
      reduce.value.textContent = settings.reduceMotion
        ? strings.settings.on
        : strings.settings.off;
      bus.emit("settings:changed", { settings });
    });

    this.bag.add(sensitivity.input, "input", () => {
      const settings = save.updateSettings({
        camSensitivity: Number(sensitivity.input.value),
      });
      sensitivity.value.textContent = sensitivityFormat.format(
        settings.camSensitivity,
      );
      bus.emit("settings:changed", { settings });
    });
    this.bag.add(sensitivity.input, "change", () => {
      bus.emit("ui:click");
    });

    this.bag.add(back, "click", () => {
      bus.emit("ui:click");
      onBack();
    });

    this.controls = [
      volume.input,
      mute.input,
      reduce.input,
      sensitivity.input,
      back,
    ];
    this.bag.addWindow("keydown", (ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        bus.emit("ui:click");
        onBack();
      } else if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault();
        cycleFocus(
          this.controls,
          document.activeElement,
          ev.key === "ArrowDown" ? 1 : -1,
        );
      }
    });

    this.firstControl = volume.input;
  }

  onShow(): void {
    this.firstControl.focus({ preventScroll: true });
  }

  deactivate(): void {
    this.bag.dispose();
  }

  destroy(): void {
    this.bag.dispose();
    this.el.remove();
  }
}
