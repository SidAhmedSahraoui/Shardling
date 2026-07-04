import { lighting, palette } from "../config/palette";
import { uniqueId } from "./dom";
import { strings } from "./strings";
import { cssColor, cssColorAlpha, mixColors } from "./theme";

const SVG_NS = "http://www.w3.org/2000/svg";

const KITE = {
  top: [48, 5],
  right: [60.5, 33],
  bottom: [48, 62],
  left: [35.5, 33],
} as const;

const ORB = { cx: 64, cy: 71, r: 13.5 } as const;
const EYE = { cx: 60, cy: 68, rx: 3.8, ry: 4.4 } as const;

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, value);
  }
  return node;
}

function kitePoints(): string {
  const { top, right, bottom, left } = KITE;
  return `${top.join(",")} ${right.join(",")} ${bottom.join(",")} ${left.join(",")}`;
}

export function createLogoMark(size: number): SVGSVGElement {
  const svg = svgEl("svg", {
    viewBox: "0 0 96 96",
    width: String(size),
    height: String(size),
    role: "img",
    "aria-hidden": "true",
  });
  svg.style.overflow = "visible";

  const glowId = uniqueId("sg-logo-glow");
  const softId = uniqueId("sg-logo-soft");
  const defs = svgEl("defs", {});
  const glow = svgEl("filter", {
    id: glowId,
    x: "-60%",
    y: "-60%",
    width: "220%",
    height: "220%",
  });
  glow.appendChild(svgEl("feGaussianBlur", { stdDeviation: "5" }));
  const soft = svgEl("filter", {
    id: softId,
    x: "-120%",
    y: "-120%",
    width: "340%",
    height: "340%",
  });
  soft.appendChild(svgEl("feGaussianBlur", { stdDeviation: "2.4" }));
  defs.append(glow, soft);
  svg.appendChild(defs);

  svg.appendChild(
    svgEl("polygon", {
      points: kitePoints(),
      fill: cssColor(palette.shard),
      opacity: "0.55",
      filter: `url(#${glowId})`,
    }),
  );
  svg.appendChild(
    svgEl("polygon", { points: kitePoints(), fill: cssColor(palette.shard) }),
  );
  svg.appendChild(
    svgEl("polygon", {
      points: `${KITE.top.join(",")} ${KITE.left.join(",")} ${KITE.bottom.join(",")}`,
      fill: cssColor(mixColors(palette.shard, lighting.hemiSky, 0.3)),
    }),
  );

  svg.appendChild(
    svgEl("circle", {
      cx: String(ORB.cx),
      cy: String(ORB.cy),
      r: String(ORB.r),
      fill: cssColor(palette.player),
      stroke: cssColorAlpha(lighting.hemiSky, 0.12),
      "stroke-width": "1.2",
    }),
  );
  svg.appendChild(
    svgEl("circle", {
      cx: String(EYE.cx),
      cy: String(EYE.cy),
      r: "5.4",
      fill: cssColor(palette.eye),
      opacity: "0.4",
      filter: `url(#${softId})`,
    }),
  );
  svg.appendChild(
    svgEl("ellipse", {
      cx: String(EYE.cx),
      cy: String(EYE.cy),
      rx: String(EYE.rx),
      ry: String(EYE.ry),
      fill: cssColor(palette.eye),
    }),
  );
  svg.appendChild(
    svgEl("circle", {
      cx: "58.6",
      cy: "66.2",
      r: "1.3",
      fill: cssColor(lighting.hemiSky),
    }),
  );

  svg.appendChild(
    svgEl("circle", {
      cx: "27",
      cy: "50",
      r: "1.8",
      fill: cssColor(palette.shard),
      opacity: "0.8",
    }),
  );
  svg.appendChild(
    svgEl("circle", {
      cx: "70",
      cy: "22",
      r: "1.4",
      fill: cssColor(palette.shard),
      opacity: "0.6",
    }),
  );
  svg.appendChild(
    svgEl("circle", {
      cx: "24",
      cy: "20",
      r: "1.3",
      fill: cssColor(palette.portal),
      opacity: "0.7",
    }),
  );
  return svg;
}

const WM_STROKE = 17;
const WM_TRACK = 15;
const WM_CAP = 100;

interface WordmarkGlyph {
  w: number;
  lines?: readonly (readonly (readonly [number, number])[])[];
  kite?: boolean;
}

const WM_GLYPHS: readonly WordmarkGlyph[] = [
  {
    w: 62,
    lines: [
      [
        [53.5, 8.5],
        [8.5, 8.5],
        [8.5, 50],
        [53.5, 50],
        [53.5, 91.5],
        [8.5, 91.5],
      ],
    ],
  },
  {
    w: 66,
    lines: [
      [
        [8.5, 0],
        [8.5, 100],
      ],
      [
        [57.5, 0],
        [57.5, 100],
      ],
      [
        [8.5, 52],
        [57.5, 52],
      ],
    ],
  },
  {
    w: 70,
    lines: [
      [
        [8.5, 100],
        [35, 10],
        [61.5, 100],
      ],
      [
        [17.5, 70],
        [52.5, 70],
      ],
    ],
  },
  {
    w: 64,
    lines: [
      [
        [8.5, 0],
        [8.5, 100],
      ],
      [
        [8.5, 8.5],
        [55.5, 8.5],
        [55.5, 47],
        [8.5, 47],
      ],
      [
        [30, 47],
        [55.5, 100],
      ],
    ],
  },
  {
    w: 68,
    lines: [
      [
        [8.5, 0],
        [8.5, 100],
      ],
      [
        [8.5, 8.5],
        [41, 8.5],
        [59.5, 27],
        [59.5, 73],
        [41, 91.5],
        [8.5, 91.5],
      ],
    ],
  },
  {
    w: 56,
    lines: [
      [
        [8.5, 0],
        [8.5, 91.5],
        [47.5, 91.5],
      ],
    ],
  },
  { w: 34, kite: true },
  {
    w: 68,
    lines: [
      [
        [8.5, 100],
        [8.5, 0],
        [59.5, 100],
        [59.5, 0],
      ],
    ],
  },
  {
    w: 68,
    lines: [
      [
        [59.5, 8.5],
        [25, 8.5],
        [8.5, 25],
        [8.5, 75],
        [25, 91.5],
        [59.5, 91.5],
        [59.5, 54],
        [38, 54],
      ],
    ],
  },
];

