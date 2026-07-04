import type { EventBus } from "../core/EventBus";
import { cycleFocus, el, ListenerBag } from "../ui/dom";
import { strings } from "../ui/strings";
import { uiClass } from "../ui/theme";
import type { Screen } from "./ScreenManager";

export interface PauseScreenOptions {
  bus: EventBus;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

export class PauseScreen implements Screen {
  readonly el: HTMLElement;

  private readonly bag = new ListenerBag();
  private readonly controls: readonly HTMLElement[];
  private readonly resumeButton: HTMLButtonElement;

  constructor(opts: PauseScreenOptions) {
    const { bus } = opts;

    this.el = el("div", uiClass.screen);

    const heading = el("h1", uiClass.heading, strings.pause.title);

    const resume = el(
      "button",
      `${uiClass.btn} ${uiClass.btnPrimary}`,
      strings.pause.resume,
    );
    resume.type = "button";
    const restart = el("button", uiClass.btn, strings.pause.restart);
    restart.type = "button";
    const quit = el("button", uiClass.btn, strings.pause.quitToMenu);
    quit.type = "button";

    const actions = el("div", uiClass.menuActions);
    actions.append(resume, restart, quit);

    this.el.append(heading, actions);

    this.bag.add(resume, "click", () => {
      bus.emit("ui:click");
      opts.onResume();
    });
    this.bag.add(restart, "click", () => {
      bus.emit("ui:click");
      opts.onRestart();
    });
    this.bag.add(quit, "click", () => {
      bus.emit("ui:click");
      opts.onQuit();
    });

    this.controls = [resume, restart, quit];
    this.bag.addWindow("keydown", (ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        bus.emit("ui:click");
        opts.onResume();
      } else if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault();
        cycleFocus(
          this.controls,
          document.activeElement,
          ev.key === "ArrowDown" ? 1 : -1,
        );
      }
    });

    this.resumeButton = resume;
  }

  onShow(): void {
    this.resumeButton.focus({ preventScroll: true });
  }

  deactivate(): void {
    this.bag.dispose();
  }

  destroy(): void {
    this.bag.dispose();
    this.el.remove();
  }
}
