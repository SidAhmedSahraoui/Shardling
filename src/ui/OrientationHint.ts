import { lighting, palette } from "../config/palette";
import { el } from "./dom";
import { strings } from "./strings";
import { cssColor, cssColorAlpha, mixColors } from "./theme";

const ORIENT_Z_INDEX = 40;

const VEIL_ALPHA = 0.82;

const TURN_CYCLE_MS = 2600;

const EASE_CUBIC_OUT = "cubic-bezier(0.33, 1, 0.68, 1)";

const cls = {
  root: "sg-orient",
  visible: "sg-orient--visible",
  reduce: "sg-orient--reduce",
  card: "sg-orient-card",
  glyph: "sg-orient-glyph",
  text: "sg-orient-text",
} as const;

const textPrimary = cssColor(mixColors(lighting.hemiSky, palette.eye, 0.12));

function buildStylesheet(): string {
  const eye = palette.eye;
  const bg0 = palette.bg0;
  const bg1 = palette.bg1;
  return `
.${cls.root} {
  position: absolute;
  inset: 0;
  z-index: ${ORIENT_Z_INDEX};
  display: none;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  font-family: system-ui, "Segoe UI", sans-serif;
  background: ${cssColorAlpha(bg0, VEIL_ALPHA)};
  -webkit-user-select: none;
  user-select: none;
}
.${cls.visible} {
  display: flex;
}
.${cls.card} {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 28px 36px;
  border-radius: 20px;
  border: 1px solid ${cssColorAlpha(eye, 0.35)};
  background: ${cssColorAlpha(bg1, 0.8)};
  box-shadow: 0 0 32px ${cssColorAlpha(eye, 0.12)};
}
.${cls.glyph} {
  width: 96px;
  height: 96px;
  transform-origin: 50% 50%;
  animation: sg-orient-turn-kf ${TURN_CYCLE_MS}ms ${EASE_CUBIC_OUT} infinite;
}
@keyframes sg-orient-turn-kf {
  0%, 15% {
    transform: rotate(0deg);
  }
  45%, 70% {
    transform: rotate(90deg);
  }
  100% {
    transform: rotate(0deg);
  }
}
.${cls.reduce} .${cls.glyph} {
  animation: none;
}
@media (prefers-reduced-motion: reduce) {
  .${cls.glyph} {
    animation: none !important;
  }
}
.${cls.text} {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: ${textPrimary};
}
`;
}

const SVG_NS = "http://www.w3.org/2000/svg";

function buildGlyph(accent: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");

  const stroke = (node: SVGElement, width: string): void => {
    node.setAttribute("stroke", accent);
    node.setAttribute("stroke-width", width);
    node.setAttribute("stroke-linecap", "round");
    node.setAttribute("stroke-linejoin", "round");
  };

  const body = document.createElementNS(SVG_NS, "rect");
  body.setAttribute("x", "22");
  body.setAttribute("y", "12");
  body.setAttribute("width", "20");
  body.setAttribute("height", "40");
  body.setAttribute("rx", "5");
  stroke(body, "3");

  const home = document.createElementNS(SVG_NS, "path");
  home.setAttribute("d", "M29 46.5 L35 46.5");
  home.setAttribute("opacity", "0.6");
  stroke(home, "2.5");

  const arc = document.createElementNS(SVG_NS, "path");
  arc.setAttribute("d", "M45 9.5 A26 26 0 0 1 57.6 27.5");
  stroke(arc, "2.5");

  const head = document.createElementNS(SVG_NS, "path");
  head.setAttribute("d", "M59.5 21.1 L57.6 27.5 L53.7 22.1");
  stroke(head, "2.5");

  svg.append(body, home, arc, head);
  return svg;
}

export interface OrientationHintOptions {
  root: HTMLElement;
  reduceMotion: () => boolean;
}

export class OrientationHint {
  private readonly el: HTMLDivElement;
  private readonly style: HTMLStyleElement;
  private readonly reduceMotion: () => boolean;
  private readonly coarseQuery: MediaQueryList;
  private readonly portraitQuery: MediaQueryList;
  private readonly onOrientationChange: () => void;
  private disposed = false;

  constructor(opts: OrientationHintOptions) {
    this.reduceMotion = opts.reduceMotion;

    this.style = document.createElement("style");
    this.style.textContent = buildStylesheet();
    document.head.appendChild(this.style);

    this.el = el("div", cls.root);
    const card = el("div", cls.card);
    const glyph = buildGlyph(cssColor(palette.eye));
    glyph.classList.add(cls.glyph);
    card.append(glyph, el("p", cls.text, strings.orientation.rotate));
    this.el.appendChild(card);
    opts.root.appendChild(this.el);

    this.coarseQuery = window.matchMedia("(pointer: coarse)");
    this.portraitQuery = window.matchMedia("(orientation: portrait)");
    this.onOrientationChange = (): void => {
      this.recompute();
    };
    this.portraitQuery.addEventListener?.("change", this.onOrientationChange);

    this.recompute();
  }

  refresh(): void {
    if (!this.disposed) {
      this.recompute();
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.portraitQuery.removeEventListener?.(
      "change",
      this.onOrientationChange,
    );
    this.el.remove();
    this.style.remove();
  }

  private recompute(): void {
    const show = this.coarseQuery.matches && this.portraitQuery.matches;
    this.el.classList.toggle(cls.visible, show);
    this.el.classList.toggle(cls.reduce, this.reduceMotion());
  }
}
