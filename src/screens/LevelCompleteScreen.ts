import type { EventBus } from "../core/EventBus";
import { cycleFocus, el, ListenerBag } from "../ui/dom";
import { formatTimeMs } from "../ui/format";
import { strings } from "../ui/strings";
import { uiClass, uiEnter } from "../ui/theme";
import type { Screen } from "./ScreenManager";

export interface LevelCompleteResult {
  timeMs: number;
  deaths: number;
  bestTimeMs: number | null;
  newBest: boolean;
  hasNext: boolean;
}

export interface LevelCompleteScreenOptions {
  bus: EventBus;
  result: LevelCompleteResult;
  onNext: () => void;
  onReplay: () => void;
  onMenu: () => void;
}

function statRow(
  labelText: string,
  valueText: string,
): { row: HTMLDivElement; value: HTMLSpanElement } {
  const row = el("div", `${uiClass.row} ${uiClass.rowStatic}`);
  const label = el("span", uiClass.rowLabel, labelText);
  const value = el("span", uiClass.rowValue, valueText);
  row.append(label, value);
  return { row, value };
}

export class LevelCompleteScreen implements Screen {
  readonly el: HTMLElement;

  private readonly bag = new ListenerBag();
  private readonly controls: readonly HTMLElement[];
  private readonly defaultButton: HTMLButtonElement;

  private readonly entranceEls: readonly HTMLElement[];
  private readonly badge: HTMLSpanElement | null;
  private readonly badgeDelayMs: number;

  constructor(opts: LevelCompleteScreenOptions) {
    const { bus, result } = opts;

    this.el = el("div", uiClass.screen);

    const heading = el("h1", uiClass.heading, strings.complete.title);

    const time = statRow(strings.complete.time, formatTimeMs(result.timeMs));
    const deaths = statRow(strings.complete.deaths, String(result.deaths));
    const best = statRow(
      strings.complete.best,
      result.bestTimeMs === null
        ? strings.complete.noBest
        : formatTimeMs(result.bestTimeMs),
    );
    let badge: HTMLSpanElement | null = null;
    if (result.newBest) {
      best.value.classList.add(uiClass.rowValueAccent);
      badge = el("span", uiClass.badge, strings.complete.newBest);
      best.row.insertBefore(badge, best.value);
    }
    this.badge = badge;

    const panel = el("div", uiClass.panel);
    panel.append(time.row, deaths.row, best.row);

    const buttons: HTMLButtonElement[] = [];
    let next: HTMLButtonElement | null = null;
    if (result.hasNext) {
      next = el(
        "button",
        `${uiClass.btn} ${uiClass.btnPrimary}`,
        strings.complete.next,
      );
      next.type = "button";
      buttons.push(next);
    }
    const replay = el(
      "button",
      result.hasNext ? uiClass.btn : `${uiClass.btn} ${uiClass.btnPrimary}`,
      strings.complete.replay,
    );
    replay.type = "button";
    const menu = el("button", uiClass.btn, strings.complete.levels);
    menu.type = "button";
    buttons.push(replay, menu);

    const actions = el("div", uiClass.menuActions);
    actions.append(...buttons);

    this.el.append(heading, panel, actions);

    this.entranceEls = [heading, time.row, deaths.row, best.row, ...buttons];
    this.badgeDelayMs =
      this.entranceEls.indexOf(best.row) * uiEnter.staggerMs +
      uiEnter.durationMs;

    if (next !== null) {
      this.bag.add(next, "click", () => {
        bus.emit("ui:click");
        opts.onNext();
      });
    }
    this.bag.add(replay, "click", () => {
      bus.emit("ui:click");
      opts.onReplay();
    });
    this.bag.add(menu, "click", () => {
      bus.emit("ui:click");
      opts.onMenu();
    });

    this.controls = buttons;
    const defaultAction = result.hasNext ? opts.onNext : opts.onReplay;
    this.bag.addWindow("keydown", (ev) => {
      if (ev.repeat) {
        return;
      }
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault();
        cycleFocus(
          this.controls,
          document.activeElement,
          ev.key === "ArrowDown" ? 1 : -1,
        );
      } else if (ev.key === "Enter") {
        const onControl = this.controls.some(
          (control) => control === document.activeElement,
        );
        if (!onControl) {
          ev.preventDefault();
          bus.emit("ui:click");
          defaultAction();
        }
      }
    });

    this.defaultButton = next ?? replay;
  }

  onShow(): void {
    this.entranceEls.forEach((element, index) => {
      element.style.animationDelay = `${index * uiEnter.staggerMs}ms`;
      element.classList.add(uiClass.enter);
    });
    if (this.badge !== null) {
      this.badge.style.animationDelay = `${this.badgeDelayMs}ms`;
      this.badge.classList.add(uiClass.badgePop);
    }
    this.defaultButton.focus({ preventScroll: true });
  }

  deactivate(): void {
    this.bag.dispose();
  }

  destroy(): void {
    this.bag.dispose();
    this.el.remove();
  }
}