export function createWordmark(): SVGSVGElement {
  const totalW = WM_GLYPHS.reduce((sum, g) => sum + g.w + WM_TRACK, -WM_TRACK);
  const pad = 6;
  const svg = svgEl("svg", {
    viewBox: `${-pad} ${-pad} ${totalW + pad * 2} ${WM_CAP + pad * 2}`,
    role: "img",
    "aria-label": strings.appTitle,
  });
  svg.style.overflow = "visible";

  const letterColor = cssColor(mixColors(lighting.hemiSky, palette.eye, 0.15));
  const letters = svgEl("g", {
    fill: "none",
    stroke: letterColor,
    "stroke-width": String(WM_STROKE),
    "stroke-linejoin": "bevel",
    "stroke-linecap": "butt",
  });
  letters.style.filter =
    `drop-shadow(0 0 10px ${cssColorAlpha(palette.eye, 0.5)}) ` +
    `drop-shadow(0 0 28px ${cssColorAlpha(palette.portal, 0.26)})`;

  const shard = svgEl("g", {});
  shard.style.filter = `drop-shadow(0 0 10px ${cssColorAlpha(palette.shard, 0.6)})`;

  let x = 0;
  for (const glyph of WM_GLYPHS) {
    if (glyph.kite) {
      const cx = x + glyph.w / 2;
      const girth = 13;
      const waist = 38;
      shard.appendChild(
        svgEl("polygon", {
          points: `${cx},0 ${cx + girth},${waist} ${cx},${WM_CAP} ${cx - girth},${waist}`,
          fill: cssColor(palette.shard),
        }),
      );
      shard.appendChild(
        svgEl("polygon", {
          points: `${cx},0 ${cx - girth},${waist} ${cx},${WM_CAP}`,
          fill: cssColor(mixColors(palette.shard, lighting.hemiSky, 0.3)),
        }),
      );
    } else if (glyph.lines) {
      const d = glyph.lines
        .map(
          (line) => `M${line.map(([px, py]) => `${px + x},${py}`).join("L")}`,
        )
        .join("");
      letters.appendChild(svgEl("path", { d }));
    }
    x += glyph.w + WM_TRACK;
  }

  svg.append(letters, shard);
  return svg;
}

export function createLogoLockup(): HTMLElement {
  const lockup = document.createElement("div");
  Object.assign(lockup.style, {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
  });

  const mark = createLogoMark(120);
  mark.style.width = "clamp(92px, 16vw, 136px)";
  mark.style.height = "auto";
  mark.style.marginBottom = "4px";

  const word = createWordmark();
  word.style.height = "clamp(34px, 6vw, 58px)";
  word.style.width = "auto";

  lockup.append(mark, word);
  return lockup;
}

export function faviconDataUrl(size = 64): string {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return "";
  }
  const s = size / 96;
  ctx.scale(s, s);

  const kitePath = (): void => {
    ctx.beginPath();
    ctx.moveTo(KITE.top[0], KITE.top[1]);
    ctx.lineTo(KITE.right[0], KITE.right[1]);
    ctx.lineTo(KITE.bottom[0], KITE.bottom[1]);
    ctx.lineTo(KITE.left[0], KITE.left[1]);
    ctx.closePath();
  };

  ctx.save();
  ctx.shadowColor = cssColorAlpha(palette.shard, 0.9);
  ctx.shadowBlur = 10 * s;
  ctx.fillStyle = cssColor(palette.shard);
  kitePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = cssColor(mixColors(palette.shard, lighting.hemiSky, 0.3));
  ctx.beginPath();
  ctx.moveTo(KITE.top[0], KITE.top[1]);
  ctx.lineTo(KITE.left[0], KITE.left[1]);
  ctx.lineTo(KITE.bottom[0], KITE.bottom[1]);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = cssColor(palette.player);
  ctx.beginPath();
  ctx.arc(ORB.cx, ORB.cy, ORB.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = cssColorAlpha(lighting.hemiSky, 0.14);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = cssColor(palette.eye);
  ctx.beginPath();
  ctx.ellipse(EYE.cx, EYE.cy, EYE.rx, EYE.ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cssColor(lighting.hemiSky);
  ctx.beginPath();
  ctx.arc(58.6, 66.2, 1.3, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toDataURL("image/png");
}

export function installFavicon(): void {
  const url = faviconDataUrl();
  if (!url) {
    return;
  }
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/png";
  link.href = url;
}
