import { lighting, palette } from "../config/palette";
import type { EventBus } from "../core/EventBus";
import type { LevelRecord, SaveManager } from "../core/SaveManager";
import { isAllLevelsUnlocked } from "../debug/flags";
import type { LevelEntry } from "../levels/registry";
import { isUnlocked, levels } from "../levels/registry";
import { cycleFocus, el, ListenerBag } from "../ui/dom";
import { formatTimeMs } from "../ui/format";
import { strings } from "../ui/strings";
import { cssColor, cssColorAlpha, mixColors, uiClass } from "../ui/theme";
import type { Screen } from "./ScreenManager";

const TILE_MIN_HEIGHT_PX = 64;

const textDim = cssColor(mixColors(lighting.hemiSky, palette.bg1, 0.42));

function sectionHeader(
  worldNumber: number,
  worldName: string,
  accent: number,
  muted: boolean,
): HTMLElement {
  const header = el("header");
  Object.assign(header.style, {
    display: "flex",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: "12px",
  });

  const tag = el(
    "span",
    "",
    `${strings.levelSelect.worldPrefix}${worldNumber}`,
  );
  Object.assign(tag.style, {
    fontSize: "13px",
    fontWeight: "700",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: textDim,
  });

  const name = el("h2", "", worldName);
  Object.assign(name.style, {
    margin: "0",
    fontSize: "22px",
    fontWeight: "700",
    letterSpacing: "0.05em",
    color: muted ? cssColorAlpha(accent, 0.45) : cssColor(accent),
    textShadow: muted ? "none" : `0 0 14px ${cssColorAlpha(accent, 0.35)}`,
  });

  header.append(tag, name);
  return header;
}

function levelTile(
  entry: LevelEntry,
  playNumber: number,
  accent: number,
  unlocked: boolean,
  record: LevelRecord | undefined,
): HTMLButtonElement {
  const tile = el("button", uiClass.btn);
  tile.type = "button";
  Object.assign(tile.style, {
    minWidth: "0",
    minHeight: `${TILE_MIN_HEIGHT_PX}px`,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: "6px",
    padding: "12px 18px",
    textAlign: "start",
    borderColor: cssColorAlpha(accent, unlocked ? 0.4 : 0.12),
  });

  const nameRow = el("div");
  Object.assign(nameRow.style, {
    display: "flex",
    alignItems: "baseline",
    gap: "10px",
  });
  const number = el("span", "", String(playNumber));
  Object.assign(number.style, {
    color: cssColor(accent),
    fontVariantNumeric: "tabular-nums",
    textShadow: `0 0 10px ${cssColorAlpha(accent, 0.4)}`,
  });
  nameRow.append(
    number,
    el("span", "", strings.levelNames[entry.id] ?? entry.name),
  );
  tile.appendChild(nameRow);

  const meta = el("div");
  Object.assign(meta.style, {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px 14px",
    fontSize: "14px",
    fontWeight: "500",
    letterSpacing: "0.03em",
    fontVariantNumeric: "tabular-nums",
    color: textDim,
  });

  if (!unlocked) {
    tile.disabled = true;
    Object.assign(tile.style, {
      opacity: "0.45",
      cursor: "default",
      boxShadow: "none",
    });
    meta.appendChild(el("span", "", strings.levelSelect.locked));
    tile.appendChild(meta);
  } else if (record?.completed === true) {
    if (record.bestTimeMs !== null) {
      meta.appendChild(
        el(
          "span",
          "",
          `${strings.levelSelect.best} ${formatTimeMs(record.bestTimeMs)}`,
        ),
      );
    }
    meta.appendChild(
      el("span", "", `${strings.levelSelect.deaths} ${String(record.deaths)}`),
    );
    tile.appendChild(meta);
  }

  return tile;
}

export interface LevelSelectScreenOptions {
  save: SaveManager;
  bus: EventBus;
  onPlay: (entry: LevelEntry) => void;
  onBack: () => void;
}

export class LevelSelectScreen implements Screen {
  readonly el: HTMLElement;

  private readonly bag = new ListenerBag();
  private readonly controls: readonly HTMLElement[];
  private readonly firstControl: HTMLElement;

  constructor(opts: LevelSelectScreenOptions) {
    const { save, bus, onPlay, onBack } = opts;

    this.el = el("div", uiClass.screen);
    this.el.style.overflowY = "auto";
    this.el.style.justifyContent = "flex-start";

    const wrapper = el("div");
    Object.assign(wrapper.style, {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "24px",
      width: "min(720px, 100%)",
      margin: "auto",
    });

    const heading = el("h1", uiClass.heading, strings.levelSelect.title);

    const back = el("button", uiClass.btn, strings.levelSelect.back);
    back.type = "button";

    const tiles: HTMLButtonElement[] = [];
    const sections: HTMLElement[] = [];
    strings.levelSelect.worldNames.forEach((worldName, i) => {
      const worldNumber = i + 1;
      const accent = palette.worldAccents[i] ?? palette.eye;
      const worldLevels = levels
        .map((entry, index) => ({ entry, playNumber: index + 1 }))
        .filter(({ entry }) => entry.world === worldNumber);
      const empty = worldLevels.length === 0;

      const section = el("section", uiClass.panel);
      Object.assign(section.style, {
        width: "100%",
        gap: "14px",
        borderColor: cssColorAlpha(accent, empty ? 0.1 : 0.28),
      });
      section.appendChild(sectionHeader(worldNumber, worldName, accent, empty));

      if (empty) {
        const placeholder = el("p", "", strings.levelSelect.comingSoon);
        Object.assign(placeholder.style, {
          margin: "0",
          color: textDim,
          fontSize: "15px",
          fontStyle: "italic",
          letterSpacing: "0.04em",
        });
        section.appendChild(placeholder);
      } else {
        const grid = el("div");
        Object.assign(grid.style, {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "12px",
        });
        for (const { entry, playNumber } of worldLevels) {
          const unlocked = isAllLevelsUnlocked() || isUnlocked(entry.id, save);
          const tile = levelTile(
            entry,
            playNumber,
            accent,
            unlocked,
            save.getLevel(entry.id),
          );
          if (unlocked) {
            this.bag.add(tile, "click", () => {
              bus.emit("ui:click");
              onPlay(entry);
            });
            tiles.push(tile);
          }
          grid.appendChild(tile);
        }
        section.appendChild(grid);
      }

      sections.push(section);
    });

    wrapper.append(heading, ...sections, back);
    this.el.appendChild(wrapper);

    this.bag.add(back, "click", () => {
      bus.emit("ui:click");
      onBack();
    });

    this.controls = [...tiles, back];
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

    this.firstControl = tiles[0] ?? back;
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
