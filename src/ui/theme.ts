import { lighting, palette } from "../config/palette";
import { tuning } from "../config/tuning";
import { soraWoff2Base64 } from "./fontData";

const TOUCH_TARGET_MIN_PX = 64;

const HOVER_TRANSITION_MS = 160;

const SLIDE_IN_PX = 12;

const HUD_PUNCH_MS = 180;

const EASE_CUBIC_OUT = "cubic-bezier(0.33, 1, 0.68, 1)";

const FONT_STACK = '"Sora", system-ui, "Segoe UI", sans-serif';

const BADGE_POP_SCALE = 1.15;
const BADGE_POP_MS = 250;

export const uiEnter = {
  staggerMs: 60,
  durationMs: tuning.uiFadeMs,
} as const;

export function cssColor(c: number): string {
  return `#${c.toString(16).padStart(6, "0")}`;
}

export function cssColorAlpha(c: number, alpha: number): string {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function mixColors(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

export const uiClass = {
  layer: "sg-layer",
  layerReduce: "sg-layer--reduce",
  screen: "sg-screen",
  screenVisible: "sg-screen--visible",
  title: "sg-title",
  heading: "sg-heading",
  menuActions: "sg-menu-actions",
  version: "sg-version",
  credits: "sg-credits",
  btn: "sg-btn",
  btnPrimary: "sg-btn--primary",
  panel: "sg-panel",
  row: "sg-row",
  rowLabel: "sg-row-label",
  rowValue: "sg-row-value",
  slider: "sg-slider",
  toggle: "sg-toggle",
  rowStatic: "sg-row--static",
  rowValueAccent: "sg-row-value--accent",
  badge: "sg-badge",
  badgePop: "sg-badge--pop",
  enter: "sg-enter",
  hud: "sg-hud",
  hudVisible: "sg-hud--visible",
  hudReduce: "sg-hud--reduce",
  hudAnchor: "sg-hud-anchor",
  hudAnchorLeft: "sg-hud-anchor--left",
  hudAnchorCenter: "sg-hud-anchor--center",
  hudAnchorRight: "sg-hud-anchor--right",
  hudStat: "sg-hud-stat",
  hudStatShards: "sg-hud-stat--shards",
  hudStatLabel: "sg-hud-stat-label",
  hudStatValue: "sg-hud-stat-value",
  hudPause: "sg-hud-pause",
  hudPunch: "sg-hud-punch",
  veil: "sg-veil",
  veilOpaque: "sg-veil--opaque",
  hints: "sg-hints",
  hintsReduce: "sg-hints--reduce",
  hint: "sg-hint",
  hintHidden: "sg-hint--hidden",
  hintKeys: "sg-hint-keys",
  hintLabel: "sg-hint-label",
  kbd: "sg-kbd",
  levelIntro: "sg-level-intro",
  levelIntroVisible: "sg-level-intro--visible",
  levelIntroTag: "sg-level-intro-tag",
  levelIntroName: "sg-level-intro-name",
  tile: "sg-tile",
  tileDone: "sg-tile-done",
  tileChip: "sg-tile-chip",
} as const;

const textPrimary = cssColor(mixColors(lighting.hemiSky, palette.eye, 0.12));
const textTitle = cssColor(mixColors(lighting.hemiSky, palette.eye, 0.3));
const textDim = cssColor(mixColors(lighting.hemiSky, palette.bg1, 0.42));

function buildStylesheet(): string {
  const eye = palette.eye;
  const portal = palette.portal;
  const shard = palette.shard;
  const bg0 = palette.bg0;
  const bg1 = palette.bg1;
  return `
@font-face {
  font-family: "Sora";
  src: url(data:font/woff2;base64,${soraWoff2Base64}) format("woff2");
  font-weight: 100 800;
  font-style: normal;
  font-display: swap;
}
.${uiClass.layer} {
  position: absolute;
  inset: 0;
  z-index: 10;
  pointer-events: none;
  overflow: hidden;
  font-family: ${FONT_STACK};
  color: ${textPrimary};
  -webkit-user-select: none;
  user-select: none;
}
.${uiClass.layerReduce},
.${uiClass.layerReduce} * {
  transition: none !important;
  animation: none !important;
}
@media (prefers-reduced-motion: reduce) {
  .${uiClass.layer},
  .${uiClass.layer} * {
    transition: none !important;
    animation: none !important;
  }
}
.${uiClass.layer} :focus-visible {
  outline: 2px solid ${cssColor(eye)};
  outline-offset: 3px;
}
.${uiClass.screen} {
  position: absolute;
  inset: 0;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  padding: 24px;
  box-sizing: border-box;
  opacity: 0;
  transition: opacity var(--sg-fade, ${tuning.uiFadeMs}ms) ease;
  background:
    radial-gradient(circle at 50% 28%, ${cssColorAlpha(portal, 0.07)}, transparent 62%),
    linear-gradient(180deg, ${cssColorAlpha(bg0, 0.42)}, ${cssColorAlpha(bg1, 0.62)});
}
.${uiClass.screenVisible} {
  opacity: 1;
}
.${uiClass.screen} {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.${uiClass.screen}::-webkit-scrollbar {
  display: none;
}
.${uiClass.title} {
  margin: 0;
  font-size: clamp(44px, 9vw, 84px);
  font-weight: 700;
  letter-spacing: 0.06em;
  color: ${textTitle};
  text-shadow:
    0 0 12px ${cssColorAlpha(eye, 0.55)},
    0 0 32px ${cssColorAlpha(eye, 0.3)},
    0 0 64px ${cssColorAlpha(portal, 0.28)};
}
.${uiClass.heading} {
  margin: 0;
  font-size: 34px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: ${textTitle};
  text-shadow: 0 0 16px ${cssColorAlpha(eye, 0.35)};
}
.${uiClass.menuActions} {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 16px;
}
.${uiClass.btn} {
  min-width: min(240px, 80vw);
  min-height: ${TOUCH_TARGET_MIN_PX}px;
  padding: 0 32px;
  border-radius: 16px;
  border: 1px solid ${cssColorAlpha(eye, 0.28)};
  background: ${cssColorAlpha(bg1, 0.85)};
  color: ${textPrimary};
  font-family: inherit;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition:
    border-color ${HOVER_TRANSITION_MS}ms ease,
    box-shadow ${HOVER_TRANSITION_MS}ms ease,
    transform ${HOVER_TRANSITION_MS}ms ease;
}
.${uiClass.btn}:hover {
  border-color: ${cssColorAlpha(eye, 0.7)};
  box-shadow: 0 0 18px ${cssColorAlpha(eye, 0.2)};
}
.${uiClass.btn}:active {
  transform: scale(0.98);
}
.${uiClass.btnPrimary} {
  border-color: ${cssColorAlpha(portal, 0.5)};
  box-shadow: 0 0 22px ${cssColorAlpha(portal, 0.16)};
}
.${uiClass.btnPrimary}:hover {
  border-color: ${cssColorAlpha(portal, 0.9)};
  box-shadow: 0 0 26px ${cssColorAlpha(portal, 0.35)};
}
.${uiClass.version} {
  position: absolute;
  bottom: 18px;
  left: 0;
  right: 0;
  width: fit-content;
  margin: 0 auto;
  padding: 2px 14px;
  border-radius: 12px;
  background: ${cssColorAlpha(bg0, 0.72)};
  text-align: center;
  font-size: 14px;
  letter-spacing: 0.08em;
  color: ${textDim};
}
.${uiClass.credits} {
  position: absolute;
  bottom: 44px;
  left: 0;
  right: 0;
  width: fit-content;
  margin: 0 auto;
  padding: 2px 14px;
  border-radius: 12px;
  background: ${cssColorAlpha(bg0, 0.72)};
  text-align: center;
  font-size: 12px;
  letter-spacing: 0.06em;
  color: ${textDim};
}
.${uiClass.panel} {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(560px, 92vw);
  padding: 20px;
  box-sizing: border-box;
  border-radius: 20px;
  border: 1px solid ${cssColorAlpha(eye, 0.14)};
  background: ${cssColorAlpha(bg1, 0.72)};
  box-shadow:
    0 0 40px ${cssColorAlpha(bg0, 0.6)},
    0 0 24px ${cssColorAlpha(portal, 0.06)};
}
.${uiClass.row} {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  min-height: ${TOUCH_TARGET_MIN_PX}px;
  padding: 0 8px;
  border-radius: 12px;
  cursor: pointer;
}
.${uiClass.rowLabel} {
  flex: 1 1 auto;
  font-size: 18px;
  color: ${textPrimary};
}
.${uiClass.rowValue} {
  min-width: 64px;
  text-align: end;
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  color: ${textDim};
}
.${uiClass.slider} {
  -webkit-appearance: none;
  appearance: none;
  flex: 2 1 160px;
  min-width: 140px;
  height: ${TOUCH_TARGET_MIN_PX}px;
  margin: 0;
  background: transparent;
  cursor: pointer;
}
.${uiClass.slider}::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 3px;
  background: ${cssColorAlpha(eye, 0.22)};
}
.${uiClass.slider}::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 26px;
  height: 26px;
  margin-top: -10px;
  border: none;
  border-radius: 50%;
  background: ${cssColor(eye)};
  box-shadow: 0 0 12px ${cssColorAlpha(eye, 0.6)};
}
.${uiClass.slider}::-moz-range-track {
  height: 6px;
  border-radius: 3px;
  background: ${cssColorAlpha(eye, 0.22)};
}
.${uiClass.slider}::-moz-range-thumb {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: ${cssColor(eye)};
  box-shadow: 0 0 12px ${cssColorAlpha(eye, 0.6)};
}
.${uiClass.toggle} {
  -webkit-appearance: none;
  appearance: none;
  flex: none;
  position: relative;
  width: 64px;
  height: 36px;
  margin: 0;
  border-radius: 18px;
  border: 1px solid ${cssColorAlpha(eye, 0.25)};
  background: ${cssColorAlpha(bg0, 0.9)};
  cursor: pointer;
  transition:
    background ${HOVER_TRANSITION_MS}ms ease,
    border-color ${HOVER_TRANSITION_MS}ms ease;
}
.${uiClass.toggle}::after {
  content: "";
  position: absolute;
  top: 4px;
  left: 4px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: ${textDim};
  transition:
    transform ${HOVER_TRANSITION_MS}ms ease,
    background ${HOVER_TRANSITION_MS}ms ease;
}
.${uiClass.toggle}:checked {
  border-color: ${cssColorAlpha(portal, 0.7)};
  background: ${cssColorAlpha(portal, 0.3)};
}
.${uiClass.toggle}:checked::after {
  transform: translateX(28px);
  background: ${cssColor(portal)};
  box-shadow: 0 0 10px ${cssColorAlpha(portal, 0.7)};
}
.${uiClass.rowStatic} {
  cursor: default;
}
.${uiClass.rowValueAccent} {
  color: ${cssColor(shard)};
  text-shadow: 0 0 12px ${cssColorAlpha(shard, 0.45)};
}
.${uiClass.badge} {
  flex: none;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid ${cssColorAlpha(shard, 0.6)};
  background: ${cssColorAlpha(shard, 0.16)};
  color: ${cssColor(shard)};
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  box-shadow: 0 0 16px ${cssColorAlpha(shard, 0.22)};
}

.${uiClass.enter} {
  animation: sg-enter-kf ${uiEnter.durationMs}ms ${EASE_CUBIC_OUT} backwards;
}
@keyframes sg-enter-kf {
  from {
    opacity: 0;
    transform: translateY(${SLIDE_IN_PX}px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.${uiClass.badgePop} {
  animation: sg-badge-pop-kf ${BADGE_POP_MS}ms ease-out;
}
@keyframes sg-badge-pop-kf {
  0% {
    transform: scale(1);
  }
  40% {
    transform: scale(${BADGE_POP_SCALE});
  }
  100% {
    transform: scale(1);
  }
}

.${uiClass.hud} {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  overflow: hidden;
  font-family: ${FONT_STACK};
  color: ${textPrimary};
  -webkit-user-select: none;
  user-select: none;
}
.${uiClass.hud} :focus-visible {
  outline: 2px solid ${cssColor(eye)};
  outline-offset: 3px;
}
.${uiClass.hudAnchor} {
  position: absolute;
  top: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  opacity: 0;
  transform: translateY(-${SLIDE_IN_PX}px);
  transition:
    opacity ${tuning.uiFadeMs}ms ${EASE_CUBIC_OUT},
    transform ${tuning.uiFadeMs}ms ${EASE_CUBIC_OUT};
}
.${uiClass.hudAnchorLeft} {
  inset-inline-start: 16px;
}
.${uiClass.hudAnchorCenter} {
  left: 50%;
  transform: translate(-50%, -${SLIDE_IN_PX}px);
}
.${uiClass.hudAnchorRight} {
  inset-inline-end: 16px;
}
.${uiClass.hudVisible} .${uiClass.hudAnchor} {
  opacity: 1;
  transform: translateY(0);
}
.${uiClass.hudVisible} .${uiClass.hudAnchorCenter} {
  transform: translate(-50%, 0);
}
.${uiClass.hudStat} {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 14px;
  border: 1px solid ${cssColorAlpha(eye, 0.1)};
  background: ${cssColorAlpha(bg0, 0.62)};
}
.${uiClass.hudStatLabel} {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${textDim};
}
.${uiClass.hudStatValue} {
  display: inline-block;
  font-size: 22px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  text-shadow: 0 0 10px ${cssColorAlpha(bg0, 0.9)};
}
.${uiClass.hudStatShards} .${uiClass.hudStatValue} {
  color: ${cssColor(shard)};
}
.${uiClass.hudPunch} {
  animation: sg-hud-punch-kf ${HUD_PUNCH_MS}ms ease-out;
}
@keyframes sg-hud-punch-kf {
  0% {
    transform: scale(1);
  }
  35% {
    transform: scale(1.32);
  }
  100% {
    transform: scale(1);
  }
}
.${uiClass.hudPause} {
  pointer-events: auto;
  min-width: ${TOUCH_TARGET_MIN_PX}px;
  min-height: ${TOUCH_TARGET_MIN_PX}px;
  padding: 0 20px;
  border-radius: 16px;
  border: 1px solid ${cssColorAlpha(eye, 0.28)};
  background: ${cssColorAlpha(bg1, 0.78)};
  color: ${textPrimary};
  font-family: inherit;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition:
    border-color ${HOVER_TRANSITION_MS}ms ease,
    box-shadow ${HOVER_TRANSITION_MS}ms ease;
}
.${uiClass.hudPause}:hover {
  border-color: ${cssColorAlpha(eye, 0.7)};
  box-shadow: 0 0 18px ${cssColorAlpha(eye, 0.2)};
}
.${uiClass.hudPause}:active {
  transform: scale(0.96);
}
.${uiClass.hudReduce},
.${uiClass.hudReduce} * {
  transition: none !important;
  animation: none !important;
}
@media (prefers-reduced-motion: reduce) {
  .${uiClass.hud},
  .${uiClass.hud} * {
    transition: none !important;
    animation: none !important;
  }
}

.${uiClass.levelIntro} {
  position: absolute;
  left: 50%;
  top: 24%;
  transform: translate(-50%, ${SLIDE_IN_PX}px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 30px 16px;
  border-radius: 18px;
  background: ${cssColorAlpha(bg0, 0.58)};
  backdrop-filter: blur(2px);
  pointer-events: none;
  text-align: center;
  opacity: 0;
  transition:
    opacity ${tuning.uiFadeMs}ms ${EASE_CUBIC_OUT},
    transform ${tuning.uiFadeMs}ms ${EASE_CUBIC_OUT};
}
.${uiClass.levelIntroVisible} {
  opacity: 1;
  transform: translate(-50%, 0);
}
.${uiClass.levelIntroTag} {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.${uiClass.levelIntroName} {
  margin: 0;
  font-size: clamp(28px, 4.6vw, 44px);
  font-weight: 700;
  letter-spacing: 0.04em;
  color: ${textTitle};
}
.${uiClass.tile}:hover:not(:disabled) {
  transform: translateY(-2px);
}
.${uiClass.tileDone} {
  font-weight: 700;
}
.${uiClass.tileChip} {
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
@keyframes sg-logo-idle-kf {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}
.${uiClass.title} {
  animation: sg-logo-idle-kf 5.5s ease-in-out infinite;
}

.${uiClass.hints} {
  position: absolute;
  left: 50%;
  bottom: 14%;
  transform: translateX(-50%);
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  pointer-events: none;
  font-family: ${FONT_STACK};
}
.${uiClass.hint} {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  border-radius: 14px;
  border: 1px solid ${cssColorAlpha(eye, 0.12)};
  background: ${cssColorAlpha(bg0, 0.68)};
  opacity: 1;
  transition: opacity ${tuning.uiFadeMs}ms ease;
}
.${uiClass.hintHidden} {
  opacity: 0;
}
.${uiClass.hintKeys} {
  display: flex;
  align-items: center;
  gap: 5px;
  direction: ltr;
}
.${uiClass.kbd} {
  display: inline-block;
  min-width: 18px;
  padding: 4px 9px;
  border-radius: 8px;
  border: 1px solid ${cssColorAlpha(eye, 0.35)};
  border-bottom-width: 2px;
  background: ${cssColorAlpha(bg1, 0.92)};
  color: ${textPrimary};
  font-size: 14px;
  font-weight: 600;
  text-align: center;
}
.${uiClass.hintLabel} {
  font-size: 15px;
  color: ${textDim};
  letter-spacing: 0.04em;
}
.${uiClass.hintsReduce},
.${uiClass.hintsReduce} * {
  transition: none !important;
  animation: none !important;
}
@media (prefers-reduced-motion: reduce) {
  .${uiClass.hints},
  .${uiClass.hints} * {
    transition: none !important;
    animation: none !important;
  }
}

.${uiClass.veil} {
  position: absolute;
  inset: 0;
  z-index: 20;
  pointer-events: none;
  background: ${cssColor(bg0)};
  opacity: 0;
  transition: opacity var(--sg-veil-fade, 0ms) ease;
}
.${uiClass.veilOpaque} {
  opacity: 1;
}
[dir="rtl"] .${uiClass.toggle}::after {
  left: auto;
  right: 4px;
}
[dir="rtl"] .${uiClass.toggle}:checked::after {
  transform: translateX(-28px);
}
[dir="rtl"] * {
  letter-spacing: normal !important;
}
`;
}

const STYLE_ELEMENT_ID = "sg-ui-theme";

let styleRefCount = 0;
let styleElement: HTMLStyleElement | null = null;

export function injectStyles(): void {
  styleRefCount += 1;
  if (styleElement !== null) {
    return;
  }
  styleElement = document.createElement("style");
  styleElement.id = STYLE_ELEMENT_ID;
  styleElement.textContent = buildStylesheet();
  document.head.appendChild(styleElement);
}

export function removeStyles(): void {
  styleRefCount = Math.max(0, styleRefCount - 1);
  if (styleRefCount === 0 && styleElement !== null) {
    styleElement.remove();
    styleElement = null;
  }
}
