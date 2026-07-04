import type { EventBus } from "../core/EventBus";
import { el, ListenerBag } from "../ui/dom";
import { formatTimeMs } from "../ui/format";
import { strings } from "../ui/strings";
import { injectStyles, removeStyles, uiClass } from "../ui/theme";

const REFRESH_INTERVAL_MS = 100;

export interface HudOptions {
  bus: EventBus;
  getTimeMs: () => number;
  getDeaths: () => number;
  shardTotal: number;
  reduceMotion: () => boolean;
  onPause: () => void;
  root?: HTMLElement;
}

export class Hud {
  private readonly bus: EventBus;
  private readonly getTimeMs: () => number;
  private readonly getDeaths: () => number;
  private readonly shardTotal: number;
  private readonly reduceMotion: () => boolean;

  private readonly root: HTMLDivElement;
  private readonly anchor: HTMLElement;
  private readonly anchorPreviousInlinePosition: string;
  private readonly didSetAnchorPosition: boolean;

  private readonly shardsValue: HTMLSpanElement;
  private readonly timerValue: HTMLSpanElement;
  private readonly deathsValue: HTMLSpanElement;

  private readonly bag = new ListenerBag();
  private readonly unsubscribes: (() => void)[] = [];
  private readonly intervalId: number;

  private shardCount = 0;
  private destroyed = false;

  constructor(opts: HudOptions) {
    this.bus = opts.bus;
    this.getTimeMs = opts.getTimeMs;
    this.getDeaths = opts.getDeaths;
    this.shardTotal = opts.shardTotal;
    this.reduceMotion = opts.reduceMotion;

    injectStyles();

    this.anchor = opts.root ?? document.getElementById("app") ?? document.body;
    this.anchorPreviousInlinePosition = this.anchor.style.position;
    if (getComputedStyle(this.anchor).position === "static") {
      this.anchor.style.position = "relative";
      this.didSetAnchorPosition = true;
    } else {
      this.didSetAnchorPosition = false;
    }

    this.root = el("div", uiClass.hud);

    const shardsStat = el("div", `${uiClass.hudStat} ${uiClass.hudStatShards}`);
    shardsStat.append(
      el("span", uiClass.hudStatLabel, strings.hud.shards),
      (this.shardsValue = el("span", uiClass.hudStatValue)),
    );
    const left = el("div", `${uiClass.hudAnchor} ${uiClass.hudAnchorLeft}`);
    left.append(shardsStat);

    const timerStat = el("div", uiClass.hudStat);
    timerStat.setAttribute("aria-label", strings.hud.time);
    timerStat.append((this.timerValue = el("span", uiClass.hudStatValue)));
    const center = el("div", `${uiClass.hudAnchor} ${uiClass.hudAnchorCenter}`);
    center.append(timerStat);

    const deathsStat = el("div", uiClass.hudStat);
    deathsStat.append(
      el("span", uiClass.hudStatLabel, strings.hud.deaths),
      (this.deathsValue = el("span", uiClass.hudStatValue)),
    );
    const pause = el("button", uiClass.hudPause, strings.hud.pause);
    pause.type = "button";
    const right = el("div", `${uiClass.hudAnchor} ${uiClass.hudAnchorRight}`);
    right.append(deathsStat, pause);

    this.root.append(left, center, right);
    this.anchor.appendChild(this.root);

    this.bag.add(pause, "click", () => {
      this.bus.emit("ui:click");
      opts.onPause();
    });

    this.unsubscribes.push(
      this.bus.on("shard:collected", () => {
        this.shardCount = Math.min(this.shardCount + 1, this.shardTotal);
        this.renderShards();
        this.punchShards();
      }),
      this.bus.on("player:died", () => {
        this.shardCount = 0;
        this.renderShards();
        this.refresh();
      }),
      this.bus.on("level:loaded", () => {
        this.shardCount = 0;
        this.renderShards();
        this.refresh();
      }),
    );

    this.renderShards();
    this.refresh();
    this.intervalId = window.setInterval(() => {
      this.refresh();
    }, REFRESH_INTERVAL_MS);

    void this.root.offsetWidth;
    this.root.classList.add(uiClass.hudVisible);
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    window.clearInterval(this.intervalId);
    this.bag.dispose();
    for (const unsubscribe of this.unsubscribes) {
      unsubscribe();
    }
    this.unsubscribes.length = 0;
    this.root.remove();
    if (this.didSetAnchorPosition) {
      this.anchor.style.position = this.anchorPreviousInlinePosition;
    }
    removeStyles();
  }

  private renderShards(): void {
    this.shardsValue.textContent = `${this.shardCount}/${this.shardTotal}`;
  }

  private punchShards(): void {
    if (this.reduceMotion()) {
      return;
    }
    this.shardsValue.classList.remove(uiClass.hudPunch);
    void this.shardsValue.offsetWidth;
    this.shardsValue.classList.add(uiClass.hudPunch);
  }

  private refresh(): void {
    const time = formatTimeMs(this.getTimeMs());
    if (this.timerValue.textContent !== time) {
      this.timerValue.textContent = time;
    }
    const deaths = String(this.getDeaths());
    if (this.deathsValue.textContent !== deaths) {
      this.deathsValue.textContent = deaths;
    }
    this.root.classList.toggle(uiClass.hudReduce, this.reduceMotion());
  }
}
