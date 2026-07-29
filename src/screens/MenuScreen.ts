import type { EventBus } from "../core/EventBus";
import { cycleFocus, el, ListenerBag } from "../ui/dom";
import { createLogoLockup } from "../ui/logo";
import { strings } from "../ui/strings";
import { uiClass } from "../ui/theme";
import type { Screen } from "./ScreenManager";

export interface MenuScreenOptions {
  version: string;
  onPlay: () => void;
  onLevels: () => void;
  onSettings: () => void;
  bus: EventBus;
}

export class MenuScreen implements Screen {
  readonly el: HTMLElement;

  private readonly bag = new ListenerBag();
  private readonly controls: readonly HTMLElement[];
  private readonly playButton: HTMLButtonElement;

  constructor(opts: MenuScreenOptions) {
    this.el = el("div", uiClass.screen);

    const title = el("h1", uiClass.title);
    title.setAttribute("aria-label", strings.appTitle);
    title.appendChild(createLogoLockup());

    const play = el(
      "button",
      `${uiClass.btn} ${uiClass.btnPrimary}`,
      strings.menu.play,
    );
    play.type = "button";
    const levels = el("button", uiClass.btn, strings.menu.levels);
    levels.type = "button";
    const settings = el("button", uiClass.btn, strings.menu.settings);
    settings.type = "button";

    const actions = el("div", uiClass.menuActions);
    actions.append(play, levels, settings);

    this.el.append(title, actions);

    this.bag.add(play, "click", () => {
      opts.bus.emit("ui:click");
      opts.onPlay();
    });
    this.bag.add(levels, "click", () => {
      opts.bus.emit("ui:click");
      opts.onLevels();
    });
    this.bag.add(settings, "click", () => {
      opts.bus.emit("ui:click");
      opts.onSettings();
    });

    this.controls = [play, levels, settings];
    this.bag.addWindow("keydown", (ev) => {
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault();
        cycleFocus(
          this.controls,
          document.activeElement,
          ev.key === "ArrowDown" ? 1 : -1,
        );
      }
    });

    this.playButton = play;
  }

  onShow(): void {
    this.playButton.focus({ preventScroll: true });
  }

  deactivate(): void {
    this.bag.dispose();
  }

  destroy(): void {
    this.bag.dispose();
    this.el.remove();
  }
}
