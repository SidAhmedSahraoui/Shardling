import type { EventBus } from "../core/EventBus";
import { el, ListenerBag } from "./dom";
import { strings } from "./strings";
import { injectStyles, removeStyles, uiClass } from "./theme";
import { uiEnter } from "./theme";

const MOVE_CODES: ReadonlySet<string> = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

const HIDE_REMOVE_DELAY_MS = 400;

const MOVE_KEY_CODES = ["KeyW", "KeyA", "KeyS", "KeyD"] as const;

interface KeyboardLayoutMapLike {
  get(code: string): string | undefined;
}
interface KeyboardLike {
  getLayoutMap?: () => Promise<KeyboardLayoutMapLike>;
}

export type ControlHintsKind = "basics" | "doubleJump";

export interface ControlHintsOptions {
  bus: EventBus;
  kind: ControlHintsKind;
  reduceMotion: () => boolean;
  isGameplayActive: () => boolean;
  root?: HTMLElement;
}

interface HintRow {
  el: HTMLElement;
  done: boolean;
}

function hintRow(
  keys: readonly string[],
  label: string,
  index: number,
): HTMLElement {
  const row = el("div", `${uiClass.hint} ${uiClass.enter}`);
  row.style.animationDelay = `${index * uiEnter.staggerMs}ms`;
  const keyGroup = el("span", uiClass.hintKeys);
  for (const key of keys) {
    keyGroup.appendChild(el("span", uiClass.kbd, key));
  }
  row.append(keyGroup, el("span", uiClass.hintLabel, label));
  return row;
}

export class ControlHints {
  static isCoarsePointer(): boolean {
    return globalThis.matchMedia?.("(pointer: coarse)").matches ?? false;
  }

  private readonly el: HTMLElement;
  private readonly reduceMotion: () => boolean;
  private readonly bag = new ListenerBag();
  private readonly unsubscribes: (() => void)[] = [];
  private readonly timeouts = new Set<number>();
  private readonly rows: HintRow[] = [];
  private destroyed = false;

  constructor(opts: ControlHintsOptions) {
    this.reduceMotion = opts.reduceMotion;

    injectStyles();

    const anchor = opts.root ?? document.getElementById("app") ?? document.body;
    this.el = el("div", uiClass.hints);
    if (this.reduceMotion()) {
      this.el.classList.add(uiClass.hintsReduce);
    }

    if (opts.kind === "basics") {
      const move: HintRow = {
        el: hintRow(["W", "A", "S", "D"], strings.hints.move, 0),
        done: false,
      };
      void this.applyLayoutLabels(move.el);
      const jump: HintRow = {
        el: hintRow([strings.hints.spaceKey], strings.hints.jump, 1),
        done: false,
      };
      this.rows.push(move, jump);

      this.bag.addWindow("keydown", (ev) => {
        if (MOVE_CODES.has(ev.code) && opts.isGameplayActive()) {
          this.dismiss(move);
        }
      });
      this.unsubscribes.push(
        opts.bus.on("player:jumped", () => {
          this.dismiss(jump);
        }),
      );
    } else {
      const doubleJump: HintRow = {
        el: hintRow([strings.hints.spaceKey], strings.hints.doubleJump, 0),
        done: false,
      };
      this.rows.push(doubleJump);

      this.unsubscribes.push(
        opts.bus.on("player:jumped", ({ double }) => {
          if (double) {
            this.dismiss(doubleJump);
          }
        }),
      );
    }

    for (const row of this.rows) {
      this.el.appendChild(row.el);
    }
    anchor.appendChild(this.el);
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.bag.dispose();
    for (const unsubscribe of this.unsubscribes) {
      unsubscribe();
    }
    this.unsubscribes.length = 0;
    for (const id of this.timeouts) {
      window.clearTimeout(id);
    }
    this.timeouts.clear();
    this.el.remove();
    removeStyles();
  }

  private async applyLayoutLabels(moveRow: HTMLElement): Promise<void> {
    let map: KeyboardLayoutMapLike | undefined;
    try {
      const keyboard = (navigator as { keyboard?: KeyboardLike }).keyboard;
      map = await keyboard?.getLayoutMap?.();
    } catch {
      return;
    }
    if (!map || this.destroyed) {
      return;
    }
    const chips = moveRow.querySelectorAll(`.${uiClass.kbd}`);
    MOVE_KEY_CODES.forEach((code, index) => {
      const chip = chips[index];
      const label = map.get(code);
      if (
        chip !== undefined &&
        typeof label === "string" &&
        label.length === 1 &&
        /[\p{L}\p{N}]/u.test(label)
      ) {
        chip.textContent = label.toLocaleUpperCase();
      }
    });
  }

  private dismiss(row: HintRow): void {
    if (row.done || this.destroyed) {
      return;
    }
    row.done = true;
    if (this.reduceMotion()) {
      row.el.remove();
    } else {
      row.el.classList.add(uiClass.hintHidden);
      const id = window.setTimeout(() => {
        this.timeouts.delete(id);
        row.el.remove();
      }, HIDE_REMOVE_DELAY_MS);
      this.timeouts.add(id);
    }
  }
}
